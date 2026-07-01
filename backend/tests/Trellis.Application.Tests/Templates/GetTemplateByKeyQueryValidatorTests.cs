using Trellis.Application.Templates.Queries.GetTemplateByKey;
using Xunit;

namespace Trellis.Application.Tests.Templates;

public class GetTemplateByKeyQueryValidatorTests
{
    private readonly GetTemplateByKeyQueryValidator validator = new();

    [Fact]
    public void Validate_Succeeds_WhenKeyIsNotEmpty()
    {
        var result = this.validator.Validate(new GetTemplateByKeyQuery { Key = "c4-context" });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenKeyIsEmpty()
    {
        var result = this.validator.Validate(new GetTemplateByKeyQuery { Key = string.Empty });

        Assert.False(result.IsValid);
    }
}
