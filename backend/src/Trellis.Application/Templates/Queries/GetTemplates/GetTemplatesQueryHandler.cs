using MediatR;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Templates.Queries.GetTemplates;

/// <summary>
/// Handles <see cref="GetTemplatesQuery"/>.
/// </summary>
public class GetTemplatesQueryHandler : IRequestHandler<GetTemplatesQuery, IReadOnlyList<TemplateDto>>
{
    private readonly ITemplateCatalog catalog;

    /// <summary>
    /// Initializes a new instance of the <see cref="GetTemplatesQueryHandler"/> class.
    /// </summary>
    /// <param name="catalog">The template catalog.</param>
    public GetTemplatesQueryHandler(ITemplateCatalog catalog)
    {
        this.catalog = catalog;
    }

    /// <inheritdoc />
    public Task<IReadOnlyList<TemplateDto>> Handle(GetTemplatesQuery request, CancellationToken cancellationToken)
    {
        return Task.FromResult(this.catalog.GetAll());
    }
}
