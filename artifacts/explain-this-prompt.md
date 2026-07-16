# Explain This

Please give me a rich explanation of the code included below.

## What to cover

Structure your explanation in these sections:

- **Background** — Explain the system this code belongs to. We don't know how much the reader already knows, so start with a deep background for beginners (note that it can be skipped if the reader is already familiar), then narrow to the background directly relevant to this code.
- **Intuition** — Explain the core intuition behind how the code works. Focus on the essence, not the full details. Use concrete examples with toy data, and use diagrams liberally.
- **Code walkthrough** — Do a high-level walkthrough of the files. Group and order them in an understandable way rather than file-by-file in listing order.
- **Quiz** — Finish with five multiple-choice questions that test whether the reader actually understood the substance of the code — medium difficulty, no gotchas. Put the answers, with a short explanation of each, at the very end.

## Style guide

When describing the architecture you MUST follow the architecture description style guide at https://github.com/QuinntyneBrown/architecture-description-style-guide.

## Format

- Respond in plain markdown suitable for a chat window — no HTML.
- Write with clarity and flow, in classic style, with smooth transitions between sections.
- Use fenced code blocks for code excerpts.
- Express diagrams as ```plantuml fenced code blocks — never ASCII art.
- Use block-quote callouts for key concepts, definitions, and important edge cases.

## Files (15 files)

Each file below sits between `=== FILE: path ===` and `=== END FILE: path ===` markers, inside a fenced code block tagged with its language (PlantUML sources are tagged `plantuml`). Comments and blank lines may have been stripped from code files to save context.

=== FILE: backend/src/Trellis.Api/Explain/AggregationResult.cs ===
```csharp
namespace Trellis.Api.Explain;
public sealed record AggregationResult(string Content, int FileCount);
```
=== END FILE: backend/src/Trellis.Api/Explain/AggregationResult.cs ===

=== FILE: backend/src/Trellis.Api/Explain/ExplainContentPolicy.cs ===
```csharp
namespace Trellis.Api.Explain;
public static class ExplainContentPolicy
{
    private static readonly Dictionary<string, string> FenceLanguageByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".ts"] = "typescript",
        [".html"] = "html",
        [".scss"] = "scss",
        [".css"] = "css",
        [".cs"] = "csharp",
        [".csproj"] = "xml",
        [".sln"] = "text",
        [".json"] = "json",
        [".yaml"] = "yaml",
        [".yml"] = "yaml",
        [".md"] = "markdown",
        [".puml"] = "plantuml",
    };
    private static readonly HashSet<string> ExcludedFolderNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "node_modules",
        "dist",
        "bin",
        "obj",
        ".git",
    };
    public static bool IsIncluded(string path)
    {
        var extension = System.IO.Path.GetExtension(path);
        if (string.IsNullOrEmpty(extension) || !FenceLanguageByExtension.ContainsKey(extension))
        {
            return false;
        }
        var segments = path.Split('/');
        for (var i = 0; i < segments.Length - 1; i++)
        {
            if (ExcludedFolderNames.Contains(segments[i]))
            {
                return false;
            }
        }
        return true;
    }
    public static string FenceLanguageFor(string path)
    {
        var extension = System.IO.Path.GetExtension(path);
        return FenceLanguageByExtension.TryGetValue(extension, out var language) ? language : "text";
    }
}
```
=== END FILE: backend/src/Trellis.Api/Explain/ExplainContentPolicy.cs ===

=== FILE: backend/src/Trellis.Api/Explain/ExplainPromptBuilder.cs ===
````csharp
using System.Text;
namespace Trellis.Api.Explain;
public class ExplainPromptBuilder : IExplainPromptBuilder
{
    public string Build(AggregationResult aggregation)
    {
        var builder = new StringBuilder();
        builder.Append("# Explain This\n\n");
        builder.Append("Please give me a rich explanation of the code included below.\n\n");
        builder.Append("## What to cover\n\n");
        builder.Append("Structure your explanation in these sections:\n\n");
        builder.Append("- **Background** — Explain the system this code belongs to. We don't know how much the reader ");
        builder.Append("already knows, so start with a deep background for beginners (note that it can be skipped if the ");
        builder.Append("reader is already familiar), then narrow to the background directly relevant to this code.\n");
        builder.Append("- **Intuition** — Explain the core intuition behind how the code works. Focus on the essence, ");
        builder.Append("not the full details. Use concrete examples with toy data, and use diagrams liberally.\n");
        builder.Append("- **Code walkthrough** — Do a high-level walkthrough of the files. Group and order them in an ");
        builder.Append("understandable way rather than file-by-file in listing order.\n");
        builder.Append("- **Quiz** — Finish with five multiple-choice questions that test whether the reader actually ");
        builder.Append("understood the substance of the code — medium difficulty, no gotchas. Put the answers, with a ");
        builder.Append("short explanation of each, at the very end.\n\n");
        builder.Append("## Style guide\n\n");
        builder.Append("When describing the architecture you MUST follow the architecture description style guide at ");
        builder.Append("https://github.com/QuinntyneBrown/architecture-description-style-guide.\n\n");
        builder.Append("## Format\n\n");
        builder.Append("- Respond in plain markdown suitable for a chat window — no HTML.\n");
        builder.Append("- Write with clarity and flow, in classic style, with smooth transitions between sections.\n");
        builder.Append("- Use fenced code blocks for code excerpts.\n");
        builder.Append("- Express diagrams as ```plantuml fenced code blocks — never ASCII art.\n");
        builder.Append("- Use block-quote callouts for key concepts, definitions, and important edge cases.\n\n");
        builder.Append("## Files (").Append(aggregation.FileCount).Append(aggregation.FileCount == 1 ? " file" : " files").Append(")\n\n");
        builder.Append("Each file below sits between `=== FILE: path ===` and `=== END FILE: path ===` markers, inside a ");
        builder.Append("fenced code block tagged with its language (PlantUML sources are tagged `plantuml`). Comments and ");
        builder.Append("blank lines may have been stripped from code files to save context.\n\n");
        builder.Append(aggregation.Content);
        return builder.ToString();
    }
}
````
=== END FILE: backend/src/Trellis.Api/Explain/ExplainPromptBuilder.cs ===

=== FILE: backend/src/Trellis.Api/Explain/ExplainSourceException.cs ===
```csharp
namespace Trellis.Api.Explain;
public class ExplainSourceException : Exception
{
    public ExplainSourceException(string message)
        : base(message)
    {
    }
}
```
=== END FILE: backend/src/Trellis.Api/Explain/ExplainSourceException.cs ===

=== FILE: backend/src/Trellis.Api/Explain/FileAggregator.cs ===
```csharp
using System.Text;
namespace Trellis.Api.Explain;
public class FileAggregator : IFileAggregator
{
    private const int MaxTotalContentChars = 8_000_000;
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
    private static string NormalizePath(string path)
    {
        var normalized = path.Replace('\\', '/');
        while (normalized.StartsWith("./", StringComparison.Ordinal))
        {
            normalized = normalized[2..];
        }
        return normalized.TrimStart('/');
    }
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
```
=== END FILE: backend/src/Trellis.Api/Explain/FileAggregator.cs ===

=== FILE: backend/src/Trellis.Api/Explain/GitProvider.cs ===
```csharp
namespace Trellis.Api.Explain;
public enum GitProvider
{
    GitHub,
    GitLab,
}
```
=== END FILE: backend/src/Trellis.Api/Explain/GitProvider.cs ===

=== FILE: backend/src/Trellis.Api/Explain/GitRepositoryFetcher.cs ===
```csharp
using System.IO.Compression;
using System.Text;
namespace Trellis.Api.Explain;
public class GitRepositoryFetcher : IGitRepositoryFetcher
{
    private const long MaxArchiveBytes = 100 * 1024 * 1024;
    private const long MaxFileBytes = 512 * 1024;
    private readonly HttpClient httpClient;
    public GitRepositoryFetcher(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }
    public async Task<IReadOnlyList<SourceFile>> FetchAsync(GitRepositorySelection selection, CancellationToken cancellationToken)
    {
        var archiveUri = BuildArchiveUri(selection);
        using var response = await this.SendAsync(archiveUri, cancellationToken);
        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new ExplainSourceException(
                "The repository (or the branch/path in the URL) was not found. Private repositories are not supported.");
        }
        if (!response.IsSuccessStatusCode)
        {
            throw new ExplainSourceException(
                $"Could not download the repository archive (HTTP {(int)response.StatusCode}).");
        }
        var archive = await ReadCappedAsync(response, cancellationToken);
        return ExtractSelection(archive, selection);
    }
    private async Task<HttpResponseMessage> SendAsync(Uri archiveUri, CancellationToken cancellationToken)
    {
        try
        {
            return await this.httpClient.GetAsync(archiveUri, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        }
        catch (HttpRequestException)
        {
            throw new ExplainSourceException("Could not reach the repository host.");
        }
        catch (TaskCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new ExplainSourceException("The repository download timed out.");
        }
    }
    private static Uri BuildArchiveUri(GitRepositorySelection selection)
    {
        if (selection.Provider == GitProvider.GitHub)
        {
            var reference = selection.Reference is null
                ? "HEAD"
                : string.Join('/', selection.Reference.Split('/').Select(Uri.EscapeDataString));
            return new Uri($"https://codeload.github.com/{selection.ProjectPath}/zip/{reference}");
        }
        var project = Uri.EscapeDataString(selection.ProjectPath);
        var query = selection.Reference is null ? string.Empty : $"?sha={Uri.EscapeDataString(selection.Reference)}";
        return new Uri($"https://{selection.Host}/api/v4/projects/{project}/repository/archive.zip{query}");
    }
    private static async Task<MemoryStream> ReadCappedAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.Content.Headers.ContentLength is > MaxArchiveBytes)
        {
            throw new ExplainSourceException("The repository archive is too large to aggregate.");
        }
        var buffer = new MemoryStream();
        var chunk = new byte[81920];
        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
        int read;
        while ((read = await source.ReadAsync(chunk, cancellationToken)) > 0)
        {
            buffer.Write(chunk, 0, read);
            if (buffer.Length > MaxArchiveBytes)
            {
                throw new ExplainSourceException("The repository archive is too large to aggregate.");
            }
        }
        buffer.Position = 0;
        return buffer;
    }
    private static IReadOnlyList<SourceFile> ExtractSelection(MemoryStream archiveStream, GitRepositorySelection selection)
    {
        using var archive = OpenArchive(archiveStream);
        var files = new List<SourceFile>();
        foreach (var entry in archive.Entries)
        {
            if (entry.Name.Length == 0)
            {
                continue;
            }
            var separatorIndex = entry.FullName.IndexOf('/');
            if (separatorIndex < 0)
            {
                continue;
            }
            var relativePath = entry.FullName[(separatorIndex + 1)..];
            if (!MatchesSelection(relativePath, selection) || !ExplainContentPolicy.IsIncluded(relativePath))
            {
                continue;
            }
            if (entry.Length > MaxFileBytes)
            {
                continue;
            }
            var content = ReadEntryText(entry);
            if (content is null)
            {
                continue;
            }
            files.Add(new SourceFile(relativePath, content));
        }
        return files;
    }
    private static ZipArchive OpenArchive(MemoryStream archiveStream)
    {
        try
        {
            return new ZipArchive(archiveStream, ZipArchiveMode.Read);
        }
        catch (InvalidDataException)
        {
            throw new ExplainSourceException("The provider did not return a valid repository archive.");
        }
    }
    private static bool MatchesSelection(string relativePath, GitRepositorySelection selection)
        => selection.Kind switch
        {
            GitSelectionKind.Blob => string.Equals(relativePath, selection.SubPath, StringComparison.Ordinal),
            GitSelectionKind.Tree => relativePath.StartsWith(selection.SubPath + "/", StringComparison.Ordinal),
            _ => true,
        };
    private static string? ReadEntryText(ZipArchiveEntry entry)
    {
        using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
        var content = reader.ReadToEnd();
        return content.Contains('\0') ? null : content;
    }
}
```
=== END FILE: backend/src/Trellis.Api/Explain/GitRepositoryFetcher.cs ===

=== FILE: backend/src/Trellis.Api/Explain/GitRepositorySelection.cs ===
```csharp
namespace Trellis.Api.Explain;
public sealed record GitRepositorySelection
{
    public required GitProvider Provider { get; init; }
    public required string Host { get; init; }
    public required string ProjectPath { get; init; }
    public required GitSelectionKind Kind { get; init; }
    public string? Reference { get; init; }
    public string? SubPath { get; init; }
}
```
=== END FILE: backend/src/Trellis.Api/Explain/GitRepositorySelection.cs ===

=== FILE: backend/src/Trellis.Api/Explain/GitRepositoryUrlParser.cs ===
```csharp
namespace Trellis.Api.Explain;
public static class GitRepositoryUrlParser
{
    private const string UnsupportedUrlMessage =
        "Enter a GitHub or GitLab URL: a repository, or a folder (/tree/...) or file (/blob/...) inside one.";
    public static bool TryParse(string url, out GitRepositorySelection? selection, out string? error)
    {
        selection = null;
        error = null;
        if (!Uri.TryCreate(url?.Trim(), UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
        {
            error = UnsupportedUrlMessage;
            return false;
        }
        var segments = uri.AbsolutePath.Trim('/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        if (string.Equals(uri.Host, "github.com", StringComparison.OrdinalIgnoreCase)
            || string.Equals(uri.Host, "www.github.com", StringComparison.OrdinalIgnoreCase))
        {
            return TryParseGitHub(uri.Host, segments, out selection, out error);
        }
        if (uri.Host.Contains("gitlab", StringComparison.OrdinalIgnoreCase))
        {
            return TryParseGitLab(uri.Host, segments, out selection, out error);
        }
        error = "Only GitHub and GitLab URLs are supported.";
        return false;
    }
    private static bool TryParseGitHub(string host, string[] segments, out GitRepositorySelection? selection, out string? error)
    {
        selection = null;
        error = null;
        if (segments.Length < 2)
        {
            error = UnsupportedUrlMessage;
            return false;
        }
        var projectPath = segments[0] + "/" + TrimGitSuffix(segments[1]);
        if (segments.Length == 2)
        {
            selection = new GitRepositorySelection
            {
                Provider = GitProvider.GitHub,
                Host = host,
                ProjectPath = projectPath,
                Kind = GitSelectionKind.Repository,
            };
            return true;
        }
        return TryParseTreeOrBlob(GitProvider.GitHub, host, projectPath, segments[2..], out selection, out error);
    }
    private static bool TryParseGitLab(string host, string[] segments, out GitRepositorySelection? selection, out string? error)
    {
        selection = null;
        error = null;
        var separatorIndex = Array.IndexOf(segments, "-");
        if (separatorIndex < 0)
        {
            if (segments.Length < 2)
            {
                error = UnsupportedUrlMessage;
                return false;
            }
            var wholeProject = string.Join('/', segments[..^1]) + "/" + TrimGitSuffix(segments[^1]);
            selection = new GitRepositorySelection
            {
                Provider = GitProvider.GitLab,
                Host = host,
                ProjectPath = wholeProject,
                Kind = GitSelectionKind.Repository,
            };
            return true;
        }
        if (separatorIndex < 2)
        {
            error = UnsupportedUrlMessage;
            return false;
        }
        var projectPath = string.Join('/', segments[..separatorIndex]);
        return TryParseTreeOrBlob(GitProvider.GitLab, host, projectPath, segments[(separatorIndex + 1)..], out selection, out error);
    }
    private static bool TryParseTreeOrBlob(GitProvider provider, string host, string projectPath, string[] tail, out GitRepositorySelection? selection, out string? error)
    {
        selection = null;
        error = null;
        if (tail.Length < 2 || (tail[0] != "tree" && tail[0] != "blob"))
        {
            error = UnsupportedUrlMessage;
            return false;
        }
        var reference = tail[1];
        var subPath = tail.Length > 2 ? string.Join('/', tail[2..]) : null;
        if (tail[0] == "blob" && subPath is null)
        {
            error = UnsupportedUrlMessage;
            return false;
        }
        selection = new GitRepositorySelection
        {
            Provider = provider,
            Host = host,
            ProjectPath = projectPath,
            Kind = subPath is null ? GitSelectionKind.Repository : (tail[0] == "blob" ? GitSelectionKind.Blob : GitSelectionKind.Tree),
            Reference = reference,
            SubPath = subPath,
        };
        return true;
    }
    private static string TrimGitSuffix(string repository)
        => repository.EndsWith(".git", StringComparison.OrdinalIgnoreCase) ? repository[..^4] : repository;
}
```
=== END FILE: backend/src/Trellis.Api/Explain/GitRepositoryUrlParser.cs ===

=== FILE: backend/src/Trellis.Api/Explain/GitSelectionKind.cs ===
```csharp
namespace Trellis.Api.Explain;
public enum GitSelectionKind
{
    Repository,
    Tree,
    Blob,
}
```
=== END FILE: backend/src/Trellis.Api/Explain/GitSelectionKind.cs ===

=== FILE: backend/src/Trellis.Api/Explain/IExplainPromptBuilder.cs ===
```csharp
namespace Trellis.Api.Explain;
public interface IExplainPromptBuilder
{
    string Build(AggregationResult aggregation);
}
```
=== END FILE: backend/src/Trellis.Api/Explain/IExplainPromptBuilder.cs ===

=== FILE: backend/src/Trellis.Api/Explain/IFileAggregator.cs ===
```csharp
namespace Trellis.Api.Explain;
public interface IFileAggregator
{
    AggregationResult Aggregate(IReadOnlyList<SourceFile> files);
}
```
=== END FILE: backend/src/Trellis.Api/Explain/IFileAggregator.cs ===

=== FILE: backend/src/Trellis.Api/Explain/IGitRepositoryFetcher.cs ===
```csharp
namespace Trellis.Api.Explain;
public interface IGitRepositoryFetcher
{
    Task<IReadOnlyList<SourceFile>> FetchAsync(GitRepositorySelection selection, CancellationToken cancellationToken);
}
```
=== END FILE: backend/src/Trellis.Api/Explain/IGitRepositoryFetcher.cs ===

=== FILE: backend/src/Trellis.Api/Explain/SourceCodeStripper.cs ===
```csharp
using System.Text;
namespace Trellis.Api.Explain;
public static class SourceCodeStripper
{
    public static string Strip(string content, string path)
    {
        var extension = System.IO.Path.GetExtension(path).ToLowerInvariant();
        var withoutComments = extension switch
        {
            ".ts" or ".cs" or ".scss" or ".css" => StripCLikeComments(content),
            ".html" or ".csproj" => StripHtmlComments(content),
            _ => content,
        };
        return CollapseWhitespace(withoutComments);
    }
    private static string StripCLikeComments(string content)
    {
        var result = new StringBuilder(content.Length);
        var inString = false;
        var stringDelimiter = '\0';
        var i = 0;
        while (i < content.Length)
        {
            var current = content[i];
            var next = i + 1 < content.Length ? content[i + 1] : '\0';
            if (inString)
            {
                result.Append(current);
                if (current == '\\' && i + 1 < content.Length)
                {
                    result.Append(next);
                    i += 2;
                    continue;
                }
                if (current == stringDelimiter || current == '\n')
                {
                    inString = false;
                }
                i++;
                continue;
            }
            if (current is '"' or '\'' or '`')
            {
                inString = true;
                stringDelimiter = current;
                result.Append(current);
                i++;
                continue;
            }
            if (current == '/' && next == '/' && (i == 0 || content[i - 1] != ':'))
            {
                while (i < content.Length && content[i] != '\n')
                {
                    i++;
                }
                continue;
            }
            if (current == '/' && next == '*')
            {
                i += 2;
                while (i + 1 < content.Length && !(content[i] == '*' && content[i + 1] == '/'))
                {
                    i++;
                }
                i = Math.Min(i + 2, content.Length);
                continue;
            }
            result.Append(current);
            i++;
        }
        return result.ToString();
    }
    private static string StripHtmlComments(string content)
    {
        var result = new StringBuilder(content.Length);
        var i = 0;
        while (i < content.Length)
        {
            if (i + 3 < content.Length && content[i] == '<' && content[i + 1] == '!' && content[i + 2] == '-' && content[i + 3] == '-')
            {
                var end = content.IndexOf("-->", i + 4, StringComparison.Ordinal);
                i = end < 0 ? content.Length : end + 3;
                continue;
            }
            result.Append(content[i]);
            i++;
        }
        return result.ToString();
    }
    private static string CollapseWhitespace(string content)
    {
        var lines = content.Split('\n');
        var kept = new List<string>(lines.Length);
        foreach (var line in lines)
        {
            var trimmed = line.TrimEnd('\r', ' ', '\t');
            if (trimmed.Length > 0)
            {
                kept.Add(trimmed);
            }
        }
        return string.Join('\n', kept);
    }
}
```
=== END FILE: backend/src/Trellis.Api/Explain/SourceCodeStripper.cs ===

=== FILE: backend/src/Trellis.Api/Explain/SourceFile.cs ===
```csharp
namespace Trellis.Api.Explain;
public sealed record SourceFile(string Path, string Content);
```
=== END FILE: backend/src/Trellis.Api/Explain/SourceFile.cs ===
