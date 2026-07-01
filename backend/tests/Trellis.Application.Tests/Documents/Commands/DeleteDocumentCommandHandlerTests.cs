using Trellis.Application.Common.Exceptions;
using Trellis.Application.Documents.Commands.DeleteDocument;
using Trellis.Application.Tests.Common;
using Trellis.Domain.Entities;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class DeleteDocumentCommandHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_RemovesExistingDocument()
    {
        var documentId = Guid.NewGuid();

        using (var seedContext = this.dbFactory.CreateContext())
        {
            seedContext.Documents.Add(new PlantUmlDocument
            {
                Id = documentId,
                Name = "To delete",
                Content = "@startuml\n@enduml",
                CreatedAt = DateTimeOffset.UtcNow,
            });
            await seedContext.SaveChangesAsync(CancellationToken.None);
        }

        using (var context = this.dbFactory.CreateContext())
        {
            var handler = new DeleteDocumentCommandHandler(context);
            await handler.Handle(new DeleteDocumentCommand { Id = documentId }, CancellationToken.None);
        }

        using (var verifyContext = this.dbFactory.CreateContext())
        {
            Assert.Equal(0, verifyContext.Documents.Count());
        }
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundException_WhenDocumentDoesNotExist()
    {
        using var context = this.dbFactory.CreateContext();
        var handler = new DeleteDocumentCommandHandler(context);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new DeleteDocumentCommand { Id = Guid.NewGuid() },
            CancellationToken.None));
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
