using Trellis.Api.Explain;

namespace Trellis.Api.IntegrationTests.Explain;

/// <summary>
/// Pins the GetFiles-style stripping behavior: comments removed with string
/// literals protected, unquoted URLs surviving, and blank lines dropped.
/// </summary>
public class SourceCodeStripperTests
{
    [Fact]
    public void Strips_LineAndBlockComments_FromTypeScript()
    {
        var stripped = SourceCodeStripper.Strip("const a = 1; // trailing\n/* block\ncomment */\nconst b = 2;\n", "src/x.ts");

        Assert.Equal("const a = 1;\nconst b = 2;", stripped);
    }

    [Fact]
    public void Preserves_CommentLikeSequences_InsideStringLiterals()
    {
        var stripped = SourceCodeStripper.Strip("const url = \"http://example.com//path\"; // real comment\n", "src/x.ts");

        Assert.Equal("const url = \"http://example.com//path\";", stripped);
    }

    [Fact]
    public void Preserves_UnquotedUrls_InCss()
    {
        var stripped = SourceCodeStripper.Strip(".a { background: url(http://example.com/i.png); } /* gone */\n", "styles.css");

        Assert.Equal(".a { background: url(http://example.com/i.png); }", stripped);
    }

    [Fact]
    public void Strips_HtmlComments_AndBlankLines()
    {
        var stripped = SourceCodeStripper.Strip("<div>\n  <!-- a comment -->\n  <span>hi</span>\n</div>\n", "app.html");

        Assert.Equal("<div>\n  <span>hi</span>\n</div>", stripped);
    }

    [Fact]
    public void LeavesJsonCommentless_ButCollapsesWhitespace()
    {
        var stripped = SourceCodeStripper.Strip("{\n  \"a\": 1,\n\n  \"b\": \"// not a comment\"\n}\n", "package.json");

        Assert.Equal("{\n  \"a\": 1,\n  \"b\": \"// not a comment\"\n}", stripped);
    }
}
