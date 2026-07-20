using System.Diagnostics;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Trellis.Core.PlantUml;

/// <summary>
/// Renders PlantUML source by invoking the vendored PlantUML jar through Java.
/// </summary>
public sealed class PlantUmlRenderer : IPlantUmlRenderer, IDisposable
{
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly Regex SvgRegex = new(@"<svg[\s\S]*?</svg>", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly PlantUmlOptions options;
    private readonly ILogger<PlantUmlRenderer> logger;
    private readonly SemaphoreSlim concurrencyLimiter;
    private readonly string jarFullPath;
    private readonly string includeFullPath;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlantUmlRenderer"/> class.
    /// </summary>
    /// <param name="options">The rendering options.</param>
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
    public async Task<PlantUmlRenderResult> RenderAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken)
    {
        await this.concurrencyLimiter.WaitAsync(cancellationToken);
        try
        {
            return await this.RenderCoreAsync(source, outputFormat, cancellationToken);
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

    private static async Task<byte[]?> SafeReadOutputAsync(Task copyTask, MemoryStream stream)
    {
        try
        {
            await copyTask;
            return stream.ToArray();
        }
        catch
        {
            return null;
        }
    }

    private static async Task<string?> SafeReadErrorAsync(Task<string> task)
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

    private static string BuildFriendlyErrorMessage(string? standardError)
    {
        const string defaultMessage = "The diagram could not be rendered.";

        if (string.IsNullOrWhiteSpace(standardError))
        {
            return defaultMessage;
        }

        var lines = standardError
            .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(line => line.Length > 0)
            .ToArray();

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

    private static byte[]? ValidateOutput(byte[]? output, PlantUmlOutputFormat outputFormat)
    {
        if (output is null)
        {
            return null;
        }

        if (outputFormat == PlantUmlOutputFormat.Png)
        {
            return output.AsSpan().StartsWith(PngSignature) ? output : null;
        }

        var svg = Encoding.UTF8.GetString(output);
        var match = SvgRegex.Match(svg);
        return match.Success ? Encoding.UTF8.GetBytes(match.Value) : null;
    }

    private async Task<PlantUmlRenderResult> RenderCoreAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken)
    {
        var startInfo = new ProcessStartInfo
        {
            FileName = this.options.JavaExecutablePath,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
            StandardInputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };

        startInfo.ArgumentList.Add("-Djava.awt.headless=true");
        startInfo.ArgumentList.Add("-jar");
        startInfo.ArgumentList.Add(this.jarFullPath);
        startInfo.ArgumentList.Add(outputFormat == PlantUmlOutputFormat.Png ? "-tpng" : "-tsvg");
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

        using var timeoutCts = new CancellationTokenSource(TimeSpan.FromSeconds(Math.Max(1, this.options.RenderTimeoutSeconds)));
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken, timeoutCts.Token);
        using var outputStream = new MemoryStream();

        var outputTask = process.StandardOutput.BaseStream.CopyToAsync(outputStream, cancellationToken);
        var errorTask = process.StandardError.ReadToEndAsync(cancellationToken);

        try
        {
            try
            {
                var sourceBytes = Encoding.UTF8.GetBytes(source);
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
            TryKillProcessTree(process, this.logger);

            if (timeoutCts.IsCancellationRequested && !cancellationToken.IsCancellationRequested)
            {
                return PlantUmlRenderResult.Failure("The diagram renderer timed out.");
            }

            throw;
        }

        var output = await SafeReadOutputAsync(outputTask, outputStream);
        var standardError = await SafeReadErrorAsync(errorTask);
        var validatedOutput = ValidateOutput(output, outputFormat);
        var exitCode = process.HasExited ? process.ExitCode : -1;

        if (validatedOutput is not null && exitCode == 0)
        {
            return PlantUmlRenderResult.Success(validatedOutput);
        }

        var friendlyMessage = BuildFriendlyErrorMessage(standardError);
        this.logger.LogWarning(
            "PlantUML renderer reported a failure. ExitCode={ExitCode} StdErr={StdErr}",
            exitCode,
            standardError);

        return PlantUmlRenderResult.Failure(friendlyMessage);
    }
}
