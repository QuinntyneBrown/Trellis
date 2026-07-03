using Trellis.Api.Markdown;
using Xunit;

namespace Trellis.Api.IntegrationTests.Markdown;

/// <summary>
/// Pins the markdown renderer's output shape and, above all, its safety
/// model: the rendered HTML is injected into the client preview with
/// Angular's sanitizer bypassed, so raw HTML must come out escaped, unsafe
/// URL schemes must be neutralized, and the GenericAttributes extension
/// (author-controlled attributes = XSS) must stay disabled.
/// </summary>
public class MarkdigMarkdownRendererTests
{
    private readonly MarkdigMarkdownRenderer renderer = new();

    [Fact]
    public void Render_ProducesHeadingsAndEmphasis()
    {
        var result = this.renderer.Render("# Title\n\nSome **bold** text.");

        Assert.True(result.IsSuccess);
        Assert.Null(result.Svg);
        Assert.Contains("<h1>Title</h1>", result.Html);
        Assert.Contains("<strong>bold</strong>", result.Html);
    }

    [Fact]
    public void Render_ProducesPipeTables()
    {
        var result = this.renderer.Render("| a | b |\n| - | - |\n| 1 | 2 |");

        Assert.Contains("<table>", result.Html);
        Assert.Contains("<td>1</td>", result.Html);
    }

    [Fact]
    public void Render_ProducesTaskLists()
    {
        var result = this.renderer.Render("- [x] done\n- [ ] todo");

        Assert.Contains("type=\"checkbox\"", result.Html);
        Assert.Contains("checked=\"checked\"", result.Html);
    }

    [Fact]
    public void Render_EscapesRawHtmlBlocks()
    {
        var result = this.renderer.Render("<script>alert(1)</script>");

        Assert.DoesNotContain("<script>", result.Html);
        Assert.Contains("&lt;script&gt;", result.Html);
    }

    [Fact]
    public void Render_EscapesRawInlineHtml()
    {
        var result = this.renderer.Render("before <img src=x onerror=alert(1)> after");

        Assert.DoesNotContain("<img", result.Html);
        Assert.Contains("&lt;img", result.Html);
    }

    [Fact]
    public void Render_NeutralizesJavascriptUrls()
    {
        var result = this.renderer.Render("[click me](javascript:alert(1))");

        Assert.DoesNotContain("javascript:", result.Html);
        Assert.Contains("href=\"#\"", result.Html);
    }

    [Fact]
    public void Render_NeutralizesDataUrlImages()
    {
        var result = this.renderer.Render("![x](data:text/html;base64,PHNjcmlwdD4=)");

        Assert.DoesNotContain("data:", result.Html);
        Assert.Contains("src=\"#\"", result.Html);
    }

    [Fact]
    public void Render_ExternalLinksOpenInNewTabWithNoopener()
    {
        var result = this.renderer.Render("[docs](https://example.com/docs)");

        Assert.Contains("href=\"https://example.com/docs\"", result.Html);
        Assert.Contains("target=\"_blank\"", result.Html);
        Assert.Contains("rel=\"noopener noreferrer\"", result.Html);
    }

    [Fact]
    public void Render_LeavesRelativeAndFragmentLinksUntouched()
    {
        var result = this.renderer.Render("[a](docs/readme.md) and [b](#section)");

        Assert.Contains("href=\"docs/readme.md\"", result.Html);
        Assert.Contains("href=\"#section\"", result.Html);
        Assert.DoesNotContain("target=", result.Html);
    }

    [Fact]
    public void Render_KeepsGenericAttributesAsLiteralText()
    {
        // Pins the deliberate exclusion of UseAdvancedExtensions(): its
        // GenericAttributes extension would parse this into a live onclick
        // attribute. As plain text it must survive, escaped, in the output.
        var result = this.renderer.Render("# Title {.cls onclick=alert(1)}");

        Assert.DoesNotContain("onclick=\"", result.Html);
        Assert.Contains("onclick=alert(1)", result.Html);
    }

    [Fact]
    public void Render_EscapesFencedCodeAndTagsTheLanguage()
    {
        var result = this.renderer.Render("```html\n<b>not bold</b>\n```");

        Assert.Contains("language-html", result.Html);
        Assert.Contains("&lt;b&gt;not bold&lt;/b&gt;", result.Html);
        Assert.DoesNotContain("<b>not bold</b>", result.Html);
    }
}
