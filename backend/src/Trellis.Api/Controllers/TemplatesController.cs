using MediatR;
using Microsoft.AspNetCore.Mvc;
using Trellis.Application.Common.Models;
using Trellis.Application.Templates.Queries.GetTemplateByKey;
using Trellis.Application.Templates.Queries.GetTemplates;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes the catalog of vendored PlantUML starter templates.
/// </summary>
[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    private readonly ISender mediator;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplatesController"/> class.
    /// </summary>
    /// <param name="mediator">The MediatR sender.</param>
    public TemplatesController(ISender mediator)
    {
        this.mediator = mediator;
    }

    /// <summary>
    /// Gets every available template.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The list of templates.</returns>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateDto>>> GetAll(CancellationToken cancellationToken)
    {
        var templates = await this.mediator.Send(new GetTemplatesQuery(), cancellationToken);
        return this.Ok(templates);
    }

    /// <summary>
    /// Gets a single template by its key.
    /// </summary>
    /// <param name="key">The kebab-case template key.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The template, or 404 if it does not exist.</returns>
    [HttpGet("{key}")]
    public async Task<ActionResult<TemplateDto>> GetByKey(string key, CancellationToken cancellationToken)
    {
        var template = await this.mediator.Send(new GetTemplateByKeyQuery { Key = key }, cancellationToken);

        return template is null ? this.NotFound() : this.Ok(template);
    }
}
