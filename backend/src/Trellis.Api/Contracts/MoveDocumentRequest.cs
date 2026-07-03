namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the move-document endpoint. The body's entire
/// purpose is the destination, so there is no "leave unchanged" case here and
/// the JSON null-vs-absent ambiguity is harmless: both mean the root. This is
/// exactly why moving is a dedicated endpoint rather than a folder field on
/// <see cref="UpdateDocumentRequest"/>, where an omitted folder id could not
/// be told apart from an explicit move to root.
/// </summary>
public record MoveDocumentRequest
{
    /// <summary>
    /// Gets the identifier of the destination folder, or null to move the
    /// document to the root.
    /// </summary>
    public Guid? FolderId { get; init; }
}
