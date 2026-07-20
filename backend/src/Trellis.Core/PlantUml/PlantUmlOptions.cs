namespace Trellis.Core.PlantUml;

/// <summary>
/// Configuration options for invoking the vendored PlantUML jar through Java.
/// </summary>
public sealed class PlantUmlOptions
{
    /// <summary>
    /// The configuration section name.
    /// </summary>
    public const string SectionName = "PlantUml";

    /// <summary>
    /// Gets or sets the Java executable path.
    /// </summary>
    public string JavaExecutablePath { get; set; } = "java";

    /// <summary>
    /// Gets or sets the PlantUML jar path.
    /// </summary>
    public string JarPath { get; set; } = "Vendor/plantuml/plantuml.jar";

    /// <summary>
    /// Gets or sets the C4-PlantUML include directory.
    /// </summary>
    public string IncludePath { get; set; } = "Vendor/c4-plantuml";

    /// <summary>
    /// Gets or sets the per-render timeout in seconds.
    /// </summary>
    public int RenderTimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// Gets or sets the maximum number of concurrent render processes.
    /// </summary>
    public int MaxConcurrentRenders { get; set; } = 4;
}
