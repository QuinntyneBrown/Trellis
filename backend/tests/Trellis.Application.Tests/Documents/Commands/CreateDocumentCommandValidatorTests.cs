using Trellis.Application.Documents.Commands.CreateDocument;
using Xunit;

namespace Trellis.Application.Tests.Documents.Commands;

public class CreateDocumentCommandValidatorTests
{
    private readonly CreateDocumentCommandValidator validator = new();

    [Fact]
    public void Validate_Succeeds_ForValidCommand()
    {
        var result = this.validator.Validate(new CreateDocumentCommand { Name = "Diagram", Content = "@startuml\n@enduml" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenNameIsEmpty()
    {
        var result = this.validator.Validate(new CreateDocumentCommand { Name = string.Empty, Content = "content" });

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, error => error.PropertyName == nameof(CreateDocumentCommand.Name));
    }

    [Fact]
    public void Validate_Fails_WhenNameExceedsMaxLength()
    {
        var result = this.validator.Validate(new CreateDocumentCommand { Name = new string('a', 201), Content = "content" });

        Assert.False(result.IsValid);
    }
}
