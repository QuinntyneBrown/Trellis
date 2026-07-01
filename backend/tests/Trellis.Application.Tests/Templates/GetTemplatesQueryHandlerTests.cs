using Moq;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Application.Templates.Queries.GetTemplates;
using Xunit;

namespace Trellis.Application.Tests.Templates;

public class GetTemplatesQueryHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsEveryTemplateFromTheCatalog()
    {
        var templates = new List<TemplateDto>
        {
            new() { Key = "blank", Name = "Blank", Category = "General", Content = "@startuml\n@enduml" },
            new() { Key = "c4-context", Name = "C4 - Context", Category = "C4", Content = "@startuml\n@enduml" },
        };

        var catalogMock = new Mock<ITemplateCatalog>();
        catalogMock.Setup(catalog => catalog.GetAll()).Returns(templates);

        var handler = new GetTemplatesQueryHandler(catalogMock.Object);

        var result = await handler.Handle(new GetTemplatesQuery(), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Same(templates, result);
    }
}
