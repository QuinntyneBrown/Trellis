using System.CommandLine;

namespace Trellis.Cli.Commands;

/// <summary>
/// Defines the command-line surface for rendering PlantUML files.
/// </summary>
public sealed class RenderCommand
{
    private readonly RenderCommandHandler handler;

    /// <summary>
    /// Initializes a new instance of the <see cref="RenderCommand"/> class.
    /// </summary>
    /// <param name="handler">The command handler.</param>
    public RenderCommand(RenderCommandHandler handler)
    {
        this.handler = handler;
    }

    /// <summary>
    /// Builds the render command.
    /// </summary>
    /// <returns>The configured command.</returns>
    public Command Create()
    {
        var pathArgument = new Argument<FileInfo>("path")
        {
            Description = "Path to the .puml file to render.",
        };
        var outputOption = new Option<FileInfo?>("--output", "-o")
        {
            Description = "Output .png path. Defaults beside the input file.",
        };
        var command = new Command("render", "Render a PlantUML file as a PNG image.");

        command.Arguments.Add(pathArgument);
        command.Options.Add(outputOption);
        command.SetAction((parseResult, cancellationToken) => this.handler.ExecuteAsync(
            parseResult.GetValue(pathArgument)!,
            parseResult.GetValue(outputOption),
            cancellationToken));

        return command;
    }
}
