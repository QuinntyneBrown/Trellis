using Trellis.Api.Models;

namespace Trellis.Api.PlantUml;

/// <summary>
/// Renders PlantUML source into SVG markup. Kept as an interface (rather than the
/// concrete <see cref="PlantUmlRenderer"/>) so integration tests can substitute a
/// fake and run without a JVM.
/// </summary>
public interface IPlantUmlRenderer
{
    /// <summary>
    /// Renders the given PlantUML source into SVG.
    /// </summary>
    /// <param name="source">The raw PlantUML source text.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>A <see cref="PlantUmlRenderResult"/> describing the outcome.</returns>
    Task<PlantUmlRenderResult> RenderAsync(string source, CancellationToken cancellationToken);
}
