using Trellis.Application.Documents.Commands.CreateDocument;
using Trellis.Application.Tests.Common;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class CreateDocumentCommandHandlerTests : IDisposable
{
    private readonly SqliteInMemoryDbContextFactory dbFactory = new();

    [Fact]
    public async Task Handle_PersistsAndReturnsNewDocument()
    {
        var now = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var dateTimeProvider = new TestDateTimeProvider(now);

        using (var context = this.dbFactory.CreateContext())
        {
            var handler = new CreateDocumentCommandHandler(context, dateTimeProvider);

            var result = await handler.Handle(
                new CreateDocumentCommand { Name = "My Diagram", Content = "@startuml\n@enduml" },
                CancellationToken.None);

            Assert.NotEqual(Guid.Empty, result.Id);
            Assert.Equal("My Diagram", result.Name);
            Assert.Equal("@startuml\n@enduml", result.Content);
            Assert.Equal(now, result.CreatedAt);
            Assert.Null(result.UpdatedAt);
        }

        using (var verifyContext = this.dbFactory.CreateContext())
        {
            Assert.Equal(1, verifyContext.Documents.Count());
        }
    }

    public void Dispose()
    {
        this.dbFactory.Dispose();
    }
}
