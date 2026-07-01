namespace Trellis.Application.Common.Models;

/// <summary>
/// Represents a PlantUML starter template.
/// </summary>
public record TemplateDto
{
    /// <summary>
    /// Gets the kebab-case unique key of the template, for example "c4-context".
    /// </summary>
    public required string Key { get; init; }

    /// <summary>
    /// Gets the human-readable display name, for example "C4 - Context".
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the category the template belongs to.
    /// </summary>
    public required string Category { get; init; }

    /// <summary>
    /// Gets the full PlantUML starter source for the template.
    /// </summary>
    public required string Content { get; init; }
}
