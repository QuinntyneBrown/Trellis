using FluentValidation;

namespace Trellis.Application.Documents.Commands.DeleteDocument;

/// <summary>
/// Validates <see cref="DeleteDocumentCommand"/>.
/// </summary>
public class DeleteDocumentCommandValidator : AbstractValidator<DeleteDocumentCommand>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteDocumentCommandValidator"/> class.
    /// </summary>
    public DeleteDocumentCommandValidator()
    {
        this.RuleFor(command => command.Id)
            .NotEmpty();
    }
}
