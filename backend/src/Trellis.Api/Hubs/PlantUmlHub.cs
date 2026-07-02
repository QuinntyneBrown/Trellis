using Microsoft.AspNetCore.SignalR;
using Trellis.Api.Models;
using Trellis.Api.PlantUml;

namespace Trellis.Api.Hubs;

/// <summary>
/// SignalR hub exposing a single strict request-response render operation. The
/// return value is delivered by SignalR's own invocation correlation - there is no
/// need for <see cref="IHubContext{THub}"/>-based pushing. This method is the single
/// catch-all boundary on the render path: it never throws for expected failure modes.
/// </summary>
public class PlantUmlHub : Hub
{
    /// <summary>
    /// The maximum number of characters of PlantUML source accepted for rendering.
    /// </summary>
    public const int MaxSourceLength = 100_000;

    private readonly IPlantUmlRenderer renderer;
    private readonly ILogger<PlantUmlHub> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlantUmlHub"/> class.
    /// </summary>
    /// <param name="renderer">The PlantUML renderer.</param>
    /// <param name="logger">The logger.</param>
    public PlantUmlHub(IPlantUmlRenderer renderer, ILogger<PlantUmlHub> logger)
    {
        this.renderer = renderer;
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
        if (string.IsNullOrWhiteSpace(source))
        {
            return PlantUmlRenderResult.Failure("PlantUML source must not be empty.");
        }

        if (source.Length > MaxSourceLength)
        {
            return PlantUmlRenderResult.Failure($"PlantUML source must not exceed {MaxSourceLength} characters.");
        }

        try
        {
            // ConnectionAborted (not a hub-method CancellationToken parameter, which
            // net8.0 SignalR only binds for streaming methods) is what lets a render
            // for a disconnected client cancel and kill its java process.
            return await this.renderer.RenderAsync(source, this.Context.ConnectionAborted);
        }
        catch (OperationCanceledException)
        {
            // A routine client disconnect mid-render; the client is gone, so the
            // result is never delivered - not an error worth logging.
            return PlantUmlRenderResult.Failure("The render was cancelled.");
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Unhandled exception rendering a diagram for connection {ConnectionId}", this.Context.ConnectionId);
            return PlantUmlRenderResult.Failure("An unexpected error occurred while rendering the diagram.");
        }
    }
}
