namespace Trellis.Api.Explain;

/// <summary>
/// Parses the GitHub/GitLab URL shapes the "Explain This" wizard accepts:
/// a repository root, a folder (<c>/tree/ref/path</c>) or a single file
/// (<c>/blob/ref/path</c>), including GitLab's <c>/-/</c>-separated forms
/// and subgroup project paths.
///
/// Refs containing slashes (e.g. <c>feature/x</c> branches) cannot be
/// distinguished from the leading path segments without asking the provider,
/// so the first segment after tree/blob is always taken as the ref -- the
/// same simplifying assumption most URL-parsing tools make.
/// </summary>
public static class GitRepositoryUrlParser
{
    private const string UnsupportedUrlMessage =
        "Enter a GitHub or GitLab URL: a repository, or a folder (/tree/...) or file (/blob/...) inside one.";

    /// <summary>
    /// Attempts to parse <paramref name="url"/> into a
    /// <see cref="GitRepositorySelection"/>.
    /// </summary>
    /// <param name="url">The URL as typed by the user.</param>
    /// <param name="selection">The parsed selection on success.</param>
    /// <param name="error">A user-facing error message on failure.</param>
    /// <returns><see langword="true"/> when the URL was recognized.</returns>
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

        // GitLab separates the (possibly subgrouped) project path from the
        // route with a literal "-" segment: group/sub/repo/-/tree/main/src.
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

    /// <summary>Parses the route tail shared by both providers: <c>tree|blob / ref / path...</c>.</summary>
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
