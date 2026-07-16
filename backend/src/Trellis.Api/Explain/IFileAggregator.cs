namespace Trellis.Api.Explain;

/// <summary>
/// Combines a set of source files into a single GetFiles-style aggregate for
/// embedding in an "Explain This" prompt.
/// </summary>
public interface IFileAggregator
{
    /// <summary>
    /// Filters <paramref name="files"/> through <see cref="ExplainContentPolicy"/>,
    /// strips code files, and emits each survivor between
    /// <c>=== FILE: path ===</c> / <c>=== END FILE: path ===</c> delimiters
    /// inside a language-tagged fenced code block, in a deterministic sorted
    /// order.
    /// </summary>
    /// <param name="files">The candidate files.</param>
    /// <returns>The aggregation result.</returns>
    /// <exception cref="ExplainSourceException">The combined content exceeds the size cap.</exception>
    AggregationResult Aggregate(IReadOnlyList<SourceFile> files);
}
