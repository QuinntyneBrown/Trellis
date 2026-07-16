using System.ComponentModel.DataAnnotations;

namespace Trellis.Api.Contracts;

/// <summary>
/// The JSON request body for the explain-aggregate-url endpoint: a GitHub or
/// GitLab URL naming a repository, or a folder/file inside one.
/// </summary>
public record ExplainAggregateUrlRequest
{
    /// <summary>
    /// Gets the repository/folder/file URL as typed by the user.
    /// </summary>
    [Required]
    [MaxLength(2048)]
    public required string Url { get; init; }
}
