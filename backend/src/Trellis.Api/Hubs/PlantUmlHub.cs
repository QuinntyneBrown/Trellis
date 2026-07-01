using MediatR;
using Microsoft.AspNetCore.SignalR;
using Trellis.Application.Common.Models;
using Trellis.Application.Rendering.Commands.RenderDiagram;
using ValidationException = Trellis.Application.Common.Exceptions.ValidationException;

namespace Trellis.Api.Hubs;

/// <summary>
/// SignalR hub exposing a single strict request-response render operation. The
/// return value is delivered by SignalR's own invocation correlation - there is no
/// need for <see cref="IHubContext{THub}"/>-based pushing.
/// </summary>
public class PlantUmlHub : Hub
{
    private readonly ISender mediator;
    private readonly ILogger<PlantUmlHub> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlantUmlHub"/> class.
    /// </summary>
    /// <param name="mediator">The MediatR sender.</param>
    /// <param name="logger">The logger.</param>
    public PlantUmlHub(ISender mediator, ILogger<PlantUmlHub> logger)
    {
        this.mediator = mediator;
        this.logger = logger;
    }

    /// <summary>
    /// Renders the given PlantUML source into SVG. Never throws for expected failure
    /// modes (bad syntax, empty input); those are represented by a
    /// <see cref="PlantUmlRenderResult"/> with <c>IsSuccess</c> set to <see langword="false"/>.
    /// </summary>
    /// <param name="source">The raw PlantUML source to render.</param>
    /// <returns>The render result.</returns>
    public async Task<PlantUmlRenderResult> RenderDiagram(string source)
    {
        try
        {
            var command = new RenderDiagramCommand { Source = source, CorrelationId = this.Context.ConnectionId };
            return await this.mediator.Send(command);
        }
        catch (ValidationException validationException)
        {
            var message = string.Join(" ", validationException.Errors.Values.SelectMany(errors => errors));
            return PlantUmlRenderResult.Failure(message);
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Unhandled exception rendering a diagram for connection {ConnectionId}", this.Context.ConnectionId);
            return PlantUmlRenderResult.Failure("An unexpected error occurred while rendering the diagram.");
        }
    }
}
