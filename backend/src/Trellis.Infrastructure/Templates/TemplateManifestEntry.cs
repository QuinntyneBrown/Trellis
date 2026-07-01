namespace Trellis.Infrastructure.Templates;

/// <summary>
/// Represents a single entry in the vendored templates manifest.json file.
/// </summary>
public record TemplateManifestEntry
{
    /// <summary>
    /// Gets the kebab-case unique key of the template.
    /// </summary>
    public required string Key { get; init; }

    /// <summary>
    /// Gets the human-readable display name of the template.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the category the template belongs to ("General" or "C4").
    /// </summary>
    public required string Category { get; init; }

    /// <summary>
    /// Gets the file name (relative to the manifest) containing the template's PlantUML source.
    /// </summary>
    public required string File { get; init; }
}
