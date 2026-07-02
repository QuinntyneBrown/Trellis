using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Options;
using Trellis.Api.Models;

namespace Trellis.Api.PlantUml;

/// <summary>
/// Renders PlantUML source to SVG by shelling out to a local JVM running the
/// vendored plantuml.jar. Bounds concurrency with a semaphore so a burst of render
/// requests cannot spawn unbounded Java processes. Expected failures come back as
/// failed <see cref="PlantUmlRenderResult"/>s; unexpected exceptions are allowed to
/// propagate to the hub, which owns the single catch-all boundary on the render path.
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
        // The wait stays outside the try so Release only ever runs after a
        // successful acquire.
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
            logger.LogWarning(exception, "Failed to kill a cancelled PlantUML render process.");
        }
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

        // The timeout clock starts as soon as the process exists so the stdin write
        // below is inside the timeout envelope too: a JVM that launches but hangs
        // before consuming stdin (while the source overflows the OS pipe buffer)
        // must not block a render slot forever.
        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(1, this.options.RenderTimeoutSeconds)));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);

        // Readers are started before the stdin write to avoid the classic pipe
        // deadlock where the child blocks writing its output while the parent
        // blocks writing the child's input.
        var stdoutTask = process.StandardOutput.ReadToEndAsync(cancellationToken);
        var stderrTask = process.StandardError.ReadToEndAsync(cancellationToken);

        try
        {
            try
            {
                var sourceBytes = Encoding.UTF8.GetBytes(source);

                // The outer WaitAsync guarantees the timeout path is reached even if
                // the pipe write itself never honors cancellation.
                await process.StandardInput.BaseStream
                    .WriteAsync(sourceBytes, linkedCts.Token)
                    .AsTask()
                    .WaitAsync(linkedCts.Token);
            }
            catch (OperationCanceledException)
            {
                throw;
            }
            catch (Exception exception)
            {
                // A java process that exited early (broken pipe) is not a timeout and
                // not fatal here - fall through so the stderr-based friendly-error
                // path below still runs.
                this.logger.LogWarning(exception, "Failed writing PlantUML source to the renderer's stdin.");
            }
            finally
            {
                process.StandardInput.Close();
            }

            await process.WaitForExitAsync(linkedCts.Token);
        }
        catch (OperationCanceledException)
        {
            // Covers both the render timeout and external cancellation (e.g. the
            // SignalR connection aborting) - in either case the java process must
            // not be orphaned.
            TryKillProcessTree(process, this.logger);

            if (timeoutCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
            {
                return PlantUmlRenderResult.Failure("The diagram renderer timed out.");
            }

            throw;
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
}
