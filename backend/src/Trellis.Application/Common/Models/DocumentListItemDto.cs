namespace Trellis.Application.Common.Models;

/// <summary>
/// Represents the lightweight shape of a PlantUML document used for list views,
/// deliberately excluding the (potentially large) content field.
/// </summary>
public record DocumentListItemDto
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
    /// Gets the timestamp at which the document was last touched (updated, or created if never updated).
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; init; }
}
