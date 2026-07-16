namespace Trellis.Api.Explain;

/// <summary>
/// The hosting provider a repository URL was recognized as.
/// </summary>
public enum GitProvider
{
    /// <summary>github.com, archives via codeload.github.com.</summary>
    GitHub,

    /// <summary>gitlab.com or a self-hosted GitLab, archives via its v4 REST API.</summary>
    GitLab,
}
