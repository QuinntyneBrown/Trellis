using Microsoft.Extensions.Logging.Abstractions;
using Trellis.Cli.Commands;
using Trellis.Cli.Tests.Fakes;
using Trellis.Core.PlantUml;

namespace Trellis.Cli.Tests.Commands;

/// <summary>
/// Tests the render command's file and exit-code behavior.
/// </summary>
public sealed class RenderCommandHandlerTests : IDisposable
{
    private readonly string temporaryDirectory;

    /// <summary>
    /// Initializes a new instance of the <see cref="RenderCommandHandlerTests"/> class.
    /// </summary>
    public RenderCommandHandlerTests()
    {
        this.temporaryDirectory = Path.Combine(Path.GetTempPath(), "Trellis.Cli.Tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(this.temporaryDirectory);
    }

    [Fact]
    public async Task ExecuteAsync_WritesAdjacentPngAndOverwritesExistingFile()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var outputPath = Path.ChangeExtension(inputPath, ".png");
        await File.WriteAllBytesAsync(outputPath, [0x01]);
        var renderer = new FakePlantUmlRenderer();
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(renderer, console);

        var exitCode = await handler.ExecuteAsync(new FileInfo(inputPath), null, CancellationToken.None);

        Assert.Equal(RenderCommandHandler.SuccessExitCode, exitCode);
        Assert.Equal(renderer.Result.Content, await File.ReadAllBytesAsync(outputPath));
        Assert.Equal(PlantUmlOutputFormat.Png, renderer.RequestedFormat);
        Assert.Single(console.Output);
        Assert.Empty(console.Errors);
    }

    [Fact]
    public async Task ExecuteAsync_WritesExplicitOutputPath()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var outputPath = Path.Combine(this.temporaryDirectory, "custom.png");
        var handler = CreateHandler(new FakePlantUmlRenderer(), new RecordingCommandConsole());

        var exitCode = await handler.ExecuteAsync(
            new FileInfo(inputPath),
            new FileInfo(outputPath),
            CancellationToken.None);

        Assert.Equal(RenderCommandHandler.SuccessExitCode, exitCode);
        Assert.True(File.Exists(outputPath));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsFailureForMissingInput()
    {
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(new FakePlantUmlRenderer(), console);

        var exitCode = await handler.ExecuteAsync(
            new FileInfo(Path.Combine(this.temporaryDirectory, "missing.puml")),
            null,
            CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Contains("does not exist", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsFailureForWrongInputExtension()
    {
        var inputPath = this.CreateInput("diagram.txt");
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(new FakePlantUmlRenderer(), console);

        var exitCode = await handler.ExecuteAsync(new FileInfo(inputPath), null, CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Contains(".puml", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsFailureForWrongOutputExtension()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(new FakePlantUmlRenderer(), console);

        var exitCode = await handler.ExecuteAsync(
            new FileInfo(inputPath),
            new FileInfo(Path.Combine(this.temporaryDirectory, "diagram.svg")),
            CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Contains(".png", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsFailureForMissingOutputDirectory()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(new FakePlantUmlRenderer(), console);

        var exitCode = await handler.ExecuteAsync(
            new FileInfo(inputPath),
            new FileInfo(Path.Combine(this.temporaryDirectory, "missing", "diagram.png")),
            CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Contains("directory", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_DoesNotOverwriteOutputWhenRenderingFails()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var outputPath = Path.ChangeExtension(inputPath, ".png");
        await File.WriteAllBytesAsync(outputPath, [0x01, 0x02]);
        var renderer = new FakePlantUmlRenderer
        {
            Result = PlantUmlRenderResult.Failure("Syntax error."),
        };
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(renderer, console);

        var exitCode = await handler.ExecuteAsync(new FileInfo(inputPath), null, CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Equal(new byte[] { 0x01, 0x02 }, await File.ReadAllBytesAsync(outputPath));
        Assert.Equal("Syntax error.", Assert.Single(console.Errors));
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsCancelledExitCodeWhenRendererIsCancelled()
    {
        var inputPath = this.CreateInput("diagram.puml");
        var renderer = new FakePlantUmlRenderer
        {
            Exception = new OperationCanceledException(),
        };
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(renderer, console);

        var exitCode = await handler.ExecuteAsync(new FileInfo(inputPath), null, CancellationToken.None);

        Assert.Equal(RenderCommandHandler.CancelledExitCode, exitCode);
        Assert.Contains("cancelled", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ExecuteAsync_ReturnsFailureForEmptySource()
    {
        var inputPath = this.CreateInput("empty.puml", "   ");
        var console = new RecordingCommandConsole();
        var handler = CreateHandler(new FakePlantUmlRenderer(), console);

        var exitCode = await handler.ExecuteAsync(new FileInfo(inputPath), null, CancellationToken.None);

        Assert.Equal(RenderCommandHandler.FailureExitCode, exitCode);
        Assert.Contains("empty", Assert.Single(console.Errors), StringComparison.OrdinalIgnoreCase);
    }

    /// <inheritdoc />
    public void Dispose()
    {
        Directory.Delete(this.temporaryDirectory, recursive: true);
    }

    private static RenderCommandHandler CreateHandler(FakePlantUmlRenderer renderer, RecordingCommandConsole console)
    {
        return new RenderCommandHandler(renderer, console, NullLogger<RenderCommandHandler>.Instance);
    }

    private string CreateInput(string name, string source = "@startuml\nAlice -> Bob\n@enduml")
    {
        var path = Path.Combine(this.temporaryDirectory, name);
        File.WriteAllText(path, source);
        return path;
    }
}
