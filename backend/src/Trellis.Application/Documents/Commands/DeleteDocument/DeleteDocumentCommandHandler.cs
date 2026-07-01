using MediatR;
using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Exceptions;
using Trellis.Application.Common.Interfaces;
using Trellis.Domain.Entities;

namespace Trellis.Application.Documents.Commands.DeleteDocument;

/// <summary>
/// Handles <see cref="DeleteDocumentCommand"/>.
/// </summary>
public class DeleteDocumentCommandHandler : IRequestHandler<DeleteDocumentCommand>
{
    private readonly IApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="DeleteDocumentCommandHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public DeleteDocumentCommandHandler(IApplicationDbContext context)
    {
        this.context = context;
    }

    /// <inheritdoc />
    public async Task Handle(DeleteDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await this.context.Documents
            .FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken);

        if (document is null)
        {
            throw new NotFoundException(nameof(PlantUmlDocument), request.Id);
        }

        this.context.Documents.Remove(document);
        await this.context.SaveChangesAsync(cancellationToken);
    }
}
