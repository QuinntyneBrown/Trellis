using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Commands.CreateDocument;

/// <summary>
/// Command to create a new PlantUML document.
/// </summary>
public record CreateDocumentCommand : IRequest<DocumentDto>
{
    /// <summary>
    /// Gets the display name of the new document.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the initial PlantUML source content.
    /// </summary>
    public required string Content { get; init; }
}
