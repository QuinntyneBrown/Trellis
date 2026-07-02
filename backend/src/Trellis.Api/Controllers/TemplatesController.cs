using Microsoft.AspNetCore.Mvc;
using Trellis.Api.Models;
using Trellis.Api.Templates;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes the catalog of vendored PlantUML starter templates.
/// </summary>
[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    private readonly TemplateCatalog catalog;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplatesController"/> class.
    /// </summary>
    /// <param name="catalog">The template catalog.</param>
    public TemplatesController(TemplateCatalog catalog)
    {
        this.catalog = catalog;
    }

    /// <summary>
    /// Gets every available template, including its full starter content.
    /// </summary>
    /// <returns>The list of templates.</returns>
    [HttpGet]
    public ActionResult<IReadOnlyList<TemplateDto>> GetAll()
    {
        return this.Ok(this.catalog.GetAll());
    }
}
