using Trellis.Application.Documents.Queries.GetDocumentById;
using Xunit;

namespace Trellis.Application.Tests.Documents.Queries;

public class GetDocumentByIdQueryValidatorTests
{
    private readonly GetDocumentByIdQueryValidator validator = new();

    [Fact]
    public void Validate_Succeeds_WhenIdIsNotEmpty()
    {
        var result = this.validator.Validate(new GetDocumentByIdQuery { Id = Guid.NewGuid() });

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Validate_Fails_WhenIdIsEmpty()
    {
        var result = this.validator.Validate(new GetDocumentByIdQuery { Id = Guid.Empty });

        Assert.False(result.IsValid);
    }
}
