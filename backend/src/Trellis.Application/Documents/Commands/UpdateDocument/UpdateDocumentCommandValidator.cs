using FluentValidation;

namespace Trellis.Application.Documents.Commands.UpdateDocument;

/// <summary>
/// Validates <see cref="UpdateDocumentCommand"/>.
/// </summary>
public class UpdateDocumentCommandValidator : AbstractValidator<UpdateDocumentCommand>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateDocumentCommandValidator"/> class.
    /// </summary>
    public UpdateDocumentCommandValidator()
    {
        this.RuleFor(command => command.Id)
            .NotEmpty();

        this.RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(200);

        this.RuleFor(command => command.Content)
            .NotNull();
    }
}
