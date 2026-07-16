using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the explain-aggregate endpoint: the files of a
/// local file/folder selection.
/// </summary>
public record ExplainAggregateRequest
{
    /// <summary>
    /// Gets the files to aggregate into the downloadable attachment.
    /// </summary>
    [Required]
    [MinLength(1)]
    public required IReadOnlyList<ExplainFileEntry> Files { get; init; }
}
