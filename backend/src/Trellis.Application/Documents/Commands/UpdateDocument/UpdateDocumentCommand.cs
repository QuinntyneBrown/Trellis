using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Commands.UpdateDocument;

/// <summary>
/// Command to update an existing PlantUML document. The route id always wins over
/// any id that might otherwise be supplied in a request body.
/// </summary>
public record UpdateDocumentCommand : IRequest<DocumentDto>
{
    /// <summary>
    /// Gets the identifier of the document to update.
    /// </summary>
    public required Guid Id { get; init; }

    /// <summary>
    /// Gets the new display name of the document.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the new PlantUML source content.
    /// </summary>
    public required string Content { get; init; }
}
