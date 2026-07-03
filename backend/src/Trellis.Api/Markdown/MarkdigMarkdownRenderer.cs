using Markdig;
using Markdig.Renderers;
using Markdig.Renderers.Html;
using Markdig.Syntax;
using Markdig.Syntax.Inlines;
using Trellis.Api.Models;

namespace Trellis.Api.Markdown;

/// <summary>
/// Markdig-based markdown renderer whose output is safe by construction for
/// the client's sanitizer-bypassing preview injection.
///
/// The safety model, in order of importance:
/// <list type="number">
/// <item><description><c>DisableHtml()</c> -- raw HTML blocks/inlines in the
/// source are emitted as escaped literal text, so the only tags in the
/// output are ones Markdig itself generates (with all text and attribute
/// content HTML-escaped by its renderer).</description></item>
/// <item><description>Deliberately NOT <c>UseAdvancedExtensions()</c> -- that
/// bundle includes GenericAttributes (<c>{#id .class onclick=...}</c>),
/// which hands authors arbitrary attribute injection, i.e. XSS. Only the
/// specific benign extensions below are enabled. A test pins this.</description></item>
/// <item><description>A post-parse URL walk -- the one author-controlled
/// attribute Markdig emits unescaped-by-meaning is link/image URLs, so
/// anything that is not http(s), mailto, relative, or a fragment (e.g.
/// <c>javascript:</c>, <c>data:</c>, <c>file:</c>) is neutralized to
/// <c>#</c>. External links additionally open in a new tab with
/// <c>rel="noopener noreferrer"</c> so a preview click never navigates the
/// editor away.</description></item>
/// </list>
/// </summary>
public class MarkdigMarkdownRenderer : IMarkdownRenderer
{
    private static readonly string[] AllowedAbsoluteSchemes = { "http", "https", "mailto" };

    private readonly MarkdownPipeline pipeline = new MarkdownPipelineBuilder()
        .DisableHtml()
        .UsePipeTables()
        .UseTaskLists()
        .UseAutoLinks()
        .UseEmphasisExtras()
        .UseListExtras()
        .Build();

    /// <inheritdoc />
    public RenderResult Render(string source)
    {
        var document = Markdig.Markdown.Parse(source, this.pipeline);

        foreach (var inline in document.Descendants())
        {
            switch (inline)
            {
                case LinkInline link:
                    SanitizeLink(link);
                    break;
                case AutolinkInline autolink when !IsSafeUrl(autolink.Url):
                    // Cannot rewrite an autolink's text; drop it to a dead anchor.
                    autolink.Url = "#";
                    break;
            }
        }

        using var writer = new StringWriter();
        var renderer = new HtmlRenderer(writer);
        this.pipeline.Setup(renderer);
        renderer.Render(document);
        writer.Flush();

        return RenderResult.SuccessHtml(writer.ToString());
    }

    private static void SanitizeLink(LinkInline link)
    {
        if (!IsSafeUrl(link.Url))
        {
            link.Url = "#";
            return;
        }

        // External non-image links open in a new tab: the preview lives
        // inside the editor SPA and a plain navigation would discard it.
        if (!link.IsImage
            && Uri.TryCreate(link.Url, UriKind.Absolute, out var absolute)
            && absolute.Scheme is "http" or "https")
        {
            var attributes = link.GetAttributes();
            attributes.AddProperty("target", "_blank");
            attributes.AddProperty("rel", "noopener noreferrer");
        }
    }

    /// <summary>
    /// Allows http(s)/mailto absolute URLs, relative paths, and #fragments.
    /// Everything else (javascript:, data:, vbscript:, file: -- including
    /// protocol-relative //host, which .NET parses as file-scheme) is unsafe.
    /// </summary>
    private static bool IsSafeUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return false;
        }

        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var absolute))
        {
            // Relative path or fragment -- resolves within the app's own origin.
            return true;
        }

        return AllowedAbsoluteSchemes.Contains(absolute.Scheme, StringComparer.OrdinalIgnoreCase);
    }
}
