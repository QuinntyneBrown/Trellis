using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// Default <see cref="IFileAggregator"/>: GetFiles-style delimiters and
/// deterministic ordering, plus fenced code blocks so the aggregate reads
/// cleanly as a markdown attachment. PlantUML files are fenced as
/// <c>```plantuml</c>; markdown and PlantUML content is included verbatim
/// while everything else is comment/whitespace-stripped to save LLM tokens.
/// </summary>
public class FileAggregator : IFileAggregator
{
    /// <summary>
    /// Upper bound on the combined aggregate, roughly 2M LLM tokens -- far
    /// beyond any real chat context, so hitting it means the user selected
    /// something unreasonable (and unbounded output would only hurt the
    /// server and the editor).
    /// </summary>
    private const int MaxTotalContentChars = 8_000_000;

    /// <inheritdoc />
    public AggregationResult Aggregate(IReadOnlyList<SourceFile> files)
    {
        var included = files
            .Select(f => f with { Path = NormalizePath(f.Path) })
            .Where(f => f.Path.Length > 0 && ExplainContentPolicy.IsIncluded(f.Path))
            .OrderBy(f => f.Path, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var builder = new StringBuilder();

        foreach (var file in included)
        {
            var extension = System.IO.Path.GetExtension(file.Path).ToLowerInvariant();

            // Markdown/PlantUML verbatim: their "comments" are content.
            var body = extension is ".md" or ".puml"
                ? file.Content.TrimEnd()
                : SourceCodeStripper.Strip(file.Content, file.Path);

            var fence = FenceFor(body);
            var language = ExplainContentPolicy.FenceLanguageFor(file.Path);

            builder.Append("=== FILE: ").Append(file.Path).Append(" ===\n");
            builder.Append(fence).Append(language).Append('\n');
            builder.Append(body).Append('\n');
            builder.Append(fence).Append('\n');
            builder.Append("=== END FILE: ").Append(file.Path).Append(" ===\n\n");

            if (builder.Length > MaxTotalContentChars)
            {
                throw new ExplainSourceException(
                    "The selection is too large to aggregate. Choose a smaller file or folder.");
            }
        }

        return new AggregationResult(builder.ToString().TrimEnd() + (builder.Length > 0 ? "\n" : string.Empty), included.Count);
    }

    /// <summary>
    /// Normalizes to forward slashes and strips leading "./" and "/" so paths
    /// are stable regardless of how the client or archive produced them.
    /// </summary>
    private static string NormalizePath(string path)
    {
        var normalized = path.Replace('\\', '/');

        while (normalized.StartsWith("./", StringComparison.Ordinal))
        {
            normalized = normalized[2..];
        }

        return normalized.TrimStart('/');
    }

    /// <summary>
    /// Picks a backtick fence strictly longer than any backtick run inside
    /// <paramref name="body"/> (minimum three), so files that themselves
    /// contain fenced blocks -- markdown files especially -- can never
    /// terminate the wrapper fence early.
    /// </summary>
    private static string FenceFor(string body)
    {
        var longestRun = 0;
        var currentRun = 0;

        foreach (var character in body)
        {
            currentRun = character == '`' ? currentRun + 1 : 0;
            longestRun = Math.Max(longestRun, currentRun);
        }

        return new string('`', Math.Max(3, longestRun + 1));
    }
}
