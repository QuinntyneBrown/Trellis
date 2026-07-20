using Trellis.Api.Markdown;
using Trellis.Api.Models;

namespace Trellis.Api.IntegrationTests.Fakes;

/// <summary>
/// Markdown renderer test double that always throws.
/// </summary>
public sealed class ThrowingMarkdownRenderer : IMarkdownRenderer
{
    /// <inheritdoc />
    public RenderResult Render(string source)
    {
        throw new InvalidOperationException("boom");
    }
}
