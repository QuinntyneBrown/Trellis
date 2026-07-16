namespace Trellis.Api.Explain;

/// <summary>
/// Builds the final "Explain This" prompt markdown from an aggregation result.
/// </summary>
public interface IExplainPromptBuilder
{
    /// <summary>
    /// Builds explain-this instructions that direct the LLM to the separately
    /// uploaded source attachment.
    /// </summary>
    /// <param name="aggregation">The aggregated files.</param>
    /// <param name="attachmentFileName">The exact filename the user will upload.</param>
    /// <returns>The compact prompt as markdown.</returns>
    string Build(AggregationResult aggregation, string attachmentFileName);
}
