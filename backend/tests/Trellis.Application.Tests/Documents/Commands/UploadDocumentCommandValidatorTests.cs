using Trellis.Application.Documents.Commands.UploadDocument;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class UploadDocumentCommandValidatorTests
{
    private readonly UploadDocumentCommandValidator validator = new();

    [Fact]
    public void Validate_Succeeds_ForValidCommandWithoutDocumentId()
    {
        var result = this.validator.Validate(new UploadDocumentCommand { DocumentId = null, FileName = "diagram", Content = "content" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Succeeds_ForValidCommandWithDocumentId()
    {
        var result = this.validator.Validate(new UploadDocumentCommand { DocumentId = Guid.NewGuid(), FileName = "diagram", Content = "content" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenDocumentIdIsEmptyGuid()
    {
        var result = this.validator.Validate(new UploadDocumentCommand { DocumentId = Guid.Empty, FileName = "diagram", Content = "content" });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenFileNameIsEmpty()
    {
        var result = this.validator.Validate(new UploadDocumentCommand { DocumentId = null, FileName = string.Empty, Content = "content" });

        Assert.False(result.IsValid);
    }
}
