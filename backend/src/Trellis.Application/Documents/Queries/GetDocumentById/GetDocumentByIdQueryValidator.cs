using FluentValidation;

namespace Trellis.Application.Documents.Queries.GetDocumentById;

/// <summary>
/// Validates <see cref="GetDocumentByIdQuery"/>.
/// </summary>
public class GetDocumentByIdQueryValidator : AbstractValidator<GetDocumentByIdQuery>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="GetDocumentByIdQueryValidator"/> class.
    /// </summary>
    public GetDocumentByIdQueryValidator()
    {
        this.RuleFor(query => query.Id)
            .NotEmpty();
    }
}
