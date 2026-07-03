using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the update-template endpoint: a full replace of
/// name, content AND kind. Unlike documents (whose kind is create-only), a
/// template's kind is updatable - "Update from editor" replaces the content
/// wholesale and may legitimately change what the template is, so there is
/// no "leave unchanged" ambiguity to defend against here: kind is required.
/// </summary>
public record UpdateTemplateRequest
{
    /// <summary>
    /// Gets the display name of the template.
    /// </summary>
    [Required]
    [MaxLength(200)]
    public required string Name { get; init; }

    /// <summary>
    /// Gets the template's source content. May be empty, but never null.
    /// </summary>
    [Required(AllowEmptyStrings = true)]
    public required string Content { get; init; }

    /// <summary>
    /// Gets the template kind - "plantuml" or "markdown".
    /// </summary>
    [Required]
    public required string Kind { get; init; }
}
