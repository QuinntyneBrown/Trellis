using Trellis.Domain.Common;

namespace Trellis.Domain.Entities;

/// <summary>
/// Represents a saved PlantUML diagram document.
/// </summary>
public class PlantUmlDocument : BaseEntity
{
    /// <summary>
    /// Gets or sets the display name of the document.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the raw PlantUML source content of the document.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the timestamp at which the document was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Gets or sets the timestamp at which the document was last updated, if ever.
    /// </summary>
    public DateTimeOffset? UpdatedAt { get; set; }
}
