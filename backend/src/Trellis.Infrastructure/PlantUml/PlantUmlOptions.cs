namespace Trellis.Infrastructure.PlantUml;

/// <summary>
/// Configuration options for invoking the vendored PlantUML jar via a local JVM.
/// </summary>
public class PlantUmlOptions
{
    /// <summary>
    /// The configuration section name these options are bound from.
    /// </summary>
    public const string SectionName = "PlantUml";

    /// <summary>
    /// Gets or sets the path to the java executable. Defaults to "java", relying on it
    /// being resolvable via the PATH environment variable.
    /// </summary>
    public string JavaExecutablePath { get; set; } = "java";

    /// <summary>
    /// Gets or sets the absolute or relative path to the vendored plantuml.jar file.
    /// </summary>
    public string JarPath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the absolute or relative path to the vendored C4-PlantUML include folder.
    /// </summary>
    public string IncludePath { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets the maximum number of seconds to wait for a single render before
    /// treating it as a failure and killing the process tree.
    /// </summary>
    public int RenderTimeoutSeconds { get; set; } = 10;

    /// <summary>
    /// Gets or sets the maximum number of PlantUML render processes allowed to run
    /// concurrently.
    /// </summary>
    public int MaxConcurrentRenders { get; set; } = 4;
}
