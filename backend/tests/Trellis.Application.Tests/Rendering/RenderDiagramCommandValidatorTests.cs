using Trellis.Application.Rendering.Commands.RenderDiagram;
using Xunit;

namespace Trellis.Application.Tests.Rendering;

public class RenderDiagramCommandValidatorTests
{
    private readonly RenderDiagramCommandValidator validator = new();

    [Fact]
    public void Validate_Succeeds_ForNonEmptySource()
    {
        var result = this.validator.Validate(new RenderDiagramCommand { Source = "@startuml\n@enduml" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenSourceIsEmpty()
    {
        var result = this.validator.Validate(new RenderDiagramCommand { Source = string.Empty });

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenSourceExceedsMaxLength()
    {
        var tooLong = new string('a', RenderDiagramCommandValidator.MaxSourceLength + 1);

        var result = this.validator.Validate(new RenderDiagramCommand { Source = tooLong });

        Assert.False(result.IsValid);
    }
}
