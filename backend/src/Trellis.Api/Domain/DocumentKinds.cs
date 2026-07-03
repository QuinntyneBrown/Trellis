namespace Trellis.Api.Domain;

/// <summary>
/// The valid values of <see cref="PlantUmlDocument.Kind"/>. A validated
/// string rather than an enum: the entity is serialized directly as the API
/// JSON shape, and these exact lowercase values are the wire contract the
/// frontend's TypeScript union type ('plantuml' | 'markdown') matches.
/// </summary>
public static class DocumentKinds
{
    /// <summary>
    /// A PlantUML diagram document, rendered to SVG.
    /// </summary>
    public const string PlantUml = "plantuml";

    /// <summary>
    /// A markdown document, rendered to sanitized HTML.
    /// </summary>
    public const string Markdown = "markdown";

    /// <summary>
    /// Returns whether the given value is a recognized document kind.
    /// </summary>
    /// <param name="kind">The candidate kind value.</param>
    /// <returns><see langword="true"/> for a recognized kind.</returns>
    public static bool IsValid(string? kind) => kind is PlantUml or Markdown;
}
