using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Trellis.Api.Domain;
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
        Assert.StartsWith("# Explain This", dto.Prompt);
        Assert.Contains("do not make HTTP calls", dto.Prompt);
        Assert.Contains("## Overview", dto.Prompt);
        Assert.Contains("## Class Diagrams", dto.Prompt);
        Assert.Contains("## Sequence Diagrams", dto.Prompt);
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

    [Fact]
    public async Task AggregateFolder_AggregatesSubtreeDocuments_IntoPromptAndFencedAttachment()
    {
        // outer > Inner; a PlantUML document in outer and a markdown document in
        // Inner. Documents map to .puml/.md source files whose paths are
        // relative to the explained folder (the inner document sits under its
        // subfolder name), and the aggregator sorts entries by path.
        var outer = await this.CreateFolderAsync("Explain outer");
        var inner = await this.CreateFolderAsync("Inner", outer.Id);
        await this.CreateDocumentAsync("beta-diagram", "@startuml\nA -> B\n@enduml", outer.Id, "plantuml");
        await this.CreateDocumentAsync("alpha-notes", "# Title\n\nBody *text*.", inner.Id, "markdown");

        var response = await this.client.GetAsync($"/api/explain/folder/{outer.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ExplainPromptDto>();
        Assert.NotNull(dto);
        Assert.Equal(2, dto!.FileCount);
        Assert.StartsWith("# Explain This", dto.Prompt);
        Assert.Contains("`explain-this-files.md` (2 files)", dto.Prompt);
        Assert.Equal("explain-this-files.md", dto.AttachmentFileName);
        Assert.Contains("=== FILE: beta-diagram.puml ===\n```plantuml\n@startuml", dto.AttachmentContent);
        Assert.Contains("=== FILE: Inner/alpha-notes.md ===", dto.AttachmentContent);
        Assert.Contains("# Title", dto.AttachmentContent);
    }

    [Fact]
    public async Task AggregateFolder_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.GetAsync($"/api/explain/folder/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AggregateFolder_ReturnsBadRequest_WhenFolderHasNoDocuments()
    {
        var folder = await this.CreateFolderAsync("Explain empty");
        await this.CreateFolderAsync("Also empty", folder.Id);

        var response = await this.client.GetAsync($"/api/explain/folder/{folder.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Contains("no documents to explain", problem!.Title);
    }

    private async Task<Folder> CreateFolderAsync(string name, Guid? parentFolderId = null)
    {
        var response = await this.client.PostAsJsonAsync("/api/folders", new { name, parentFolderId });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<Folder>())!;
    }

    private async Task<PlantUmlDocument> CreateDocumentAsync(string name, string content, Guid folderId, string kind)
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name, content, folderId, kind });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PlantUmlDocument>())!;
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
