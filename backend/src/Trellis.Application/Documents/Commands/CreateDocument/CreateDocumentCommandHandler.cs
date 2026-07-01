using MediatR;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;
using Trellis.Domain.Entities;

namespace Trellis.Application.Documents.Commands.CreateDocument;

/// <summary>
/// Handles <see cref="CreateDocumentCommand"/>.
/// </summary>
public class CreateDocumentCommandHandler : IRequestHandler<CreateDocumentCommand, DocumentDto>
{
    private readonly IApplicationDbContext context;
    private readonly IDateTimeProvider dateTimeProvider;

    /// <summary>
    /// Initializes a new instance of the <see cref="CreateDocumentCommandHandler"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    /// <param name="dateTimeProvider">The date/time provider.</param>
    public CreateDocumentCommandHandler(IApplicationDbContext context, IDateTimeProvider dateTimeProvider)
    {
        this.context = context;
        this.dateTimeProvider = dateTimeProvider;
    }

    /// <inheritdoc />
    public async Task<DocumentDto> Handle(CreateDocumentCommand request, CancellationToken cancellationToken)
    {
        var document = new PlantUmlDocument
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Content = request.Content,
            CreatedAt = this.dateTimeProvider.UtcNow,
            UpdatedAt = null,
        };

        this.context.Documents.Add(document);
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
