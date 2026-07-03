using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trellis.Api.Contracts;
using Trellis.Api.Domain;
using Trellis.Api.Models;
using Trellis.Api.Persistence;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes CRUD operations over editor templates. Each action is a few lines
/// of EF Core work against <see cref="ApplicationDbContext"/> directly. The
/// six built-in starters are migration-seeded ordinary rows, so they flow
/// through these same endpoints like any user-created template.
/// </summary>
[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    private readonly ApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplatesController"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public TemplatesController(ApplicationDbContext context)
    {
        this.context = context;
    }

    /// <summary>
    /// Gets the lightweight list of every template, ordered by name.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The list of templates.</returns>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<TemplateListItemDto>>> GetList(CancellationToken cancellationToken)
    {
        // Projected directly in the query so the (potentially large) Content
        // column is never fetched for a list view. Ordering is applied
        // client-side after projection: SQLite's default BINARY collation
        // would case-sensitively misorder names.
        var templates = await this.context.Templates
            .Select(t => new TemplateListItemDto
            {
                Id = t.Id,
                Name = t.Name,
                Kind = t.Kind,
                UpdatedAt = t.UpdatedAt ?? t.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return this.Ok(templates.OrderBy(t => t.Name, StringComparer.OrdinalIgnoreCase).ToList());
    }

    /// <summary>
    /// Gets a single template, including its content.
    /// </summary>
    /// <param name="id">The template identifier.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The template, or 404 if it does not exist.</returns>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Template>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var template = await this.context.Templates
            .AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        return template is null ? this.NotFound() : this.Ok(template);
    }

    /// <summary>
    /// Creates a new template.
    /// </summary>
    /// <param name="request">The template to create.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created template.</returns>
    [HttpPost]
    public async Task<ActionResult<Template>> Create(CreateTemplateRequest request, CancellationToken cancellationToken)
    {
        if (request.Kind is not null && !DocumentKinds.IsValid(request.Kind))
        {
            return this.BadRequest("Kind must be either \"plantuml\" or \"markdown\".");
        }

        var template = new Template
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Content = request.Content,
            Kind = request.Kind ?? DocumentKinds.PlantUml,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = null,
        };

        this.context.Templates.Add(template);
        await this.context.SaveChangesAsync(cancellationToken);

        return this.CreatedAtAction(nameof(this.GetById), new { id = template.Id }, template);
    }

    /// <summary>
    /// Replaces an existing template's name, content and kind. The route id
    /// always wins over any id that might otherwise appear in the request body.
    /// </summary>
    /// <param name="id">The identifier of the template to update.</param>
    /// <param name="request">The new name, content and kind.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The updated template, or 404 if it does not exist.</returns>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Template>> Update(Guid id, UpdateTemplateRequest request, CancellationToken cancellationToken)
    {
        if (!DocumentKinds.IsValid(request.Kind))
        {
            return this.BadRequest("Kind must be either \"plantuml\" or \"markdown\".");
        }

        var template = await this.context.Templates
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (template is null)
        {
            return this.NotFound();
        }

        template.Name = request.Name;
        template.Content = request.Content;
        template.Kind = request.Kind;
        template.UpdatedAt = DateTimeOffset.UtcNow;

        await this.context.SaveChangesAsync(cancellationToken);

        return this.Ok(template);
    }

    /// <summary>
    /// Deletes a template.
    /// </summary>
    /// <param name="id">The identifier of the template to delete.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>204 No Content, or 404 if it does not exist.</returns>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var template = await this.context.Templates
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (template is null)
        {
            return this.NotFound();
        }

        this.context.Templates.Remove(template);
        await this.context.SaveChangesAsync(cancellationToken);

        return this.NoContent();
    }
}
