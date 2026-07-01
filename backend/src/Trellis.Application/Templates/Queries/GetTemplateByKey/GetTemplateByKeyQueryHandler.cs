using MediatR;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Templates.Queries.GetTemplateByKey;

/// <summary>
/// Handles <see cref="GetTemplateByKeyQuery"/>.
/// </summary>
public class GetTemplateByKeyQueryHandler : IRequestHandler<GetTemplateByKeyQuery, TemplateDto?>
{
    private readonly ITemplateCatalog catalog;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetTemplateByKeyQueryHandler"/> class.
    /// </summary>
    /// <param name="catalog">The template catalog.</param>
    public GetTemplateByKeyQueryHandler(ITemplateCatalog catalog)
    {
        this.catalog = catalog;
    }

    /// <inheritdoc />
    public Task<TemplateDto?> Handle(GetTemplateByKeyQuery request, CancellationToken cancellationToken)
    {
        return Task.FromResult(this.catalog.GetByKey(request.Key));
    }
}
