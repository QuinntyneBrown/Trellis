using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the update-document endpoint. Deliberately omits
/// an id field (the route id is always authoritative) and a folder field
/// (documents cannot be moved between folders - the folder is chosen at
/// creation only, via <see cref="CreateDocumentRequest"/>). Validation is
/// plain DataAnnotations; [ApiController] turns failures into the standard
/// 400 ValidationProblemDetails response automatically.
/// </summary>
public record UpdateDocumentRequest
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
}
