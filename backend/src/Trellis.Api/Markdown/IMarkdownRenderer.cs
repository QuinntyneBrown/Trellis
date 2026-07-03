using Trellis.Api.Models;

namespace Trellis.Api.Markdown;

/// <summary>
/// Renders markdown source into sanitized HTML. Synchronous by design:
/// unlike the PlantUML renderer there is no external process, no I/O, and
/// no meaningful cancellation point -- Markdig is a pure CPU-bound
/// transform that completes in milliseconds.
/// </summary>
public interface IMarkdownRenderer
{
    /// <summary>
    /// Renders the given markdown source into HTML that is safe to inject
    /// into the client's preview pane.
    /// </summary>
    /// <param name="source">The raw markdown source.</param>
    /// <returns>The render result carrying <c>Html</c> on success.</returns>
    RenderResult Render(string source);
}
