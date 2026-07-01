using MediatR;
using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Exceptions;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Domain.Entities;

namespace Trellis.Application.Documents.Commands.UploadDocument;

/// <summary>
/// Handles <see cref="UploadDocumentCommand"/>.
/// </summary>
public class UploadDocumentCommandHandler : IRequestHandler<UploadDocumentCommand, DocumentDto>
{
    private readonly IApplicationDbContext context;
    private readonly IDateTimeProvider dateTimeProvider;

    /// <summary>
    /// Initializes a new instance of the <see cref="UploadDocumentCommandHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    /// <param name="dateTimeProvider">The date/time provider.</param>
    public UploadDocumentCommandHandler(IApplicationDbContext context, IDateTimeProvider dateTimeProvider)
    {
        this.context = context;
        this.dateTimeProvider = dateTimeProvider;
    }

    /// <inheritdoc />
    public async Task<DocumentDto> Handle(UploadDocumentCommand request, CancellationToken cancellationToken)
    {
        PlantUmlDocument document;

        if (request.DocumentId.HasValue)
        {
            var existing = await this.context.Documents
                .FirstOrDefaultAsync(d => d.Id == request.DocumentId.Value, cancellationToken);

            if (existing is null)
            {
                throw new NotFoundException(nameof(PlantUmlDocument), request.DocumentId.Value);
            }

            existing.Content = request.Content;
            existing.UpdatedAt = this.dateTimeProvider.UtcNow;
            document = existing;
        }
        else
        {
            document = new PlantUmlDocument
            {
                Id = Guid.NewGuid(),
                Name = request.FileName,
                Content = request.Content,
                CreatedAt = this.dateTimeProvider.UtcNow,
                UpdatedAt = null,
            };

            this.context.Documents.Add(document);
        }

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
