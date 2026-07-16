using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Trellis.Api.Explain;
using Trellis.Api.IntegrationTests.Fakes;
using Trellis.Api.Models;

namespace Trellis.Api.IntegrationTests.Controllers;

/// <summary>
/// Exercises both explain endpoints over real HTTP, with the repository
/// fetcher swapped for <see cref="FakeGitRepositoryFetcher"/> so no test
/// touches GitHub/GitLab.
/// </summary>
public class ExplainControllerTests : IClassFixture<ExplainControllerTests.ExplainWebApplicationFactory>
{
    private readonly HttpClient client;
    private readonly FakeGitRepositoryFetcher fetcher;

    public ExplainControllerTests(ExplainWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
        this.fetcher = (FakeGitRepositoryFetcher)factory.Services.GetRequiredService<IGitRepositoryFetcher>();
        this.fetcher.FailWith = null;
        this.fetcher.Files = Array.Empty<SourceFile>();
    }

    [Fact]
    public async Task Aggregate_ReturnsCompactPrompt_AndMarkdownAttachmentWithFencedFiles()
    {
        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate", new
        {
            files = new[]
            {
                new { path = "src/app.ts", content = "// comment\nconst a = 1;\n" },
                new { path = "docs/context.puml", content = "@startuml\nA -> B\n@enduml" },
                new { path = "README.md", content = "# Readme\n" },
            },
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ExplainPromptDto>();
        Assert.NotNull(dto);
        Assert.Equal(3, dto!.FileCount);
        Assert.StartsWith("# Explain This — Software Design Document", dto.Prompt);
        Assert.Contains("enterprise Confluence knowledge base", dto.Prompt);
        Assert.Contains("do not make HTTP calls", dto.Prompt);
        Assert.Contains("`## 1. Document control`", dto.Prompt);
        Assert.Contains("`## 15. Glossary`", dto.Prompt);
        Assert.Contains("### Controlled architecture vocabulary", dto.Prompt);
        Assert.Contains("| system of interest | entity of interest (EoI) |", dto.Prompt);
        Assert.Contains("<TO SUPPLY: …>", dto.Prompt);
        Assert.DoesNotContain("Quiz", dto.Prompt);
        Assert.DoesNotContain("architecture-description-style-guide", dto.Prompt);
        Assert.Contains("## Uploaded files", dto.Prompt);
        Assert.Contains("`explain-this-files.md` (3 files)", dto.Prompt);
        Assert.DoesNotMatch("(?m)^=== FILE:", dto.Prompt);
        Assert.Equal("explain-this-files.md", dto.AttachmentFileName);
        Assert.Contains("=== FILE: docs/context.puml ===\n```plantuml\n@startuml", dto.AttachmentContent);
        Assert.Contains("=== FILE: src/app.ts ===", dto.AttachmentContent);
        Assert.DoesNotContain("// comment", dto.AttachmentContent);
        Assert.DoesNotContain("# Explain This", dto.AttachmentContent);
    }

    [Fact]
    public async Task Aggregate_ReturnsBadRequest_WhenNoSupportedFilesSurvive()
    {
        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate", new
        {
            files = new[] { new { path = "binary.exe", content = "x" } },
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Contains("No supported files", problem!.Title);
    }

    [Fact]
    public async Task Aggregate_ReturnsBadRequest_ForEmptyFileList()
    {
        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate", new { files = Array.Empty<object>() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AggregateUrl_ReturnsPrompt_ForFetchedRepository()
    {
        this.fetcher.Files = new[] { new SourceFile("src/main.cs", "class Program { }") };

        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate-url", new
        {
            url = "https://github.com/owner/repo/tree/main/src",
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ExplainPromptDto>();
        Assert.Equal(1, dto!.FileCount);
        Assert.Contains("`explain-this-files.md` (1 file)", dto.Prompt);
        Assert.DoesNotMatch("(?m)^=== FILE:", dto.Prompt);
        Assert.Equal("explain-this-files.md", dto.AttachmentFileName);
        Assert.Contains("=== FILE: src/main.cs ===", dto.AttachmentContent);

        Assert.NotNull(this.fetcher.LastSelection);
        Assert.Equal("owner/repo", this.fetcher.LastSelection!.ProjectPath);
        Assert.Equal(GitSelectionKind.Tree, this.fetcher.LastSelection.Kind);
    }

    [Fact]
    public async Task AggregateUrl_ReturnsBadRequest_ForUnparsableUrl()
    {
        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate-url", new { url = "https://example.com/nope" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Only GitHub and GitLab URLs are supported.", problem!.Title);
    }

    [Fact]
    public async Task AggregateUrl_TranslatesFetchFailures_ToBadRequestProblems()
    {
        this.fetcher.FailWith = "The repository (or the branch/path in the URL) was not found. Private repositories are not supported.";

        var response = await this.client.PostAsJsonAsync("/api/explain/aggregate-url", new { url = "https://github.com/owner/missing" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Contains("was not found", problem!.Title);
    }

    /// <summary>
    /// A <see cref="CustomWebApplicationFactory"/> that additionally swaps the
    /// git fetcher for the fake (as a singleton, so tests can reach in and
    /// program it).
    /// </summary>
    public class ExplainWebApplicationFactory : CustomWebApplicationFactory
    {
        /// <inheritdoc />
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IGitRepositoryFetcher>();
                services.AddSingleton<IGitRepositoryFetcher, FakeGitRepositoryFetcher>();
            });
        }
    }
}
