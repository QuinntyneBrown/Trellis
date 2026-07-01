using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Rendering.Commands.RenderDiagram;

/// <summary>
/// Command to render a PlantUML source string into SVG.
/// </summary>
public record RenderDiagramCommand : IRequest<PlantUmlRenderResult>
{
    /// <summary>
    /// Gets the raw PlantUML source to render.
    /// </summary>
    public required string Source { get; init; }

    /// <summary>
    /// Gets an optional correlation identifier (for example, a SignalR connection id),
    /// used only for logging - it plays no role in response delivery.
    /// </summary>
    public string? CorrelationId { get; init; }
}
