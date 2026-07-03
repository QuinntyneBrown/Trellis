namespace Trellis.Api.Models;

/// <summary>
/// Represents the lightweight shape of a template used for list views,
/// deliberately excluding the (potentially large) content field.
/// </summary>
public record TemplateListItemDto
{
    /// <summary>
    /// Gets the unique identifier of the template.
    /// </summary>
    public required Guid Id { get; init; }

    /// <summary>
    /// Gets the display name of the template.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the template kind - "plantuml" or "markdown".
    /// </summary>
    public required string Kind { get; init; }

    /// <summary>
    /// Gets the timestamp at which the template was last touched (updated, or created if never updated).
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; init; }
}
