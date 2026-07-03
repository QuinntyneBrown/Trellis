using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Trellis.Api.Hubs;
using Trellis.Api.IntegrationTests.Fakes;
using Trellis.Api.Markdown;
using Trellis.Api.Models;
using Trellis.Api.PlantUml;
using Xunit;

namespace Trellis.Api.IntegrationTests.Hubs;

/// <summary>
/// Pins the hub's inline guard messages (which used to live in a FluentValidation
/// validator) and its never-throws contract for expected failure modes.
/// </summary>
public class PlantUmlHubTests
{
    [Fact]
    public async Task RenderDiagram_ReturnsFailure_WhenSourceIsEmpty()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderDiagram(string.Empty);

        Assert.False(result.IsSuccess);
        Assert.Equal("PlantUML source must not be empty.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderDiagram_ReturnsFailure_WhenSourceIsWhitespaceOnly()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderDiagram("   \n\t");

        Assert.False(result.IsSuccess);
        Assert.Equal("PlantUML source must not be empty.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderDiagram_ReturnsFailure_WhenSourceExceedsMaxLength()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderDiagram(new string('a', PlantUmlHub.MaxSourceLength + 1));

        Assert.False(result.IsSuccess);
        Assert.Equal($"PlantUML source must not exceed {PlantUmlHub.MaxSourceLength} characters.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderDiagram_ReturnsTheRendererResult_ForValidSource()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderDiagram("@startuml\nA -> B\n@enduml");

        Assert.True(result.IsSuccess);
        Assert.Equal(FakePlantUmlRenderer.CannedSvg, result.Svg);
    }

    [Fact]
    public async Task RenderDiagram_ReturnsGenericFailure_WhenRendererThrows()
    {
        var hub = CreateHub(new ThrowingRenderer(new InvalidOperationException("boom")));

        var result = await hub.RenderDiagram("@startuml\n@enduml");

        Assert.False(result.IsSuccess);
        Assert.Equal("An unexpected error occurred while rendering the diagram.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderDiagram_ReturnsCancelledFailure_WhenRenderIsCancelled()
    {
        var hub = CreateHub(new ThrowingRenderer(new OperationCanceledException()));

        var result = await hub.RenderDiagram("@startuml\n@enduml");

        Assert.False(result.IsSuccess);
        Assert.Equal("The render was cancelled.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderMarkdown_ReturnsFailure_WhenSourceIsEmpty()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderMarkdown(string.Empty);

        Assert.False(result.IsSuccess);
        Assert.Equal("Markdown source must not be empty.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderMarkdown_ReturnsFailure_WhenSourceIsWhitespaceOnly()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderMarkdown("   \n\t");

        Assert.False(result.IsSuccess);
        Assert.Equal("Markdown source must not be empty.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderMarkdown_ReturnsFailure_WhenSourceExceedsMaxLength()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderMarkdown(new string('a', PlantUmlHub.MaxSourceLength + 1));

        Assert.False(result.IsSuccess);
        Assert.Equal($"Markdown source must not exceed {PlantUmlHub.MaxSourceLength} characters.", result.ErrorMessage);
    }

    [Fact]
    public async Task RenderMarkdown_ReturnsHtmlWithoutSvg_ForValidSource()
    {
        var hub = CreateHub(new FakePlantUmlRenderer());

        var result = await hub.RenderMarkdown("# Heading");

        Assert.True(result.IsSuccess);
        Assert.NotNull(result.Html);
        Assert.Contains("<h1>Heading</h1>", result.Html);
        Assert.Null(result.Svg);
    }

    [Fact]
    public async Task RenderMarkdown_ReturnsGenericFailure_WhenRendererThrows()
    {
        var hub = CreateHub(new FakePlantUmlRenderer(), new ThrowingMarkdownRenderer());

        var result = await hub.RenderMarkdown("# Heading");

        Assert.False(result.IsSuccess);
        Assert.Equal("An unexpected error occurred while rendering the document.", result.ErrorMessage);
    }

    private static PlantUmlHub CreateHub(IPlantUmlRenderer renderer, IMarkdownRenderer? markdownRenderer = null)
    {
        var context = new Mock<HubCallerContext>();
        context.SetupGet(c => c.ConnectionId).Returns("test-connection");
        context.SetupGet(c => c.ConnectionAborted).Returns(CancellationToken.None);

        return new PlantUmlHub(renderer, markdownRenderer ?? new MarkdigMarkdownRenderer(), NullLogger<PlantUmlHub>.Instance)
        {
            Context = context.Object,
        };
    }

    private sealed class ThrowingRenderer : IPlantUmlRenderer
    {
        private readonly Exception exception;

        public ThrowingRenderer(Exception exception)
        {
            this.exception = exception;
        }

        public Task<RenderResult> RenderAsync(string source, CancellationToken cancellationToken)
        {
            return Task.FromException<RenderResult>(this.exception);
        }
    }

    private sealed class ThrowingMarkdownRenderer : IMarkdownRenderer
    {
        public RenderResult Render(string source)
        {
            throw new InvalidOperationException("boom");
        }
    }
}
