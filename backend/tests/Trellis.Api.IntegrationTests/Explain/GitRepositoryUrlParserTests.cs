using Trellis.Api.Explain;

namespace Trellis.Api.IntegrationTests.Explain;

/// <summary>
/// Pins the URL shapes the "Explain This" wizard accepts: GitHub and GitLab
/// repository roots, /tree/ folders and /blob/ files (including GitLab's
/// /-/ route separator and subgroup project paths), and the rejection
/// messages for everything else.
/// </summary>
public class GitRepositoryUrlParserTests
{
    [Fact]
    public void Parses_GitHubRepositoryRoot()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://github.com/QuinntyneBrown/GetFiles", out var selection, out var error);

        Assert.True(ok);
        Assert.Null(error);
        Assert.Equal(GitProvider.GitHub, selection!.Provider);
        Assert.Equal("QuinntyneBrown/GetFiles", selection.ProjectPath);
        Assert.Equal(GitSelectionKind.Repository, selection.Kind);
        Assert.Null(selection.Reference);
        Assert.Null(selection.SubPath);
    }

    [Fact]
    public void Parses_GitHubRepository_TrimmingDotGitSuffix()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://github.com/owner/repo.git", out var selection, out _);

        Assert.True(ok);
        Assert.Equal("owner/repo", selection!.ProjectPath);
    }

    [Fact]
    public void Parses_GitHubTreeUrl_WithRefAndPath()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://github.com/owner/repo/tree/main/src/app", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitSelectionKind.Tree, selection!.Kind);
        Assert.Equal("main", selection.Reference);
        Assert.Equal("src/app", selection.SubPath);
    }

    [Fact]
    public void Parses_GitHubBlobUrl_AsSingleFile()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://github.com/owner/repo/blob/main/README.md", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitSelectionKind.Blob, selection!.Kind);
        Assert.Equal("main", selection.Reference);
        Assert.Equal("README.md", selection.SubPath);
    }

    [Fact]
    public void Parses_GitHubTreeUrl_WithRefButNoPath_AsWholeRepositoryAtRef()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://github.com/owner/repo/tree/v1.2.3", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitSelectionKind.Repository, selection!.Kind);
        Assert.Equal("v1.2.3", selection.Reference);
        Assert.Null(selection.SubPath);
    }

    [Fact]
    public void Parses_GitLabProjectWithSubgroups()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://gitlab.com/group/subgroup/project", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitProvider.GitLab, selection!.Provider);
        Assert.Equal("group/subgroup/project", selection.ProjectPath);
        Assert.Equal(GitSelectionKind.Repository, selection.Kind);
    }

    [Fact]
    public void Parses_GitLabTreeUrl_WithDashSeparator()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://gitlab.com/group/project/-/tree/main/docs", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitProvider.GitLab, selection!.Provider);
        Assert.Equal("group/project", selection.ProjectPath);
        Assert.Equal(GitSelectionKind.Tree, selection.Kind);
        Assert.Equal("main", selection.Reference);
        Assert.Equal("docs", selection.SubPath);
    }

    [Fact]
    public void Parses_GitLabBlobUrl()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://gitlab.com/group/project/-/blob/main/src/main.ts", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitSelectionKind.Blob, selection!.Kind);
        Assert.Equal("src/main.ts", selection.SubPath);
    }

    [Fact]
    public void Parses_SelfHostedGitLabHost()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://gitlab.example.com/team/repo", out var selection, out _);

        Assert.True(ok);
        Assert.Equal(GitProvider.GitLab, selection!.Provider);
        Assert.Equal("gitlab.example.com", selection.Host);
    }

    [Theory]
    [InlineData("not a url")]
    [InlineData("ftp://github.com/owner/repo")]
    [InlineData("https://github.com/owner-only")]
    [InlineData("https://github.com/owner/repo/pulls")]
    [InlineData("https://gitlab.com/group/project/-/issues")]
    public void Rejects_UnsupportedShapes(string url)
    {
        var ok = GitRepositoryUrlParser.TryParse(url, out var selection, out var error);

        Assert.False(ok);
        Assert.Null(selection);
        Assert.NotNull(error);
    }

    [Fact]
    public void Rejects_NonGitHostsWithDedicatedMessage()
    {
        var ok = GitRepositoryUrlParser.TryParse("https://bitbucket.org/owner/repo", out _, out var error);

        Assert.False(ok);
        Assert.Equal("Only GitHub and GitLab URLs are supported.", error);
    }
}
