using Trellis.Application.Common.Exceptions;
using Trellis.Application.Documents.Commands.UploadDocument;
using Trellis.Application.Tests.Common;
using Trellis.Domain.Entities;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class UploadDocumentCommandHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_CreatesNewDocument_WhenDocumentIdIsNull()
    {
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);

        using var context = this.dbFactory.CreateContext();
        var handler = new UploadDocumentCommandHandler(context, new TestDateTimeProvider(now));

        var result = await handler.Handle(
            new UploadDocumentCommand { DocumentId = null, FileName = "uploaded", Content = "@startuml\n@enduml" },
            CancellationToken.None);

        Assert.NotEqual(Guid.Empty, result.Id);
        Assert.Equal("uploaded", result.Name);
        Assert.Equal(now, result.CreatedAt);
        Assert.Null(result.UpdatedAt);
    }

    [Fact]
    public async Task Handle_ReplacesContent_WhenDocumentIdMatchesExistingDocument()
    {
        var documentId = Guid.NewGuid();
        var createdAt = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var uploadedAt = createdAt.AddHours(2);

        using (var seedContext = this.dbFactory.CreateContext())
        {
            seedContext.Documents.Add(new PlantUmlDocument
            {
                Id = documentId,
                Name = "Existing name",
                Content = "old content",
                CreatedAt = createdAt,
            });
            await seedContext.SaveChangesAsync(CancellationToken.None);
        }

        using (var context = this.dbFactory.CreateContext())
        {
            var handler = new UploadDocumentCommandHandler(context, new TestDateTimeProvider(uploadedAt));

            var result = await handler.Handle(
                new UploadDocumentCommand { DocumentId = documentId, FileName = "ignored", Content = "new content" },
                CancellationToken.None);

            Assert.Equal(documentId, result.Id);
            Assert.Equal("Existing name", result.Name);
            Assert.Equal("new content", result.Content);
            Assert.Equal(uploadedAt, result.UpdatedAt);
        }
    }

    [Fact]
    public async Task Handle_ThrowsNotFoundException_WhenDocumentIdDoesNotExist()
    {
        using var context = this.dbFactory.CreateContext();
        var handler = new UploadDocumentCommandHandler(context, new TestDateTimeProvider(DateTimeOffset.UtcNow));

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new UploadDocumentCommand { DocumentId = Guid.NewGuid(), FileName = "file", Content = "content" },
            CancellationToken.None));
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
