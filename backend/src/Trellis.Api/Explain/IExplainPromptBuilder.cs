namespace Trellis.Api.Explain;

/// <summary>
/// Builds the final "Explain This" prompt markdown from an aggregation result.
/// </summary>
public interface IExplainPromptBuilder
{
    /// <summary>
    /// Wraps <paramref name="aggregation"/> in the explain-this instructions.
    /// </summary>
    /// <param name="aggregation">The aggregated files.</param>
    /// <returns>The complete prompt as markdown.</returns>
    string Build(AggregationResult aggregation);
}
