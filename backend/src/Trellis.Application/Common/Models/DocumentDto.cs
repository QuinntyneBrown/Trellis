namespace Trellis.Application.Common.Models;

/// <summary>
/// Represents the full shape of a PlantUML document, including its content.
/// </summary>
public record DocumentDto
{
    /// <summary>
    /// Gets the unique identifier of the document.
    /// </summary>
    public required Guid Id { get; init; }

    /// <summary>
    /// Gets the display name of the document.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the raw PlantUML source content of the document.
    /// </summary>
    public required string Content { get; init; }

    /// <summary>
    /// Gets the timestamp at which the document was created.
    /// </summary>
    public required DateTimeOffset CreatedAt { get; init; }

    /// <summary>
    /// Gets the timestamp at which the document was last updated, if ever.
    /// </summary>
    public DateTimeOffset? UpdatedAt { get; init; }
}
