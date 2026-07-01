using Trellis.Application.Documents.Commands.UpdateDocument;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class UpdateDocumentCommandValidatorTests
{
    private readonly UpdateDocumentCommandValidator validator = new();

    [Fact]
    public void Validate_Succeeds_ForValidCommand()
    {
        var result = this.validator.Validate(new UpdateDocumentCommand { Id = Guid.NewGuid(), Name = "Diagram", Content = "content" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenIdIsEmpty()
    {
        var result = this.validator.Validate(new UpdateDocumentCommand { Id = Guid.Empty, Name = "Diagram", Content = "content" });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(UpdateDocumentCommand.Id));
    }

    [Fact]
    public void Validate_Fails_WhenNameIsEmpty()
    {
        var result = this.validator.Validate(new UpdateDocumentCommand { Id = Guid.NewGuid(), Name = string.Empty, Content = "content" });

        Assert.False(result.IsValid);
    }
}
