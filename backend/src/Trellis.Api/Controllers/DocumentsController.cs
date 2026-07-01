using System.Text;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Trellis.Api.Contracts;
using Trellis.Application.Common.Models;
using Trellis.Application.Documents.Commands.CreateDocument;
using Trellis.Application.Documents.Commands.DeleteDocument;
using Trellis.Application.Documents.Commands.UpdateDocument;
using Trellis.Application.Documents.Commands.UploadDocument;
using Trellis.Application.Documents.Queries.GetDocumentById;
using Trellis.Application.Documents.Queries.GetDocumentList;

namespace Trellis.Api.Controllers;

/// <summary>
/// Exposes CRUD and file-upload operations over PlantUML documents.
/// </summary>
[ApiController]
[Route("api/documents")]
public class DocumentsController : ControllerBase
{
    private static readonly string[] AllowedUploadExtensions = { ".puml", ".txt" };
    private const long MaxUploadSizeBytes = 1 * 1024 * 1024;

    private readonly ISender mediator;

    /// <summary>
    /// Initializes a new instance of the <see cref="DocumentsController"/> class.
    /// </summary>
    /// <param name="mediator">The MediatR sender.</param>
    public DocumentsController(ISender mediator)
    {
        this.mediator = mediator;
    }

    /// <summary>
    /// Gets the lightweight list of every document.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The list of documents.</returns>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<DocumentListItemDto>>> GetList(CancellationToken cancellationToken)
    {
        var documents = await this.mediator.Send(new GetDocumentListQuery(), cancellationToken);
        return this.Ok(documents);
    }

    /// <summary>
    /// Gets a single document, including its content.
    /// </summary>
    /// <param name="id">The document identifier.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The document, or 404 if it does not exist.</returns>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DocumentDto>> GetById(Guid id, CancellationToken cancellationToken)
    {
        var document = await this.mediator.Send(new GetDocumentByIdQuery { Id = id }, cancellationToken);

        return document is null ? this.NotFound() : this.Ok(document);
    }

    /// <summary>
    /// Creates a new document.
    /// </summary>
    /// <param name="command">The document to create.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created document.</returns>
    [HttpPost]
    public async Task<ActionResult<DocumentDto>> Create(CreateDocumentCommand command, CancellationToken cancellationToken)
    {
        var document = await this.mediator.Send(command, cancellationToken);

        return this.CreatedAtAction(nameof(this.GetById), new { id = document.Id }, document);
    }

    /// <summary>
    /// Replaces an existing document's name and content. The route id always wins
    /// over any id that might otherwise appear in the request body.
    /// </summary>
    /// <param name="id">The identifier of the document to update.</param>
    /// <param name="body">The new name and content.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The updated document.</returns>
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<DocumentDto>> Update(Guid id, UpdateDocumentRequestBody body, CancellationToken cancellationToken)
    {
        var command = new UpdateDocumentCommand { Id = id, Name = body.Name, Content = body.Content };
        var document = await this.mediator.Send(command, cancellationToken);

        return this.Ok(document);
    }

    /// <summary>
    /// Deletes a document.
    /// </summary>
    /// <param name="id">The identifier of the document to delete.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>204 No Content.</returns>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        await this.mediator.Send(new DeleteDocumentCommand { Id = id }, cancellationToken);
        return this.NoContent();
    }

    /// <summary>
    /// Creates or replaces a document from an uploaded .puml/.txt file. The uploaded
    /// <see cref="IFormFile"/> never leaves this action - it is read into plain text
    /// before being dispatched as an <see cref="UploadDocumentCommand"/>.
    /// </summary>
    /// <param name="file">The uploaded file, under form field "file".</param>
    /// <param name="documentId">
    /// The optional identifier of an existing document whose content should be replaced.
    /// </param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The created or updated document.</returns>
    [HttpPost("upload")]
    public async Task<ActionResult<DocumentDto>> Upload(IFormFile file, [FromForm] Guid? documentId, CancellationToken cancellationToken)
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

        string content;
        using (var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8))
        {
            content = await reader.ReadToEndAsync(cancellationToken);
        }

        var command = new UploadDocumentCommand
        {
            DocumentId = documentId,
            FileName = Path.GetFileNameWithoutExtension(file.FileName),
            Content = content,
        };

        var document = await this.mediator.Send(command, cancellationToken);

        return documentId.HasValue
            ? this.Ok(document)
            : this.CreatedAtAction(nameof(this.GetById), new { id = document.Id }, document);
    }
}
