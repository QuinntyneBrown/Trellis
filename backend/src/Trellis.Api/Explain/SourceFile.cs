namespace Trellis.Api.Explain;

/// <summary>
/// A single source file handed to the aggregation pipeline: a repository- or
/// selection-relative path (forward slashes) plus its full text content.
/// </summary>
/// <param name="Path">The relative path of the file, using forward slashes.</param>
/// <param name="Content">The full text content of the file.</param>
public sealed record SourceFile(string Path, string Content);
