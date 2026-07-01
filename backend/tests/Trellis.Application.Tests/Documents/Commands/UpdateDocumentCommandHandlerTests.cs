using Trellis.Application.Common.Exceptions;
using Trellis.Application.Documents.Commands.UpdateDocument;
using Trellis.Application.Tests.Common;
using Trellis.Domain.Entities;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class UpdateDocumentCommandHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_UpdatesExistingDocument()
    {
        var documentId = Guid.NewGuid();
        var createdAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var updatedAt = createdAt.AddDays(1);

        using (var seedContext = this.dbFactory.CreateContext())
        {
            seedContext.Documents.Add(new PlantUmlDocument
            {
                Id = documentId,
                Name = "Original",
                Content = "@startuml\n@enduml",
                CreatedAt = createdAt,
            });
            await seedContext.SaveChangesAsync(CancellationToken.None);
        }

        using (var context = this.dbFactory.CreateContext())
        {
            var handler = new UpdateDocumentCommandHandler(context, new TestDateTimeProvider(updatedAt));

            var result = await handler.Handle(
                new UpdateDocumentCommand { Id = documentId, Name = "Renamed", Content = "new content" },
                CancellationToken.None);

            Assert.Equal(documentId, result.Id);
            Assert.Equal("Renamed", result.Name);
            Assert.Equal("new content", result.Content);
            Assert.Equal(createdAt, result.CreatedAt);
            Assert.Equal(updatedAt, result.UpdatedAt);
        }
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundException_WhenDocumentDoesNotExist()
    {
        using var context = this.dbFactory.CreateContext();
        var handler = new UpdateDocumentCommandHandler(context, new TestDateTimeProvider(DateTimeOffset.UtcNow));

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new UpdateDocumentCommand { Id = Guid.NewGuid(), Name = "Renamed", Content = "content" },
            CancellationToken.None));
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
