using MediatR;
using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Queries.GetDocumentList;

/// <summary>
/// Handles <see cref="GetDocumentListQuery"/>.
/// </summary>
public class GetDocumentListQueryHandler : IRequestHandler<GetDocumentListQuery, IReadOnlyList<DocumentListItemDto>>
{
    private readonly IApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetDocumentListQueryHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public GetDocumentListQueryHandler(IApplicationDbContext context)
    {
        this.context = context;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<DocumentListItemDto>> Handle(GetDocumentListQuery request, CancellationToken cancellationToken)
    {
        // Projected directly in the query so the (potentially large) Content column
        // is never fetched for a list view. The ordering itself is applied client-side
        // after projection, because the SQLite provider cannot translate an ORDER BY
        // over a DateTimeOffset expression into SQL.
        var documents = await this.context.Documents
            .Select(d => new DocumentListItemDto
            {
                Id = d.Id,
                Name = d.Name,
                UpdatedAt = d.UpdatedAt ?? d.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return documents
            .OrderByDescending(d => d.UpdatedAt)
            .ToList();
    }
}
