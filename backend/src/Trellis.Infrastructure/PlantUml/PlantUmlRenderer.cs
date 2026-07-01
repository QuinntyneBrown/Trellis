using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Infrastructure.PlantUml;

/// <summary>
/// Renders PlantUML source to SVG by shelling out to a local JVM running the
/// vendored plantuml.jar. Bounds concurrency with a semaphore so a burst of render
/// requests cannot spawn unbounded Java processes.
/// </summary>
public class PlantUmlRenderer : IPlantUmlRenderer, IDisposable
{
    private static readonly Regex SvgRegex = new(@"<svg[\s\S]*?</svg>", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly PlantUmlOptions options;
    private readonly ILogger<PlantUmlRenderer> logger;
    private readonly SemaphoreSlim concurrencyLimiter;
    private readonly string jarFullPath;
    private readonly string includeFullPath;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlantUmlRenderer"/> class.
    /// </summary>
    /// <param name="options">The PlantUML rendering options.</param>
    /// <param name="logger">The logger.</param>
    public PlantUmlRenderer(IOptions<PlantUmlOptions> options, ILogger<PlantUmlRenderer> logger)
    {
        this.options = options.Value;
        this.logger = logger;
        this.concurrencyLimiter = new SemaphoreSlim(Math.Max(1, this.options.MaxConcurrentRenders));
        this.jarFullPath = ToAbsolutePath(this.options.JarPath);
        this.includeFullPath = ToAbsolutePath(this.options.IncludePath);
    }

    /// <inheritdoc />
    public async Task<PlantUmlRenderResult> RenderAsync(string source, CancellationToken cancellationToken)
    {
        try
        {
            await this.concurrencyLimiter.WaitAsync(cancellationToken);
            try
            {
                return await this.RenderCoreAsync(source, cancellationToken);
            }
            finally
            {
                this.concurrencyLimiter.Release();
            }
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Unexpected error while rendering a PlantUML diagram.");
            return PlantUmlRenderResult.Failure("An unexpected error occurred while rendering the diagram.");
        }
    }

    /// <inheritdoc />
    public void Dispose()
    {
        this.concurrencyLimiter.Dispose();
        GC.SuppressFinalize(this);
    }

    private static string ToAbsolutePath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return path;
        }

        return Path.IsPathRooted(path) ? path : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, path));
    }

    private async Task<PlantUmlRenderResult> RenderCoreAsync(string source, CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = this.options.JavaExecutablePath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };

        startInfo.ArgumentList.Add("-Djava.awt.headless=true");
        startInfo.ArgumentList.Add("-jar");
        startInfo.ArgumentList.Add(this.jarFullPath);
        startInfo.ArgumentList.Add("-tsvg");
        startInfo.ArgumentList.Add("-pipe");
        startInfo.ArgumentList.Add("-charset");
        startInfo.ArgumentList.Add("UTF-8");

        if (!string.IsNullOrWhiteSpace(this.includeFullPath))
        {
            startInfo.Environment["PLANTUML_INCLUDE_PATH"] = this.includeFullPath;
        }

        using var process = new Process { StartInfo = startInfo };

        try
        {
            process.Start();
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Failed to start the PlantUML rendering process.");
            return PlantUmlRenderResult.Failure("The diagram renderer is unavailable.");
        }

        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

        try
        {
            var sourceBytes = Encoding.UTF8.GetBytes(source);
            await process.StandardInput.BaseStream.WriteAsync(sourceBytes, cancellationToken);
        }
        catch (Exception exception)
        {
            this.logger.LogWarning(exception, "Failed writing PlantUML source to the renderer's stdin.");
        }
        finally
        {
            process.StandardInput.Close();
        }

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(1, this.options.RenderTimeoutSeconds)));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        try
        {
            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException) when (timeoutCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
        {
            TryKillProcessTree(process, this.logger);
            return PlantUmlRenderResult.Failure("The diagram renderer timed out.");
        }

        var stdout = await SafeAwaitAsync(stdoutTask);
        var stderr = await SafeAwaitAsync(stderrTask);

        var svgMatch = SvgRegex.Match(stdout ?? string.Empty);
        var exitCode = process.HasExited ? process.ExitCode : -1;

        // PlantUML happily emits a *picture* even for malformed source - a
        // "Syntax Error?" panel baked into the SVG itself - while still
        // signalling the problem through a non-zero exit code (and an
        // "ERROR" marker on stderr). The shared contract calls out bad
        // syntax as an expected failure mode (isSuccess: false plus a
        // populated errorMessage), so a non-zero exit code must be treated
        // as a failure even when an SVG was produced.
        if (svgMatch.Success && exitCode == 0)
        {
            return PlantUmlRenderResult.Success(svgMatch.Value);
        }

        var friendlyMessage = BuildFriendlyErrorMessage(stderr);
        this.logger.LogWarning(
            "PlantUML renderer reported a failure. ExitCode={ExitCode} StdErr={StdErr}",
            exitCode,
            stderr);

        return PlantUmlRenderResult.Failure(friendlyMessage);
    }

    private static async Task<string?> SafeAwaitAsync(Task<string> task)
    {
        try
        {
            return await task;
        }
        catch
        {
            return null;
        }
    }

    private static string BuildFriendlyErrorMessage(string? stderr)
    {
        const string defaultMessage = "The diagram could not be rendered.";

        if (string.IsNullOrWhiteSpace(stderr))
        {
            return defaultMessage;
        }

        var lines = stderr
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => line.Length > 0)
            .ToArray();

        // PlantUML's stderr for a syntax error is conventionally three lines: a bare
        // "ERROR" marker, the 1-based source line number, then a human-readable
        // description (e.g. "Syntax Error? (Assumed diagram type: sequence)"). Prefer
        // that description line; fall back to the first line for anything else.
        var descriptiveLine = lines.FirstOrDefault(line =>
            !string.Equals(line, "ERROR", StringComparison.OrdinalIgnoreCase) && !int.TryParse(line, out _));

        var chosenLine = descriptiveLine ?? lines.FirstOrDefault();

        if (string.IsNullOrWhiteSpace(chosenLine))
        {
            return defaultMessage;
        }

        const int maxLength = 200;
        return chosenLine.Length > maxLength ? chosenLine[..maxLength] : chosenLine;
    }

    private static void TryKillProcessTree(Process process, ILogger logger)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
            }
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Failed to kill a timed-out PlantUML render process.");
        }
    }
}
