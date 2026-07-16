using Trellis.Api.Explain;

namespace Trellis.Api.IntegrationTests.Fakes;

/// <summary>
/// An <see cref="IGitRepositoryFetcher"/> that returns canned files (or
/// throws a canned <see cref="ExplainSourceException"/>) so controller tests
/// never touch the network.
/// </summary>
public class FakeGitRepositoryFetcher : IGitRepositoryFetcher
{
    /// <summary>
    /// Gets or sets the files the next fetch resolves with.
    /// </summary>
    public IReadOnlyList<SourceFile> Files { get; set; } = Array.Empty<SourceFile>();

    /// <summary>
    /// Gets or sets a message to fail the next fetch with, or null to succeed.
    /// </summary>
    public string? FailWith { get; set; }

    /// <summary>
    /// Gets the selection the most recent fetch was asked for.
    /// </summary>
    public GitRepositorySelection? LastSelection { get; private set; }

    /// <inheritdoc />
    public Task<IReadOnlyList<SourceFile>> FetchAsync(GitRepositorySelection selection, CancellationToken cancellationToken)
    {
        this.LastSelection = selection;

        if (this.FailWith is not null)
        {
            throw new ExplainSourceException(this.FailWith);
        }

        return Task.FromResult(this.Files);
    }
}
