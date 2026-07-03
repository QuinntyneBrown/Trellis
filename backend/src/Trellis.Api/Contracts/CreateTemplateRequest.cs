using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the create-template endpoint.
/// </summary>
public record CreateTemplateRequest
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
    /// Gets the template kind - "plantuml" or "markdown". Null defaults to plantuml.
    /// </summary>
    public string? Kind { get; init; }
}
