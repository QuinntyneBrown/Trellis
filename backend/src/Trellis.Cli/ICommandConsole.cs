namespace Trellis.Cli;

/// <summary>
/// Writes user-facing command output.
/// </summary>
public interface ICommandConsole
{
    /// <summary>
    /// Writes a normal output line.
    /// </summary>
    /// <param name="message">The message to write.</param>
    void WriteOutput(string message);

    /// <summary>
    /// Writes an error line.
    /// </summary>
    /// <param name="message">The message to write.</param>
    void WriteError(string message);
}
