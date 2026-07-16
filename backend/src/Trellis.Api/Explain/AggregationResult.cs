namespace Trellis.Api.Explain;

/// <summary>
/// The outcome of an aggregation: the combined markdown-ready content plus
/// how many files made it through the policy filter.
/// </summary>
/// <param name="Content">The delimited, fenced aggregation of every included file.</param>
/// <param name="FileCount">The number of files included.</param>
public sealed record AggregationResult(string Content, int FileCount);
