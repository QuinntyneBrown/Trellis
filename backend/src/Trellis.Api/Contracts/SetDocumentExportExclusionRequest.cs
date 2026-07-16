namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the set-export-exclusion endpoint. A dedicated
/// endpoint (rather than a field on <see cref="UpdateDocumentRequest"/>) for
/// the same reason moving is: toggling export visibility is an organizational
/// action, and must not bump the recency timestamp the way editing does.
/// </summary>
public record SetDocumentExportExclusionRequest
{
    /// <summary>
    /// Gets a value indicating whether the document should be omitted from
    /// folder markdown exports.
    /// </summary>
    public required bool ExcludedFromExport { get; init; }
}
