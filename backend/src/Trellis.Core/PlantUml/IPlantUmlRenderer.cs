namespace Trellis.Core.PlantUml;

/// <summary>
/// Renders PlantUML source into a requested output format.
/// </summary>
public interface IPlantUmlRenderer
{
    /// <summary>
    /// Renders PlantUML source into the requested format.
    /// </summary>
    /// <param name="source">The raw PlantUML source text.</param>
    /// <param name="outputFormat">The requested output format.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The render result.</returns>
    Task<PlantUmlRenderResult> RenderAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken);
}
