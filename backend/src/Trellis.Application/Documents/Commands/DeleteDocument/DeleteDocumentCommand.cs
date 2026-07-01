using MediatR;

namespace Trellis.Application.Documents.Commands.DeleteDocument;

/// <summary>
/// Command to delete a PlantUML document.
/// </summary>
public record DeleteDocumentCommand : IRequest
{
    /// <summary>
    /// Gets the identifier of the document to delete.
    /// </summary>
    public required Guid Id { get; init; }
}
