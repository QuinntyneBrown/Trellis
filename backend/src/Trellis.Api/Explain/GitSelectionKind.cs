namespace Trellis.Api.Explain;

/// <summary>
/// What granularity a repository URL points at.
/// </summary>
public enum GitSelectionKind
{
    /// <summary>The whole repository (its default branch unless a ref was named).</summary>
    Repository,

    /// <summary>A folder inside the repository (a /tree/ URL).</summary>
    Tree,

    /// <summary>A single file inside the repository (a /blob/ URL).</summary>
    Blob,
}
