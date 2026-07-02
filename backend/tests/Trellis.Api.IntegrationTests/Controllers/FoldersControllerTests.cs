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
}
