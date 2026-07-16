namespace Trellis.Api.Domain;

/// <summary>
/// Represents a saved PlantUML diagram document. This is both the persisted EF
/// entity and the JSON shape returned by the documents endpoints - it has no
/// navigation properties and nothing secret to hide behind a DTO.
/// </summary>
public class PlantUmlDocument
{
    /// <summary>
    /// Gets or sets the unique identifier of the document.
    /// </summary>
    public Guid Id { get; set; }

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

    /// <summary>
    /// Gets or sets the identifier of the virtual <see cref="Folder"/> containing
    /// this document, or null when it sits at the root. Assigned at creation and
    /// changed only by the dedicated move endpoint - the update endpoint never
    /// touches it.
    /// </summary>
    public Guid? FolderId { get; set; }

    /// <summary>
    /// Gets or sets the document kind - one of <see cref="DocumentKinds"/>.
    /// Chosen at creation only (explicitly, or inferred from an uploaded
    /// file's extension); the update endpoint never changes it.
    /// </summary>
    public string Kind { get; set; } = DocumentKinds.PlantUml;

    /// <summary>
    /// Gets or sets a value indicating whether the document is omitted from
    /// folder markdown exports (unless the export explicitly asks to include
    /// excluded documents). Changed only by the dedicated export-exclusion
    /// endpoint - the update endpoint never touches it.
    /// </summary>
    public bool ExcludedFromExport { get; set; }
}
