using System.Net;
using System.Net.Http.Json;
using Trellis.Api.Domain;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

public class FoldersControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient client;

    public FoldersControllerTests(CustomWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_ThenList_ReturnsCreatedRootFolder()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Root folder" });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<Folder>();
        Assert.NotNull(created);
        Assert.Equal("Root folder", created!.Name);
        Assert.Null(created.ParentFolderId);

        var listResponse = await this.client.GetAsync("/api/folders");
        Assert.Equal(HttpStatusCode.OK, listResponse.StatusCode);
        var folders = await listResponse.Content.ReadFromJsonAsync<List<Folder>>();
        Assert.Contains(folders!, f => f.Id == created.Id && f.Name == "Root folder");
    }

    [Fact]
    public async Task Create_WithParent_EchoesParentFolderId()
    {
        var parentResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Parent" });
        var parent = await parentResponse.Content.ReadFromJsonAsync<Folder>();

        var childResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Child", parentFolderId = parent!.Id });

        Assert.Equal(HttpStatusCode.Created, childResponse.StatusCode);
        var child = await childResponse.Content.ReadFromJsonAsync<Folder>();
        Assert.Equal(parent.Id, child!.ParentFolderId);
    }

    [Fact]
    public async Task Create_ReturnsNotFound_ForUnknownParentFolderId()
    {
        var response = await this.client.PostAsJsonAsync("/api/folders", new { name = "Orphan", parentFolderId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsMissing()
    {
        var response = await this.client.PostAsJsonAsync("/api/folders", new { name = string.Empty });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsTooLong()
    {
        var response = await this.client.PostAsJsonAsync("/api/folders", new { name = new string('x', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Rename_ReturnsRenamedFolder()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Before rename" });
        var created = await createResponse.Content.ReadFromJsonAsync<Folder>();

        var renameResponse = await this.client.PutAsJsonAsync($"/api/folders/{created!.Id}", new { name = "After rename" });

        Assert.Equal(HttpStatusCode.OK, renameResponse.StatusCode);
        var renamed = await renameResponse.Content.ReadFromJsonAsync<Folder>();
        Assert.Equal(created.Id, renamed!.Id);
        Assert.Equal("After rename", renamed.Name);
    }

    [Fact]
    public async Task Rename_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.PutAsJsonAsync($"/api/folders/{Guid.NewGuid()}", new { name = "X" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Rename_ReturnsValidationProblem_WhenNameIsMissing()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Valid name" });
        var created = await createResponse.Content.ReadFromJsonAsync<Folder>();

        var response = await this.client.PutAsJsonAsync($"/api/folders/{created!.Id}", new { name = string.Empty });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Rename_ReturnsValidationProblem_WhenNameIsTooLong()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Valid name" });
        var created = await createResponse.Content.ReadFromJsonAsync<Folder>();

        var response = await this.client.PutAsJsonAsync($"/api/folders/{created!.Id}", new { name = new string('x', 201) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesFolder()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "To delete" });
        var created = await createResponse.Content.ReadFromJsonAsync<Folder>();

        var deleteResponse = await this.client.DeleteAsync($"/api/folders/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var folders = await this.client.GetFromJsonAsync<List<Folder>>("/api/folders");
        Assert.DoesNotContain(folders!, f => f.Id == created.Id);
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.DeleteAsync($"/api/folders/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_CascadesToSubfoldersAndContainedDocuments()
    {
        // Arrange a subtree: outer > inner, with one document in each, plus an
        // unrelated root document that must survive the cascade.
        var outerResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Cascade outer" });
        var outer = await outerResponse.Content.ReadFromJsonAsync<Folder>();

        var innerResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Cascade inner", parentFolderId = outer!.Id });
        var inner = await innerResponse.Content.ReadFromJsonAsync<Folder>();

        var outerDocResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Doc in outer", content = "c", folderId = outer.Id });
        var outerDoc = await outerDocResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var innerDocResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Doc in inner", content = "c", folderId = inner!.Id });
        var innerDoc = await innerDocResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var rootDocResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Root survivor", content = "c" });
        var rootDoc = await rootDocResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        // Act: deleting the outer folder must take the whole subtree with it.
        var deleteResponse = await this.client.DeleteAsync($"/api/folders/{outer.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var folders = await this.client.GetFromJsonAsync<List<Folder>>("/api/folders");
        Assert.DoesNotContain(folders!, f => f.Id == outer.Id);
        Assert.DoesNotContain(folders!, f => f.Id == inner.Id);

        var outerDocGet = await this.client.GetAsync($"/api/documents/{outerDoc!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, outerDocGet.StatusCode);

        var innerDocGet = await this.client.GetAsync($"/api/documents/{innerDoc!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, innerDocGet.StatusCode);

        var rootDocGet = await this.client.GetAsync($"/api/documents/{rootDoc!.Id}");
        Assert.Equal(HttpStatusCode.OK, rootDocGet.StatusCode);
    }

    [Fact]
    public async Task Export_AggregatesSubtree_WithFencingAndInlineMarkdown_WithoutNames()
    {
        // outer > Inner; a plantuml doc in outer and a markdown doc in Inner.
        // Folder and document names never appear in the export - only content.
        // Subfolder content comes before the parent's own documents, so the
        // expected document is: the markdown doc (inline), then the plantuml
        // doc (fenced).
        var outer = await this.CreateFolderAsync("Export outer");
        var inner = await this.CreateFolderAsync("Inner", outer.Id);

        await this.CreateDocumentAsync("beta-diagram", "@startuml\nA -> B\n@enduml", outer.Id, "plantuml");
        await this.CreateDocumentAsync("alpha-notes", "# Title\n\nBody *text*.", inner.Id, "markdown");

        var response = await this.client.GetAsync($"/api/folders/{outer.Id}/export");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var markdown = await response.Content.ReadAsStringAsync();
        var expected =
            "# Title\n\nBody *text*.\n\n" +
            "```plantuml\n@startuml\nA -> B\n@enduml\n```\n";
        Assert.Equal(expected, markdown);
    }

    [Fact]
    public async Task Export_SortsSiblingDocumentsCaseInsensitivelyByName()
    {
        var folder = await this.CreateFolderAsync("Export sorting");
        await this.CreateDocumentAsync("beta", "beta content", folder.Id, "markdown");
        await this.CreateDocumentAsync("Alpha", "alpha content", folder.Id, "markdown");

        var markdown = await this.client.GetStringAsync($"/api/folders/{folder.Id}/export");

        Assert.Equal("alpha content\n\nbeta content\n", markdown);
    }

    [Fact]
    public async Task Export_RendersIndexDocumentFirst_AboveSubfoldersAndOtherDocuments()
    {
        // "index" is the folder's landing page: its content renders at the very
        // top, before the subfolder content, with the remaining documents
        // following after the subfolders in name order.
        var docs = await this.CreateFolderAsync("Docs");
        var guide = await this.CreateFolderAsync("Guide", docs.Id);

        await this.CreateDocumentAsync("about", "About page.", docs.Id, "markdown");
        await this.CreateDocumentAsync("index", "# Home", docs.Id, "markdown");
        await this.CreateDocumentAsync("setup", "Setup steps.", guide.Id, "markdown");

        var markdown = await this.client.GetStringAsync($"/api/folders/{docs.Id}/export");

        var expected =
            "# Home\n\n" +
            "Setup steps.\n\n" +
            "About page.\n";
        Assert.Equal(expected, markdown);
    }

    [Fact]
    public async Task Export_MatchesIndexNameCaseInsensitively()
    {
        // "Index" (capitalized) is still the index doc, so its content leads
        // even though a plain name sort would put "alpha" ahead of it.
        var folder = await this.CreateFolderAsync("Export index casing");
        await this.CreateDocumentAsync("alpha", "alpha content", folder.Id, "markdown");
        await this.CreateDocumentAsync("Index", "home content", folder.Id, "markdown");

        var markdown = await this.client.GetStringAsync($"/api/folders/{folder.Id}/export");

        Assert.Equal("home content\n\nalpha content\n", markdown);
    }

    [Fact]
    public async Task Export_ReturnsTextMarkdownContentType()
    {
        var folder = await this.CreateFolderAsync("Export content type");

        var response = await this.client.GetAsync($"/api/folders/{folder.Id}/export");

        Assert.Equal("text/markdown", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("utf-8", response.Content.Headers.ContentType?.CharSet);
    }

    [Fact]
    public async Task Export_OmitsFolderAndDocumentNames()
    {
        // Names never appear in the export - an empty subfolder leaves no
        // trace, and the kept document contributes only its content.
        var folder = await this.CreateFolderAsync("Export names");
        await this.CreateFolderAsync("Empty branch", folder.Id);
        await this.CreateDocumentAsync("kept-doc", "content", folder.Id, "markdown");

        var markdown = await this.client.GetStringAsync($"/api/folders/{folder.Id}/export");

        Assert.Equal("content\n", markdown);
    }

    [Fact]
    public async Task Export_ReturnsEmptyNote_WhenSubtreeHasNoDocuments()
    {
        var folder = await this.CreateFolderAsync("Export empty");
        await this.CreateFolderAsync("Also empty", folder.Id);

        var markdown = await this.client.GetStringAsync($"/api/folders/{folder.Id}/export");

        Assert.Equal("_This folder contains no documents._\n", markdown);
    }

    [Fact]
    public async Task Export_IncludesContentFromDeeplyNestedFolders()
    {
        // A 7-deep folder chain: the deepest document's content is still
        // aggregated, with no folder names in the output.
        var current = await this.CreateFolderAsync("Depth 1");
        var rootId = current.Id;
        for (var depth = 2; depth <= 7; depth++)
        {
            current = await this.CreateFolderAsync($"Depth {depth}", current.Id);
        }

        await this.CreateDocumentAsync("deep-doc", "deep content", current.Id, "markdown");

        var markdown = await this.client.GetStringAsync($"/api/folders/{rootId}/export");

        Assert.Equal("deep content\n", markdown);
    }

    [Fact]
    public async Task Export_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.GetAsync($"/api/folders/{Guid.NewGuid()}/export");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
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
}
