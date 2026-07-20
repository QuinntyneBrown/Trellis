using Microsoft.Extensions.Logging;
using Trellis.Core.PlantUml;

namespace Trellis.Cli.Commands;

/// <summary>
/// Executes the PlantUML render use case for the CLI.
/// </summary>
public sealed class RenderCommandHandler
{
    /// <summary>
    /// The successful command exit code.
    /// </summary>
    public const int SuccessExitCode = 0;

    /// <summary>
    /// The operational failure exit code.
    /// </summary>
    public const int FailureExitCode = 1;

    /// <summary>
    /// The conventional cancellation exit code.
    /// </summary>
    public const int CancelledExitCode = 130;

    private readonly IPlantUmlRenderer renderer;
    private readonly ICommandConsole console;
    private readonly ILogger<RenderCommandHandler> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RenderCommandHandler"/> class.
    /// </summary>
    /// <param name="renderer">The PlantUML renderer.</param>
    /// <param name="console">The user-facing console.</param>
    /// <param name="logger">The diagnostic logger.</param>
    public RenderCommandHandler(
        IPlantUmlRenderer renderer,
        ICommandConsole console,
        ILogger<RenderCommandHandler> logger)
    {
        this.renderer = renderer;
        this.console = console;
        this.logger = logger;
    }

    /// <summary>
    /// Renders one PlantUML file to PNG.
    /// </summary>
    /// <param name="input">The input file.</param>
    /// <param name="output">The optional output file.</param>
    /// <param name="cancellationToken">The cancellation token.</param>
    /// <returns>The process exit code.</returns>
    public async Task<int> ExecuteAsync(FileInfo input, FileInfo? output, CancellationToken cancellationToken)
    {
        var inputPath = input.FullName;

        if (!string.Equals(input.Extension, ".puml", StringComparison.OrdinalIgnoreCase))
        {
            return this.Fail("The input file must have a .puml extension.");
        }

        if (!input.Exists)
        {
            return this.Fail($"The input file does not exist: {inputPath}");
        }

        var outputPath = output?.FullName ?? Path.ChangeExtension(inputPath, ".png");
        if (!string.Equals(Path.GetExtension(outputPath), ".png", StringComparison.OrdinalIgnoreCase))
        {
            return this.Fail("The output file must have a .png extension.");
        }

        var outputDirectory = Path.GetDirectoryName(outputPath);
        if (string.IsNullOrEmpty(outputDirectory) || !Directory.Exists(outputDirectory))
        {
            return this.Fail($"The output directory does not exist: {outputDirectory}");
        }

        try
        {
            var source = await File.ReadAllTextAsync(inputPath, cancellationToken);
            if (string.IsNullOrWhiteSpace(source))
            {
                return this.Fail("PlantUML source must not be empty.");
            }

            var result = await this.renderer.RenderAsync(source, PlantUmlOutputFormat.Png, cancellationToken);
            if (!result.IsSuccess || result.Content is null)
            {
                return this.Fail(result.ErrorMessage ?? "The diagram could not be rendered.");
            }

            await WriteOutputAsync(outputPath, result.Content, cancellationToken);
            this.console.WriteOutput($"Rendered {inputPath} to {outputPath}");
            return SuccessExitCode;
        }
        catch (OperationCanceledException)
        {
            this.console.WriteError("The render was cancelled.");
            return CancelledExitCode;
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Failed to render {InputPath} to {OutputPath}.", inputPath, outputPath);
            return this.Fail($"The diagram could not be written: {exception.Message}");
        }
    }

    private static async Task WriteOutputAsync(string outputPath, byte[] content, CancellationToken cancellationToken)
    {
        var temporaryPath = $"{outputPath}.{Guid.NewGuid():N}.tmp";

        try
        {
            await File.WriteAllBytesAsync(temporaryPath, content, cancellationToken);
            File.Move(temporaryPath, outputPath, overwrite: true);
        }
        finally
        {
            if (File.Exists(temporaryPath))
            {
                File.Delete(temporaryPath);
            }
        }
    }

    private int Fail(string message)
    {
        this.console.WriteError(message);
        return FailureExitCode;
    }
}
