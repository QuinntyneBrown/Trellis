using Trellis.Application.Documents.Commands.DeleteDocument;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class DeleteDocumentCommandValidatorTests
{
    private readonly DeleteDocumentCommandValidator validator = new();

    [Fact]
    public void Validate_Succeeds_WhenIdIsNotEmpty()
    {
        var result = this.validator.Validate(new DeleteDocumentCommand { Id = Guid.NewGuid() });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenIdIsEmpty()
    {
        var result = this.validator.Validate(new DeleteDocumentCommand { Id = Guid.Empty });

        Assert.False(result.IsValid);
    }
}
