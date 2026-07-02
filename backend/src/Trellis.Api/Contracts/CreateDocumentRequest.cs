using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the create-document endpoint. Unlike
/// <see cref="UpdateDocumentRequest"/> it carries an optional destination
/// folder - creation is the only point at which a document's folder is chosen.
/// </summary>
public record CreateDocumentRequest
{
    /// <summary>
    /// Gets the display name of the document.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    /// <summary>
    /// Gets the raw PlantUML source content. May be empty, but never null.
    /// </summary>
    [Required(AllowEmptyStrings = true)]
    public required string Content { get; init; }

    /// <summary>
    /// Gets the identifier of the virtual folder to place the document in,
    /// or null for the root.
    /// </summary>
    public Guid? FolderId { get; init; }
}
