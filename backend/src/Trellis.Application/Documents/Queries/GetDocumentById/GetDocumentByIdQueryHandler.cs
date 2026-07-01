using MediatR;
using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Queries.GetDocumentById;

/// <summary>
/// Handles <see cref="GetDocumentByIdQuery"/>.
/// </summary>
public class GetDocumentByIdQueryHandler : IRequestHandler<GetDocumentByIdQuery, DocumentDto?>
{
    private readonly IApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetDocumentByIdQueryHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public GetDocumentByIdQueryHandler(IApplicationDbContext context)
    {
        this.context = context;
    }

    /// <inheritdoc />
    public async Task<DocumentDto?> Handle(GetDocumentByIdQuery request, CancellationToken cancellationToken)
    {
        return await this.context.Documents
            .Where(d => d.Id == request.Id)
            .Select(d => new DocumentDto
            {
                Id = d.Id,
                Name = d.Name,
                Content = d.Content,
                CreatedAt = d.CreatedAt,
                UpdatedAt = d.UpdatedAt,
            })
            .FirstOrDefaultAsync(cancellationToken);
    }
}
