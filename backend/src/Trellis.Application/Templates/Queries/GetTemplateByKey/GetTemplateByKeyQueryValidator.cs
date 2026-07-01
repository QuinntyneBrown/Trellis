using FluentValidation;

namespace Trellis.Application.Templates.Queries.GetTemplateByKey;

/// <summary>
/// Validates <see cref="GetTemplateByKeyQuery"/>.
/// </summary>
public class GetTemplateByKeyQueryValidator : AbstractValidator<GetTemplateByKeyQuery>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="GetTemplateByKeyQueryValidator"/> class.
    /// </summary>
    public GetTemplateByKeyQueryValidator()
    {
        this.RuleFor(query => query.Key)
            .NotEmpty();
    }
}
