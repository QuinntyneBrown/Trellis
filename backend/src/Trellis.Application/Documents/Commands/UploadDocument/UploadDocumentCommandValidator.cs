using FluentValidation;

namespace Trellis.Application.Documents.Commands.UploadDocument;

/// <summary>
/// Validates <see cref="UploadDocumentCommand"/>.
/// </summary>
public class UploadDocumentCommandValidator : AbstractValidator<UploadDocumentCommand>
{
    /// <summary>
    /// Initializes a new instance of the <see cref="UploadDocumentCommandValidator"/> class.
    /// </summary>
    public UploadDocumentCommandValidator()
    {
        this.RuleFor(command => command.FileName)
            .NotEmpty()
            .MaximumLength(200);

        this.RuleFor(command => command.Content)
            .NotNull();

        this.RuleFor(command => command.DocumentId)
            .NotEqual(Guid.Empty)
            .When(command => command.DocumentId.HasValue);
    }
}
