namespace Trellis.Api.Models;

/// <summary>
/// The response of both explain endpoints: a ready-to-paste prompt plus a
/// markdown attachment containing the aggregated source files.
/// </summary>
public record ExplainPromptDto
{
    /// <summary>
    /// Gets the compact "Explain This" prompt as markdown. The prompt names
    /// the attachment the user must upload alongside it.
    /// </summary>
    public required string Prompt { get; init; }

    /// <summary>
    /// Gets the number of files included in the aggregation.
    /// </summary>
    public required int FileCount { get; init; }

    /// <summary>
    /// Gets the filename to use when downloading the aggregated source files.
    /// </summary>
    public required string AttachmentFileName { get; init; }

    /// <summary>
    /// Gets the aggregated source-file blocks to write to the attachment.
    /// </summary>
    public required string AttachmentContent { get; init; }
}
