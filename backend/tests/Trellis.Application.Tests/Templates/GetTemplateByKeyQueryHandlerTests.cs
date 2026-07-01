using Moq;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Application.Templates.Queries.GetTemplateByKey;
using Xunit;

namespace Trellis.Application.Tests.Templates;

public class GetTemplateByKeyQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTemplate_WhenKeyExists()
    {
        var template = new TemplateDto { Key = "c4-context", Name = "C4 - Context", Category = "C4", Content = "@startuml\n@enduml" };

        var catalogMock = new Mock<ITemplateCatalog>();
        catalogMock.Setup(catalog => catalog.GetByKey("c4-context")).Returns(template);

        var handler = new GetTemplateByKeyQueryHandler(catalogMock.Object);

        var result = await handler.Handle(new GetTemplateByKeyQuery { Key = "c4-context" }, CancellationToken.None);

        Assert.Same(template, result);
    }

    [Fact]
    public async Task Handle_ReturnsNull_WhenKeyDoesNotExist()
    {
        var catalogMock = new Mock<ITemplateCatalog>();
        catalogMock.Setup(catalog => catalog.GetByKey(It.IsAny<string>())).Returns((TemplateDto?)null);

        var handler = new GetTemplateByKeyQueryHandler(catalogMock.Object);

        var result = await handler.Handle(new GetTemplateByKeyQuery { Key = "missing" }, CancellationToken.None);

        Assert.Null(result);
    }
}
