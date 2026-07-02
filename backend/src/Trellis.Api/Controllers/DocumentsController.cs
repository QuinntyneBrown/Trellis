using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Trellis.Api.Contracts;
using Trellis.Api.Domain;
using Trellis.Api.Models;
using Trellis.Api.Persistence;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes CRUD and file-upload operations over PlantUML documents. Each action is
/// a few lines of EF Core work against <see cref="ApplicationDbContext"/> directly.
/// </summary>
[ApiController]
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private const long MaxUploadSizeBytes = 1 * 1024 * 1024;
    private const int MaxNameLength = 200;

    private static readonly string[] AllowedUploadExtensions = { ".puml", ".txt" };

    private readonly ApplicationDbContext context;

    /// <summary>
    /// Initializes a new instance of the <see cref="DocumentsController"/> class.
    /// </summary>
    /// <param name="context">The application database context.</param>
    public DocumentsController(ApplicationDbContext context)
    {
        this.context = context;
    }

    /// <summary>
    /// Gets the lightweight list of every document, most recently touched first.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The list of documents.</returns>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentListItemDto>>> GetList(CancellationToken cancellationToken)
    {
        // Projected directly in the query so the (potentially large) Content column
        // is never fetched for a list view. The ordering itself is applied client-side
        // after projection, because the SQLite provider cannot translate an ORDER BY
        // over a DateTimeOffset expression into SQL.
        var documents = await this.context.Documents
            .Select(d => new DocumentListItemDto
            {
                Id = d.Id,
                Name = d.Name,
                UpdatedAt = d.UpdatedAt ?? d.CreatedAt,
                FolderId = d.FolderId,
            })
            .ToListAsync(cancellationToken);

        return this.Ok(documents.OrderByDescending(d => d.UpdatedAt).ToList());
    }

    /// <summary>
    /// Gets a single document, including its content.
    /// </summary>
    /// <param name="id">The document identifier.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The document, or 404 if it does not exist.</returns>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PlantUmlDocument>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var document = await this.context.Documents
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        return document is null ? this.NotFound() : this.Ok(document);
    }

    /// <summary>
    /// Creates a new document, optionally inside a virtual folder.
    /// </summary>
    /// <param name="request">The document to create.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created document, or 404 if the destination folder does not exist.</returns>
    [HttpPost]
    public async Task<ActionResult<PlantUmlDocument>> Create(CreateDocumentRequest request, CancellationToken cancellationToken)
    {
        // Checked explicitly (mirroring Upload's unknown-documentId handling) so a
        // stale folder id yields a 404 rather than a SQLite FK violation -> 500.
        if (request.FolderId.HasValue
            && !await this.context.Folders.AnyAsync(f => f.Id == request.FolderId.Value, cancellationToken))
        {
            return this.NotFound();
        }

        var document = new PlantUmlDocument
        {
            Id = Guid.NewGuid(),
            Name = request.Name,
            Content = request.Content,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = null,
            FolderId = request.FolderId,
        };

        this.context.Documents.Add(document);
        await this.context.SaveChangesAsync(cancellationToken);

        return this.CreatedAtAction(nameof(this.GetById), new { id = document.Id }, document);
    }

    /// <summary>
    /// Replaces an existing document's name and content. The route id always wins
    /// over any id that might otherwise appear in the request body. The document's
    /// folder is never changed here - it is chosen at creation only.
    /// </summary>
    /// <param name="id">The identifier of the document to update.</param>
    /// <param name="request">The new name and content.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The updated document, or 404 if it does not exist.</returns>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlantUmlDocument>> Update(Guid id, UpdateDocumentRequest request, CancellationToken cancellationToken)
    {
        var document = await this.context.Documents
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        if (document is null)
        {
            return this.NotFound();
        }

        document.Name = request.Name;
        document.Content = request.Content;
        document.UpdatedAt = DateTimeOffset.UtcNow;

        await this.context.SaveChangesAsync(cancellationToken);

        return this.Ok(document);
    }

    /// <summary>
    /// Deletes a document.
    /// </summary>
    /// <param name="id">The identifier of the document to delete.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>204 No Content, or 404 if it does not exist.</returns>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var document = await this.context.Documents
            .FirstOrDefaultAsync(d => d.Id == id, cancellationToken);

        if (document is null)
        {
            return this.NotFound();
        }

        this.context.Documents.Remove(document);
        await this.context.SaveChangesAsync(cancellationToken);

        return this.NoContent();
    }

    /// <summary>
    /// Creates or replaces a document from an uploaded .puml/.txt file.
    /// </summary>
    /// <param name="file">The uploaded file, under form field "file".</param>
    /// <param name="documentId">
    /// The optional identifier of an existing document whose content should be replaced.
    /// </param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created or updated document.</returns>
    [HttpPost("upload")]
    public async Task<ActionResult<PlantUmlDocument>> Upload(IFormFile file, [FromForm] Guid? documentId, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return this.BadRequest("An uploaded file is required.");
        }

        if (file.Length > MaxUploadSizeBytes)
        {
            return this.BadRequest($"Uploaded file must not exceed {MaxUploadSizeBytes} bytes.");
        }

        var extension = Path.GetExtension(file.FileName);
        if (!AllowedUploadExtensions.Contains(extension, StringComparer.OrdinalIgnoreCase))
        {
            return this.BadRequest("Only .puml or .txt files may be uploaded.");
        }

        var name = Path.GetFileNameWithoutExtension(file.FileName);
        if (string.IsNullOrWhiteSpace(name) || name.Length > MaxNameLength)
        {
            return this.BadRequest($"The uploaded file must have a name of 1 to {MaxNameLength} characters.");
        }

        string content;
        using (var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8))
        {
            content = await reader.ReadToEndAsync(cancellationToken);
        }

        PlantUmlDocument document;

        if (documentId.HasValue)
        {
            var existing = await this.context.Documents
                .FirstOrDefaultAsync(d => d.Id == documentId.Value, cancellationToken);

            if (existing is null)
            {
                return this.NotFound();
            }

            // A replacing upload keeps the document's existing name - only the
            // content (and the touched timestamp) change.
            existing.Content = content;
            existing.UpdatedAt = DateTimeOffset.UtcNow;
            document = existing;
        }
        else
        {
            document = new PlantUmlDocument
            {
                Id = Guid.NewGuid(),
                Name = name,
                Content = content,
                CreatedAt = DateTimeOffset.UtcNow,
                UpdatedAt = null,
            };

            this.context.Documents.Add(document);
        }

        await this.context.SaveChangesAsync(cancellationToken);

        return documentId.HasValue
            ? this.Ok(document)
            : this.CreatedAtAction(nameof(this.GetById), new { id = document.Id }, document);
    }
}
