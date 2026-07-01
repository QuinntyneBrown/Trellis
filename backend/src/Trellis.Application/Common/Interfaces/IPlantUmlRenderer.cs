using Trellis.Application.Common.Models;

namespace Trellis.Application.Common.Interfaces;

/// <summary>
/// Port for rendering PlantUML source into SVG markup. Implemented by the Infrastructure layer.
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
