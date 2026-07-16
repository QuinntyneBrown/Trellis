using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// One file in an <see cref="ExplainAggregateRequest"/>: read client-side via
/// the File System Access API and posted here so the aggregation/stripping
/// rules live in exactly one (server-side) implementation.
/// </summary>
public record ExplainFileEntry
{
    /// <summary>
    /// Gets the selection-relative path of the file, using forward slashes.
    /// </summary>
    [Required]
    [MaxLength(1024)]
    public required string Path { get; init; }

    /// <summary>
    /// Gets the full text content of the file. May be empty, but never null.
    /// </summary>
    [Required(AllowEmptyStrings = true)]
    public required string Content { get; init; }
}
