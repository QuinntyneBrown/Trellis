using System.IO.Compression;
using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// Default <see cref="IGitRepositoryFetcher"/>: one anonymous archive
/// download per request -- GitHub's codeload zipball, or GitLab's v4
/// <c>repository/archive.zip</c> API (which resolves the default branch
/// itself when no <c>sha</c> is passed) -- extracted in memory and filtered
/// down to the requested sub-path. Archive size is capped so a pathological
/// repository cannot exhaust server memory.
/// </summary>
public class GitRepositoryFetcher : IGitRepositoryFetcher
{
    /// <summary>Compressed-archive download cap.</summary>
    private const long MaxArchiveBytes = 100 * 1024 * 1024;

    /// <summary>Individual files larger than this are skipped (almost certainly generated).</summary>
    private const long MaxFileBytes = 512 * 1024;

    private readonly HttpClient httpClient;

    /// <summary>
    /// Initializes a new instance of the <see cref="GitRepositoryFetcher"/> class.
    /// </summary>
    /// <param name="httpClient">The HTTP client used for archive downloads.</param>
    public GitRepositoryFetcher(HttpClient httpClient)
    {
        this.httpClient = httpClient;
    }

    /// <inheritdoc />
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

    /// <summary>
    /// Issues the download, translating network-level failures (DNS, refused
    /// connection, timeout) into user-facing <see cref="ExplainSourceException"/>s.
    /// </summary>
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

    /// <summary>
    /// Builds the provider archive URI. GitHub's codeload accepts branch,
    /// tag, commit or the literal <c>HEAD</c> (the default branch); GitLab's
    /// archive API defaults to the default branch when <c>sha</c> is omitted.
    /// </summary>
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
            // Directory entries have an empty Name; both providers put every
            // file under a single "<repo>-<ref>/" root folder, stripped here.
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

    /// <summary>Reads an entry as UTF-8 text; returns null for binary-looking content.</summary>
    private static string? ReadEntryText(ZipArchiveEntry entry)
    {
        using var reader = new StreamReader(entry.Open(), Encoding.UTF8);
        var content = reader.ReadToEnd();
        return content.Contains('\0') ? null : content;
    }
}
