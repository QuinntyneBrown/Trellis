namespace Trellis.Api.Domain;

/// <summary>
/// Represents a reusable starter template applied into the editor. This is both
/// the persisted EF entity and the JSON shape returned by the templates
/// endpoints - it has no navigation properties and nothing secret to hide
/// behind a DTO. The six built-in starters are seeded by migration as ordinary
/// rows, so users can rename, update, or delete them like any other template.
/// </summary>
public class Template
{
    /// <summary>
    /// Gets or sets the unique identifier of the template.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the display name of the template.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the template's source content.
    /// </summary>
    public string Content { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the template kind - one of <see cref="DocumentKinds"/>.
    /// Unlike documents, the kind IS updatable: "Update from editor" replaces
    /// a template's content wholesale and may legitimately change what it is.
    /// </summary>
    public string Kind { get; set; } = DocumentKinds.PlantUml;

    /// <summary>
    /// Gets or sets the timestamp at which the template was created.
    /// </summary>
    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>
    /// Gets or sets the timestamp at which the template was last updated, if ever.
    /// </summary>
    public DateTimeOffset? UpdatedAt { get; set; }
}
