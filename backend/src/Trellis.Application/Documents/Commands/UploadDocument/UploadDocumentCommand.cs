using MediatR;
using Trellis.Application.Common.Models;

namespace Trellis.Application.Documents.Commands.UploadDocument;

/// <summary>
/// Command to create or replace a document's content from an uploaded .puml file.
/// Deliberately takes plain string content (never an ASP.NET Core IFormFile), since
/// the Application layer must not depend on ASP.NET Core.
/// </summary>
public record UploadDocumentCommand : IRequest<DocumentDto>
{
    /// <summary>
    /// Gets the identifier of the document whose content should be replaced, if any.
    /// When <see langword="null"/>, a new document is created instead.
    /// </summary>
    public Guid? DocumentId { get; init; }

    /// <summary>
    /// Gets the name to use for the document when a new one is being created.
    /// Ignored when <see cref="DocumentId"/> refers to an existing document.
    /// </summary>
    public required string FileName { get; init; }

    /// <summary>
    /// Gets the uploaded file's content, decoded as UTF-8 text.
    /// </summary>
    public required string Content { get; init; }
}
