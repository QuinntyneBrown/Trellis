using MediatR;
using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Exceptions;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Domain.Entities;

namespace Trellis.Application.Documents.Commands.UpdateDocument;

/// <summary>
/// Handles <see cref="UpdateDocumentCommand"/>.
/// </summary>
public class UpdateDocumentCommandHandler : IRequestHandler<UpdateDocumentCommand, DocumentDto>
{
    private readonly IApplicationDbContext context;
    private readonly IDateTimeProvider dateTimeProvider;

    /// <summary>
    /// Initializes a new instance of the <see cref="UpdateDocumentCommandHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    /// <param name="dateTimeProvider">The date/time provider.</param>
    public UpdateDocumentCommandHandler(IApplicationDbContext context, IDateTimeProvider dateTimeProvider)
    {
        this.context = context;
        this.dateTimeProvider = dateTimeProvider;
    }

    /// <inheritdoc />
    public async Task<DocumentDto> Handle(UpdateDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = await this.context.Documents
            .FirstOrDefaultAsync(d => d.Id == request.Id, cancellationToken);

        if (document is null)
        {
            throw new NotFoundException(nameof(PlantUmlDocument), request.Id);
        }

        document.Name = request.Name;
        document.Content = request.Content;
        document.UpdatedAt = this.dateTimeProvider.UtcNow;

        await this.context.SaveChangesAsync(cancellationToken);

        return new DocumentDto
        {
            Id = document.Id,
            Name = document.Name,
            Content = document.Content,
            CreatedAt = document.CreatedAt,
            UpdatedAt = document.UpdatedAt,
        };
    }
}
