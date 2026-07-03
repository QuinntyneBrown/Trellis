using Microsoft.AspNetCore.SignalR;
using Trellis.Api.Markdown;
using Trellis.Api.Models;
using Trellis.Api.PlantUml;

namespace Trellis.Api.Hubs;

/// <summary>
/// SignalR hub exposing strict request-response render operations (PlantUML
/// and markdown). Return values are delivered by SignalR's own invocation
/// correlation - there is no need for <see cref="IHubContext{THub}"/>-based
/// pushing. These methods are the single catch-all boundary on the render
/// path: they never throw for expected failure modes.
/// </summary>
public class PlantUmlHub : Hub
{
    /// <summary>
    /// The maximum number of characters of source accepted for rendering.
    /// </summary>
    public const int MaxSourceLength = 100_000;

    private readonly IPlantUmlRenderer renderer;
    private readonly IMarkdownRenderer markdownRenderer;
    private readonly ILogger<PlantUmlHub> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="PlantUmlHub"/> class.
    /// </summary>
    /// <param name="renderer">The PlantUML renderer.</param>
    /// <param name="markdownRenderer">The markdown renderer.</param>
    /// <param name="logger">The logger.</param>
    public PlantUmlHub(IPlantUmlRenderer renderer, IMarkdownRenderer markdownRenderer, ILogger<PlantUmlHub> logger)
    {
        this.renderer = renderer;
        this.markdownRenderer = markdownRenderer;
        this.logger = logger;
    }

    /// <summary>
    /// Renders the given PlantUML source into SVG. Never throws for expected failure
    /// modes (bad syntax, empty input); those are represented by a
    /// <see cref="RenderResult"/> with <c>IsSuccess</c> set to <see langword="false"/>.
    /// </summary>
    /// <param name="source">The raw PlantUML source to render.</param>
    /// <returns>The render result.</returns>
    public async Task<RenderResult> RenderDiagram(string source)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return RenderResult.Failure("PlantUML source must not be empty.");
        }

        if (source.Length > MaxSourceLength)
        {
            return RenderResult.Failure($"PlantUML source must not exceed {MaxSourceLength} characters.");
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
            return RenderResult.Failure("The render was cancelled.");
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Unhandled exception rendering a diagram for connection {ConnectionId}", this.Context.ConnectionId);
            return RenderResult.Failure("An unexpected error occurred while rendering the diagram.");
        }
    }

    /// <summary>
    /// Renders the given markdown source into sanitized HTML. Mirrors
    /// <see cref="RenderDiagram"/>'s guard behavior, minus the cancellation
    /// branch: Markdig is a synchronous in-process transform with no external
    /// process to cancel or kill.
    /// </summary>
    /// <param name="source">The raw markdown source to render.</param>
    /// <returns>The render result carrying <c>Html</c> on success.</returns>
    public Task<RenderResult> RenderMarkdown(string source)
    {
        if (string.IsNullOrWhiteSpace(source))
        {
            return Task.FromResult(RenderResult.Failure("Markdown source must not be empty."));
        }

        if (source.Length > MaxSourceLength)
        {
            return Task.FromResult(RenderResult.Failure($"Markdown source must not exceed {MaxSourceLength} characters."));
        }

        try
        {
            return Task.FromResult(this.markdownRenderer.Render(source));
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "Unhandled exception rendering markdown for connection {ConnectionId}", this.Context.ConnectionId);
            return Task.FromResult(RenderResult.Failure("An unexpected error occurred while rendering the document."));
        }
    }
}
