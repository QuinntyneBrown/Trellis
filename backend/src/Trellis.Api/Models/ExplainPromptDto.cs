namespace Trellis.Api.Models;

/// <summary>
/// The response of both explain endpoints: the ready-to-paste prompt and how
/// many files it aggregates (surfaced by the wizard as a confirmation).
/// </summary>
public record ExplainPromptDto
{
    /// <summary>
    /// Gets the complete "Explain This" prompt as markdown.
    /// </summary>
    public required string Prompt { get; init; }

    /// <summary>
    /// Gets the number of files included in the aggregation.
    /// </summary>
    public required int FileCount { get; init; }
}
