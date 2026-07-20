namespace Trellis.Cli;

/// <summary>
/// Writes command output to the process console.
/// </summary>
public sealed class CommandConsole : ICommandConsole
{
    /// <inheritdoc />
    public void WriteOutput(string message) => Console.Out.WriteLine(message);

    /// <inheritdoc />
    public void WriteError(string message) => Console.Error.WriteLine(message);
}
