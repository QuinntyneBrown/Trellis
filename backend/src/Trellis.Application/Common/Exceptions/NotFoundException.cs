namespace Trellis.Application.Common.Exceptions;

/// <summary>
/// Thrown when a requested entity could not be found.
/// </summary>
public class NotFoundException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="NotFoundException"/> class.
    /// </summary>
    public NotFoundException()
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="NotFoundException"/> class with a message.
    /// </summary>
    /// <param name="message">The exception message.</param>
    public NotFoundException(string message)
        : base(message)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="NotFoundException"/> class for a specific entity lookup.
    /// </summary>
    /// <param name="name">The name of the entity type that was not found.</param>
    /// <param name="key">The key that was used to look up the entity.</param>
    public NotFoundException(string name, object key)
        : base($"Entity \"{name}\" ({key}) was not found.")
    {
    }
}
