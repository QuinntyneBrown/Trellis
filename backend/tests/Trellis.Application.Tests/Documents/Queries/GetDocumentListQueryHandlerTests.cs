using Trellis.Application.Documents.Queries.GetDocumentList;
using Trellis.Application.Tests.Common;
using Trellis.Domain.Entities;
using Xunit;

namespace Trellis.Application.Tests.Documents.Queries;

public class GetDocumentListQueryHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_ReturnsDocumentsOrderedByMostRecentlyTouchedFirst()
    {
        var older = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var newer = older.AddDays(5);

        using (var seedContext = this.dbFactory.CreateContext())
        {
            seedContext.Documents.AddRange(
                new PlantUmlDocument { Id = Guid.NewGuid(), Name = "Never updated", Content = "c", CreatedAt = older, UpdatedAt = null },
                new PlantUmlDocument { Id = Guid.NewGuid(), Name = "Updated recently", Content = "c", CreatedAt = older, UpdatedAt = newer });
            await seedContext.SaveChangesAsync(CancellationToken.None);
        }

        using var context = this.dbFactory.CreateContext();
        var handler = new GetDocumentListQueryHandler(context);

        var result = await handler.Handle(new GetDocumentListQuery(), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Equal("Updated recently", result[0].Name);
        Assert.Equal(newer, result[0].UpdatedAt);
        Assert.Equal("Never updated", result[1].Name);

        // A document that has never been updated falls back to its creation time,
        // so the list always has a non-null "last touched" timestamp.
        Assert.Equal(older, result[1].UpdatedAt);
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
