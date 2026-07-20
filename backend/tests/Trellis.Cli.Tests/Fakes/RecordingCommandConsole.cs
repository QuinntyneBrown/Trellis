using Trellis.Cli;

namespace Trellis.Cli.Tests.Fakes;

/// <summary>
/// Records command output for assertions.
/// </summary>
public sealed class RecordingCommandConsole : ICommandConsole
{
    /// <summary>
    /// Gets normal output lines.
    /// </summary>
    public List<string> Output { get; } = [];

    /// <summary>
    /// Gets error output lines.
    /// </summary>
    public List<string> Errors { get; } = [];

    /// <inheritdoc />
    public void WriteOutput(string message) => this.Output.Add(message);

    /// <inheritdoc />
    public void WriteError(string message) => this.Errors.Add(message);
}
