namespace Trellis.Api.Explain;

/// <summary>
/// A parsed GitHub/GitLab URL: which provider and host, the project path
/// (owner/repo, possibly with GitLab subgroups), the named ref (null means
/// the default branch) and the sub-path selected inside the repository.
/// </summary>
public sealed record GitRepositorySelection
{
    /// <summary>Gets the hosting provider.</summary>
    public required GitProvider Provider { get; init; }

    /// <summary>Gets the host name, e.g. "github.com" or a self-hosted GitLab host.</summary>
    public required string Host { get; init; }

    /// <summary>Gets the project path, e.g. "owner/repo" or "group/subgroup/repo".</summary>
    public required string ProjectPath { get; init; }

    /// <summary>Gets what granularity the URL selects.</summary>
    public required GitSelectionKind Kind { get; init; }

    /// <summary>Gets the branch/tag/commit named in the URL, or null for the default branch.</summary>
    public string? Reference { get; init; }

    /// <summary>Gets the folder or file path inside the repository, or null for the repository root.</summary>
    public string? SubPath { get; init; }
}
