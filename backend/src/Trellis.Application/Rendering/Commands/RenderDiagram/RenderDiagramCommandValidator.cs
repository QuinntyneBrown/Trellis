using FluentValidation;

namespace Trellis.Application.Rendering.Commands.RenderDiagram;

/// <summary>
/// Validates <see cref="RenderDiagramCommand"/>.
/// </summary>
public class RenderDiagramCommandValidator : AbstractValidator<RenderDiagramCommand>
{
    /// <summary>
    /// The maximum number of characters of PlantUML source accepted for rendering.
    /// </summary>
    public const int MaxSourceLength = 100_000;

    /// <summary>
    /// Initializes a new instance of the <see cref="RenderDiagramCommandValidator"/> class.
    /// </summary>
    public RenderDiagramCommandValidator()
    {
        this.RuleFor(command => command.Source)
            .NotEmpty().WithMessage("PlantUML source must not be empty.")
            .MaximumLength(MaxSourceLength).WithMessage($"PlantUML source must not exceed {MaxSourceLength} characters.");
    }
}
