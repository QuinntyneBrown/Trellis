using System.Net;
using System.Net.Http.Json;
using Trellis.Api.Domain;
using Trellis.Api.Models;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

public class DocumentsControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient client;

    public DocumentsControllerTests(CustomWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
    }

    [Fact]
    public async Task Create_ThenGetById_ReturnsTheSameDocument()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Integration Doc", content = "@startuml\n@enduml" });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.NotNull(created);
        Assert.Equal("Integration Doc", created!.Name);

        // A newly created document has never been updated.
        Assert.Null(created.UpdatedAt);

        var getResponse = await this.client.GetAsync($"/api/documents/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("@startuml\n@enduml", fetched.Content);
    }

    [Fact]
    public async Task Create_AllowsEmptyContent()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Empty content doc", content = string.Empty });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(string.Empty, created!.Content);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.GetAsync($"/api/documents/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetList_DoesNotIncludeContentField()
    {
        await this.client.PostAsJsonAsync("/api/documents", new { name = "List Doc", content = "@startuml\n@enduml" });

        var response = await this.client.GetAsync("/api/documents");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"content\"", json, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task GetList_OrdersByMostRecentlyTouchedFirst_FallingBackToCreatedAt()
    {
        var firstResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Ordering first", content = "c" });
        var first = await firstResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var secondResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Ordering second", content = "c" });
        var second = await secondResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        // Touch the older document so it becomes the most recently updated.
        await this.client.PutAsJsonAsync($"/api/documents/{first!.Id}", new { name = "Ordering first", content = "c2" });

        var listResponse = await this.client.GetAsync("/api/documents");
        var list = await listResponse.Content.ReadFromJsonAsync<List<DocumentListItemDto>>();
        Assert.NotNull(list);

        var firstIndex = list!.FindIndex(d => d.Id == first.Id);
        var secondIndex = list.FindIndex(d => d.Id == second!.Id);
        Assert.True(firstIndex >= 0 && secondIndex >= 0);
        Assert.True(firstIndex < secondIndex, "The updated document should be listed before the merely created one.");

        // A document that has never been updated falls back to its creation time,
        // so the list always has a non-null "last touched" timestamp.
        var secondListItem = list[secondIndex];
        Assert.Equal(second!.CreatedAt, secondListItem.UpdatedAt);
    }

    [Fact]
    public async Task Update_RouteIdWinsOverBody_AndReturnsUpdatedDocument()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Before", content = "before" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var updateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}", new { name = "After", content = "after" });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("After", updated.Name);
        Assert.Equal("after", updated.Content);
        Assert.NotNull(updated.UpdatedAt);
        Assert.Equal(created.CreatedAt, updated.CreatedAt);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.PutAsJsonAsync($"/api/documents/{Guid.NewGuid()}", new { name = "X", content = "Y" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesDocument()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "To Delete", content = "content" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var deleteResponse = await this.client.DeleteAsync($"/api/documents/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await this.client.GetAsync($"/api/documents/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.DeleteAsync($"/api/documents/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsMissing()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = string.Empty, content = "content" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsTooLong()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = new string('x', 201), content = "content" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithFolderId_PlacesDocumentInFolder()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Docs folder" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Foldered doc", content = "c", folderId = folder!.Id });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(folder.Id, created!.FolderId);

        // The list projection must carry the folder id so the client can build the tree.
        var list = await this.client.GetFromJsonAsync<List<DocumentListItemDto>>("/api/documents");
        var listItem = list!.Single(d => d.Id == created.Id);
        Assert.Equal(folder.Id, listItem.FolderId);
    }

    [Fact]
    public async Task Create_WithoutFolderId_DefaultsToRoot()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Root doc", content = "c" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Null(created!.FolderId);
    }

    [Fact]
    public async Task Create_ReturnsNotFound_ForUnknownFolderId()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Orphan doc", content = "c", folderId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_DoesNotChangeFolder()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Sticky folder" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var otherFolderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Other folder" });
        var otherFolder = await otherFolderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Sticky doc", content = "c", folderId = folder!.Id });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        // Even a body that tries to smuggle in a REAL other folder's id must not
        // move the document - the update contract structurally has no folder field.
        var updateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}", new { name = "Sticky doc renamed", content = "c2", folderId = otherFolder!.Id });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(folder.Id, updated!.FolderId);

        // A null folderId in the body must not move it to the root either.
        var nullUpdateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created.Id}", new { name = "Sticky doc renamed", content = "c3", folderId = (Guid?)null });

        Assert.Equal(HttpStatusCode.OK, nullUpdateResponse.StatusCode);
        var nullUpdated = await nullUpdateResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(folder.Id, nullUpdated!.FolderId);
    }

    [Fact]
    public async Task Create_WithMarkdownKind_PersistsAndEchoesIt()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Notes", content = "# hi", kind = "markdown" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("markdown", created!.Kind);

        var fetched = await this.client.GetFromJsonAsync<PlantUmlDocument>($"/api/documents/{created.Id}");
        Assert.Equal("markdown", fetched!.Kind);
    }

    [Fact]
    public async Task Create_WithoutKind_DefaultsToPlantUml()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Diagram", content = "@startuml\n@enduml" });

        var created = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("plantuml", created!.Kind);
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_ForUnknownKind()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "X", content = "c", kind = "asciidoc" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_PreservesKind()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Notes", content = "# v1", kind = "markdown" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var updateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}", new { name = "Notes", content = "# v2" });

        var updated = await updateResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("markdown", updated!.Kind);
    }

    [Fact]
    public async Task GetList_CarriesTheKind()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Kind list doc", content = "# md", kind = "markdown" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var list = await this.client.GetFromJsonAsync<List<DocumentListItemDto>>("/api/documents");
        var listItem = list!.Single(d => d.Id == created!.Id);

        Assert.Equal("markdown", listItem.Kind);
    }

    [Fact]
    public async Task GetList_CarriesTheExportExclusion()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Excluded list doc", content = "c" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/export-exclusion", new { excludedFromExport = true });

        // The list projection must carry the flag so the tree can badge excluded documents.
        var list = await this.client.GetFromJsonAsync<List<DocumentListItemDto>>("/api/documents");
        var listItem = list!.Single(d => d.Id == created.Id);

        Assert.True(listItem.ExcludedFromExport);
    }

    [Fact]
    public async Task Create_DefaultsToIncludedInExport()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = "Included doc", content = "c" });

        var created = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.False(created!.ExcludedFromExport);
    }

    [Fact]
    public async Task Update_PreservesExportExclusion()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Sticky exclusion", content = "v1" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/export-exclusion", new { excludedFromExport = true });

        var updateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created.Id}", new { name = "Sticky exclusion", content = "v2" });

        var updated = await updateResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.True(updated!.ExcludedFromExport);
    }

    [Fact]
    public async Task Move_ToAnotherFolder_UpdatesFolderId()
    {
        var folderAResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Move source" });
        var folderA = await folderAResponse.Content.ReadFromJsonAsync<Folder>();

        var folderBResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Move target" });
        var folderB = await folderBResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Movable doc", content = "c", folderId = folderA!.Id });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var moveResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/folder", new { folderId = folderB!.Id });

        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(folderB.Id, moved!.FolderId);

        // The list projection must reflect the move so the client tree rebuilds correctly.
        var list = await this.client.GetFromJsonAsync<List<DocumentListItemDto>>("/api/documents");
        var listItem = list!.Single(d => d.Id == created.Id);
        Assert.Equal(folderB.Id, listItem.FolderId);
    }

    [Fact]
    public async Task Move_ToRoot_WithNullFolderId()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Departure folder" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Root-bound doc", content = "c", folderId = folder!.Id });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var moveResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/folder", new { folderId = (Guid?)null });

        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Null(moved!.FolderId);
    }

    [Fact]
    public async Task Move_ToRoot_WithAbsentFolderId()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Departure folder 2" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Root-bound doc 2", content = "c", folderId = folder!.Id });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        // Unlike the update endpoint, absent and null deliberately mean the same
        // thing here (root) - the move body has no "leave unchanged" case.
        var moveResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/folder", new { });

        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Null(moved!.FolderId);
    }

    [Fact]
    public async Task Move_ReturnsNotFound_ForUnknownFolder_AndLeavesDocumentUnmoved()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Home folder" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Homebody doc", content = "c", folderId = folder!.Id });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var moveResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/folder", new { folderId = Guid.NewGuid() });

        Assert.Equal(HttpStatusCode.NotFound, moveResponse.StatusCode);

        var fetched = await this.client.GetFromJsonAsync<PlantUmlDocument>($"/api/documents/{created.Id}");
        Assert.Equal(folder.Id, fetched!.FolderId);
    }

    [Fact]
    public async Task Move_ReturnsNotFound_ForUnknownDocument()
    {
        var response = await this.client.PutAsJsonAsync($"/api/documents/{Guid.NewGuid()}/folder", new { folderId = (Guid?)null });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Move_DoesNotChangeNameContentOrUpdatedAt()
    {
        var folderResponse = await this.client.PostAsJsonAsync("/api/folders", new { name = "Timestamp folder" });
        var folder = await folderResponse.Content.ReadFromJsonAsync<Folder>();

        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Untouched doc", content = "original" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var moveResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/folder", new { folderId = folder!.Id });

        Assert.Equal(HttpStatusCode.OK, moveResponse.StatusCode);
        var moved = await moveResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("Untouched doc", moved!.Name);
        Assert.Equal("original", moved.Content);

        // Moving is re-organization, not editing: it must not reshuffle the
        // recency-ordered list the way a content update does.
        Assert.Null(moved.UpdatedAt);
    }

    [Fact]
    public async Task SetExportExclusion_SetThenClear_RoundTrips()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Toggled doc", content = "c" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var excludeResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/export-exclusion", new { excludedFromExport = true });

        Assert.Equal(HttpStatusCode.OK, excludeResponse.StatusCode);
        var excluded = await excludeResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.True(excluded!.ExcludedFromExport);

        var fetched = await this.client.GetFromJsonAsync<PlantUmlDocument>($"/api/documents/{created.Id}");
        Assert.True(fetched!.ExcludedFromExport);

        var includeResponse = await this.client.PutAsJsonAsync($"/api/documents/{created.Id}/export-exclusion", new { excludedFromExport = false });

        Assert.Equal(HttpStatusCode.OK, includeResponse.StatusCode);
        var included = await includeResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.False(included!.ExcludedFromExport);
    }

    [Fact]
    public async Task SetExportExclusion_ReturnsNotFound_ForUnknownDocument()
    {
        var response = await this.client.PutAsJsonAsync($"/api/documents/{Guid.NewGuid()}/export-exclusion", new { excludedFromExport = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SetExportExclusion_DoesNotChangeNameContentOrUpdatedAt()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Quiet toggle doc", content = "original" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        var toggleResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}/export-exclusion", new { excludedFromExport = true });

        Assert.Equal(HttpStatusCode.OK, toggleResponse.StatusCode);
        var toggled = await toggleResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("Quiet toggle doc", toggled!.Name);
        Assert.Equal("original", toggled.Content);

        // Toggling export visibility is re-organization, not editing: it must
        // not reshuffle the recency-ordered list the way a content update does.
        Assert.Null(toggled.UpdatedAt);
    }

    [Fact]
    public async Task Upload_CreatesDocumentAtRoot()
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("@startuml\nroot\n@enduml"));
        content.Add(fileContent, "file", "root-upload.puml");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Null(document!.FolderId);
    }

    [Fact]
    public async Task Upload_CreatesNewDocument_WhenNoDocumentIdProvided()
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("@startuml\nAlice -> Bob\n@enduml"));
        fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("text/plain");
        content.Add(fileContent, "file", "uploaded.puml");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.NotNull(document);
        Assert.Equal("uploaded", document!.Name);
        Assert.Contains("Alice -> Bob", document.Content);
        Assert.Null(document.UpdatedAt);
    }

    [Fact]
    public async Task Upload_ReplacesContent_WhenDocumentIdProvided()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Upload target", content = "old" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("@startuml\nnew content\n@enduml"));
        content.Add(fileContent, "file", "replacement.puml");
        content.Add(new StringContent(created!.Id.ToString()), "documentId");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal(created.Id, document!.Id);

        // A replacing upload keeps the document's existing name and stamps UpdatedAt.
        Assert.Equal("Upload target", document.Name);
        Assert.Contains("new content", document.Content);
        Assert.NotNull(document.UpdatedAt);
    }

    [Fact]
    public async Task Upload_ReturnsNotFound_ForUnknownDocumentId()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("content")), "file", "orphan.puml");
        content.Add(new StringContent(Guid.NewGuid().ToString()), "documentId");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Upload_ReturnsBadRequest_ForDisallowedExtension()
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("not a diagram"));
        content.Add(fileContent, "file", "malware.exe");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Contains("Only .puml, .txt, .md or .markdown files", await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Upload_MarkdownFile_CreatesMarkdownDocument()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("# Uploaded notes")), "file", "notes.md");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<PlantUmlDocument>();
        Assert.Equal("markdown", document!.Kind);
        Assert.Equal("notes", document.Name);
    }

    [Fact]
    public async Task Upload_ReturnsBadRequest_WhenReplacingWithMismatchedKind()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Diagram", content = "@startuml\n@enduml" });
        var created = await createResponse.Content.ReadFromJsonAsync<PlantUmlDocument>();

        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("# md into a plantuml doc")), "file", "notes.md");
        content.Add(new StringContent(created!.Id.ToString()), "documentId");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        // The document is untouched by the rejected upload.
        var fetched = await this.client.GetFromJsonAsync<PlantUmlDocument>($"/api/documents/{created.Id}");
        Assert.Equal("@startuml\n@enduml", fetched!.Content);
        Assert.Equal("plantuml", fetched.Kind);
    }

    [Fact]
    public async Task Upload_ReturnsBadRequest_ForEmptyFile()
    {
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(Array.Empty<byte>()), "file", "empty.puml");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Search_MatchesContent_AndReturnsASnippetAroundTheHit()
    {
        // A unique token keeps this test's hit out of every other test's results
        // in the class-shared database.
        var token = "zetacontenttoken" + Guid.NewGuid().ToString("N");
        await this.client.PostAsJsonAsync(
            "/api/documents",
            new { name = "Unrelated name", content = $"@startuml\nAlice -> Bob : {token} message\n@enduml" });

        var response = await this.client.GetAsync($"/api/documents/search?query={token}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var results = await response.Content.ReadFromJsonAsync<List<DocumentSearchResultDto>>();
        Assert.NotNull(results);
        var hit = Assert.Single(results!);
        Assert.Equal("Unrelated name", hit.Name);
        Assert.NotNull(hit.Snippet);
        Assert.Contains(token, hit.Snippet!);
    }

    [Fact]
    public async Task Search_MatchesName_WithoutASnippet()
    {
        var token = "namehittoken" + Guid.NewGuid().ToString("N");
        await this.client.PostAsJsonAsync(
            "/api/documents",
            new { name = $"Design {token}", content = "nothing to see here" });

        var results = await this.client.GetFromJsonAsync<List<DocumentSearchResultDto>>($"/api/documents/search?query={token}");

        var hit = Assert.Single(results!);
        Assert.Equal($"Design {token}", hit.Name);

        // The query hit only the name, so there is no content excerpt to show.
        Assert.Null(hit.Snippet);
    }

    [Fact]
    public async Task Search_IsCaseInsensitive()
    {
        var token = "MixedCaseToken" + Guid.NewGuid().ToString("N");
        await this.client.PostAsJsonAsync(
            "/api/documents",
            new { name = "Case doc", content = $"the {token} lives in the body" });

        var results = await this.client.GetFromJsonAsync<List<DocumentSearchResultDto>>(
            $"/api/documents/search?query={token.ToLowerInvariant()}");

        Assert.NotNull(results);
        Assert.Contains(results!, r => r.Name == "Case doc");
    }

    [Fact]
    public async Task Search_ReturnsEmpty_ForBlankQuery()
    {
        var results = await this.client.GetFromJsonAsync<List<DocumentSearchResultDto>>("/api/documents/search?query=%20%20");

        Assert.NotNull(results);
        Assert.Empty(results!);
    }

    [Fact]
    public async Task Search_ExcludesDocumentsThatMatchNeitherNameNorContent()
    {
        var token = "absentqueryneverstored" + Guid.NewGuid().ToString("N");
        await this.client.PostAsJsonAsync(
            "/api/documents",
            new { name = "Just a document", content = "with ordinary content" });

        var results = await this.client.GetFromJsonAsync<List<DocumentSearchResultDto>>($"/api/documents/search?query={token}");

        Assert.NotNull(results);
        Assert.Empty(results!);
    }
}
