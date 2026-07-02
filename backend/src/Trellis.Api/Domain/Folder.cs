namespace Trellis.Api.Domain;

/// <summary>
/// Represents a virtual folder used to organize saved PlantUML documents.
/// Folders are database rows, not disk directories. Like
/// <see cref="PlantUmlDocument"/>, this is both the persisted EF entity and the
/// JSON shape returned by the folders endpoints - it has no navigation
/// properties and nothing secret to hide behind a DTO.
/// </summary>
public class Folder
{
    /// <summary>
    /// Gets or sets the unique identifier of the folder.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets the display name of the folder.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the identifier of the parent folder, or null when the
    /// folder sits at the root.
    /// </summary>
    public Guid? ParentFolderId { get; set; }
}
