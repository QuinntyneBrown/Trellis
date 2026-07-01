using MediatR;
using Microsoft.Extensions.Logging;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Rendering.Commands.RenderDiagram;

/// <summary>
/// Handles <see cref="RenderDiagramCommand"/>.
/// </summary>
public class RenderDiagramCommandHandler : IRequestHandler<RenderDiagramCommand, PlantUmlRenderResult>
{
    private readonly IPlantUmlRenderer renderer;
    private readonly ILogger<RenderDiagramCommandHandler> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="RenderDiagramCommandHandler"/> class.
    /// </summary>
    /// <param name="renderer">The PlantUML renderer.</param>
    /// <param name="logger">The logger.</param>
    public RenderDiagramCommandHandler(IPlantUmlRenderer renderer, ILogger<RenderDiagramCommandHandler> logger)
    {
        this.renderer = renderer;
        this.logger = logger;
    }

    /// <inheritdoc />
    public async Task<PlantUmlRenderResult> Handle(RenderDiagramCommand request, CancellationToken cancellationToken)
    {
        this.logger.LogDebug("Rendering diagram for correlation id {CorrelationId}", request.CorrelationId);

        return await this.renderer.RenderAsync(request.Source, cancellationToken);
    }
}
