namespace Trellis.Api.Models;

/// <summary>
/// Represents one hit from a full-text document search. It carries the same
/// lightweight fields as <see cref="DocumentListItemDto"/> so the client can
/// render a result row exactly like a list row, plus an optional
/// <see cref="Snippet"/> excerpt showing where the query matched the content.
/// </summary>
public record DocumentSearchResultDto
{
    /// <summary>
    /// Gets the unique identifier of the document.
    /// </summary>
    public required Guid Id { get; init; }

    /// <summary>
    /// Gets the display name of the document.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the timestamp at which the document was last touched (updated, or created if never updated).
    /// </summary>
    public required DateTimeOffset UpdatedAt { get; init; }

    /// <summary>
    /// Gets the identifier of the virtual folder containing the document, or null
    /// when it sits at the root.
    /// </summary>
    public required Guid? FolderId { get; init; }

    /// <summary>
    /// Gets the document kind - "plantuml" or "markdown".
    /// </summary>
    public required string Kind { get; init; }

    /// <summary>
    /// Gets a value indicating whether the document is omitted from folder
    /// markdown exports unless the export explicitly includes excluded documents.
    /// </summary>
    public required bool ExcludedFromExport { get; init; }

    /// <summary>
    /// Gets a short excerpt of the document content surrounding the first place
    /// the query matched, or null when the query matched only the name. The
    /// excerpt collapses whitespace and is bracketed with ellipses when it is
    /// clipped from a larger body.
    /// </summary>
    public string? Snippet { get; init; }
}
