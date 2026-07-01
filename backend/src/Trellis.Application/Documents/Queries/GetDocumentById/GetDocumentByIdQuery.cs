using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Queries.GetDocumentById;

/// <summary>
/// Query to fetch a single document by its identifier.
/// </summary>
public record GetDocumentByIdQuery : IRequest<DocumentDto?>
{
    /// <summary>
    /// Gets the identifier of the document to fetch.
    /// </summary>
    public required Guid Id { get; init; }
}
