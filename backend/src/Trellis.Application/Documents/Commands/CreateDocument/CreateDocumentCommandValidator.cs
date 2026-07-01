using FluentValidation;

namespace Trellis.Application.Documents.Commands.CreateDocument;

/// <summary>
/// Validates <see cref="CreateDocumentCommand"/>.
/// </summary>
public class CreateDocumentCommandValidator : AbstractValidator<CreateDocumentCommand>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="CreateDocumentCommandValidator"/> class.
    /// </summary>
    public CreateDocumentCommandValidator()
    {
        this.RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(200);

        this.RuleFor(command => command.Content)
            .NotNull();
    }
}
