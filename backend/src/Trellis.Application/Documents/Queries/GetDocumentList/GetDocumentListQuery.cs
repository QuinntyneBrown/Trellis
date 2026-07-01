using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Queries.GetDocumentList;

/// <summary>
/// Query to fetch the lightweight list of all documents.
/// </summary>
public record GetDocumentListQuery : IRequest<IReadOnlyList<DocumentListItemDto>>;
