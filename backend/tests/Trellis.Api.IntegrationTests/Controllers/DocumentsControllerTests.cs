using System.Net;
using System.Net.Http.Json;
using Trellis.Application.Common.Models;
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
        var created = await createResponse.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.NotNull(created);
        Assert.Equal("Integration Doc", created!.Name);

        var getResponse = await this.client.GetAsync($"/api/documents/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, getResponse.StatusCode);

        var fetched = await getResponse.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.NotNull(fetched);
        Assert.Equal(created.Id, fetched!.Id);
        Assert.Equal("@startuml\n@enduml", fetched.Content);
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
    public async Task Update_RouteIdWinsOverBody_AndReturnsUpdatedDocument()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Before", content = "before" });
        var created = await createResponse.Content.ReadFromJsonAsync<DocumentDto>();

        var updateResponse = await this.client.PutAsJsonAsync($"/api/documents/{created!.Id}", new { name = "After", content = "after" });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.Equal(created.Id, updated!.Id);
        Assert.Equal("After", updated.Name);
        Assert.Equal("after", updated.Content);
        Assert.NotNull(updated.UpdatedAt);
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
        var created = await createResponse.Content.ReadFromJsonAsync<DocumentDto>();

        var deleteResponse = await this.client.DeleteAsync($"/api/documents/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await this.client.GetAsync($"/api/documents/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsMissing()
    {
        var response = await this.client.PostAsJsonAsync("/api/documents", new { name = string.Empty, content = "content" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
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
        var document = await response.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.NotNull(document);
        Assert.Equal("uploaded", document!.Name);
        Assert.Contains("Alice -> Bob", document.Content);
    }

    [Fact]
    public async Task Upload_ReplacesContent_WhenDocumentIdProvided()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/documents", new { name = "Upload target", content = "old" });
        var created = await createResponse.Content.ReadFromJsonAsync<DocumentDto>();

        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("@startuml\nnew content\n@enduml"));
        content.Add(fileContent, "file", "replacement.puml");
        content.Add(new StringContent(created!.Id.ToString()), "documentId");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await response.Content.ReadFromJsonAsync<DocumentDto>();
        Assert.Equal(created.Id, document!.Id);
        Assert.Equal("Upload target", document.Name);
        Assert.Contains("new content", document.Content);
    }

    [Fact]
    public async Task Upload_ReturnsBadRequest_ForDisallowedExtension()
    {
        using var content = new MultipartFormDataContent();
        var fileContent = new ByteArrayContent(System.Text.Encoding.UTF8.GetBytes("not a diagram"));
        content.Add(fileContent, "file", "malware.exe");

        var response = await this.client.PostAsync("/api/documents/upload", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
