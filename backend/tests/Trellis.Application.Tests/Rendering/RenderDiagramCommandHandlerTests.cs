using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Application.Rendering.Commands.RenderDiagram;
using Xunit;

namespace Trellis.Application.Tests.Rendering;

public class RenderDiagramCommandHandlerTests
{
    [Fact]
    public async Task Handle_DelegatesToRenderer_AndReturnsItsResult()
    {
        var rendererMock = new Mock<IPlantUmlRenderer>();
        rendererMock
            .Setup(renderer => renderer.RenderAsync("@startuml\n@enduml", It.IsAny<CancellationToken>()))
            .ReturnsAsync(PlantUmlRenderResult.Success("<svg></svg>"));

        var handler = new RenderDiagramCommandHandler(rendererMock.Object, NullLogger<RenderDiagramCommandHandler>.Instance);

        var result = await handler.Handle(
            new RenderDiagramCommand { Source = "@startuml\n@enduml", CorrelationId = "connection-1" },
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("<svg></svg>", result.Svg);
        rendererMock.Verify(renderer => renderer.RenderAsync("@startuml\n@enduml", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ReturnsFailure_WhenRendererReportsFailure()
    {
        var rendererMock = new Mock<IPlantUmlRenderer>();
        rendererMock
            .Setup(renderer => renderer.RenderAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(PlantUmlRenderResult.Failure("boom"));

        var handler = new RenderDiagramCommandHandler(rendererMock.Object, NullLogger<RenderDiagramCommandHandler>.Instance);

        var result = await handler.Handle(new RenderDiagramCommand { Source = "bad" }, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal("boom", result.ErrorMessage);
    }
}
