using Trellis.Application.Documents.Queries.GetDocumentById;
using Trellis.Application.Tests.Common;
using Trellis.Domain.Entities;
using Xunit;

namespace Trellis.Application.Tests.Documents.Queries;

public class GetDocumentByIdQueryHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_ReturnsDocument_WhenItExists()
    {
        var documentId = Guid.NewGuid();

        using (var seedContext = this.dbFactory.CreateContext())
        {
            seedContext.Documents.Add(new PlantUmlDocument
            {
                Id = documentId,
                Name = "Existing",
                Content = "@startuml\n@enduml",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await seedContext.SaveChangesAsync(CancellationToken.None);
        }

        using var context = this.dbFactory.CreateContext();
        var handler = new GetDocumentByIdQueryHandler(context);

        var result = await handler.Handle(new GetDocumentByIdQuery { Id = documentId }, CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(documentId, result!.Id);
        Assert.Equal("Existing", result.Name);
    }

    [Fact]
    public async Task Handle_ReturnsNull_WhenDocumentDoesNotExist()
    {
        using var context = this.dbFactory.CreateContext();
        var handler = new GetDocumentByIdQueryHandler(context);

        var result = await handler.Handle(new GetDocumentByIdQuery { Id = Guid.NewGuid() }, CancellationToken.None);

        Assert.Null(result);
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
