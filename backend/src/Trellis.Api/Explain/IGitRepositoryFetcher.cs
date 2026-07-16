namespace Trellis.Api.Explain;

/// <summary>
/// Downloads the source files a <see cref="GitRepositorySelection"/> points at.
/// </summary>
public interface IGitRepositoryFetcher
{
    /// <summary>
    /// Downloads the repository archive and returns the text files inside the
    /// selection, filtered through <see cref="ExplainContentPolicy"/>.
    /// </summary>
    /// <param name="selection">The parsed URL selection.</param>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The selected source files, with selection-relative paths.</returns>
    /// <exception cref="ExplainSourceException">The archive could not be downloaded or is too large.</exception>
    Task<IReadOnlyList<SourceFile>> FetchAsync(GitRepositorySelection selection, CancellationToken cancellationToken);
}
