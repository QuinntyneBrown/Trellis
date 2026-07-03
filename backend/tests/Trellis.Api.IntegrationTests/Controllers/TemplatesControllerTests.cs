using System.Net;
using System.Net.Http.Json;
using Trellis.Api.Domain;
using Trellis.Api.Models;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

/// <summary>
/// Exercises the templates CRUD endpoints over real HTTP. The migration seeds
/// six built-in starters into every test database; tests here only READ the
/// seeded rows (the shared class fixture is one database) - the
/// delete-a-seeded-template case lives in its own isolated factory below.
/// </summary>
public class TemplatesControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient client;

    public TemplatesControllerTests(CustomWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
    }

    [Fact]
    public async Task GetList_ReturnsSeededTemplates_NameOrdered_WithoutContent()
    {
        var response = await this.client.GetAsync("/api/templates");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("\"content\"", json, StringComparison.OrdinalIgnoreCase);

        var list = await this.client.GetFromJsonAsync<List<TemplateListItemDto>>("/api/templates");
        Assert.NotNull(list);
        Assert.Contains(list!, t => t.Name == "Blank");
        Assert.Contains(list!, t => t.Name == "C4 - Context");

        var names = list!.Select(t => t.Name).ToList();
        var sorted = names.OrderBy(n => n, StringComparer.OrdinalIgnoreCase).ToList();
        Assert.Equal(sorted, names);
    }

    [Fact]
    public async Task GetById_ReturnsFullContent_ForASeededTemplate()
    {
        var list = await this.client.GetFromJsonAsync<List<TemplateListItemDto>>("/api/templates");
        var context = list!.Single(t => t.Name == "C4 - Context");

        var template = await this.client.GetFromJsonAsync<Template>($"/api/templates/{context.Id}");

        Assert.NotNull(template);
        Assert.Equal("C4 - Context", template!.Name);
        Assert.Equal("plantuml", template.Kind);
        Assert.Contains("!include C4_Context.puml", template.Content);
    }

    [Fact]
    public async Task GetById_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.GetAsync($"/api/templates/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Create_ThenGetById_RoundTrips()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/templates", new { name = "My Starter", content = "@startuml\nA -> B\n@enduml", kind = "plantuml" });

        Assert.Equal(HttpStatusCode.Created, createResponse.StatusCode);
        var created = await createResponse.Content.ReadFromJsonAsync<Template>();
        Assert.NotNull(created);
        Assert.Equal("My Starter", created!.Name);
        Assert.Null(created.UpdatedAt);

        var fetched = await this.client.GetFromJsonAsync<Template>($"/api/templates/{created.Id}");
        Assert.Equal("@startuml\nA -> B\n@enduml", fetched!.Content);
    }

    [Fact]
    public async Task Create_WithoutKind_DefaultsToPlantUml()
    {
        var response = await this.client.PostAsJsonAsync("/api/templates", new { name = "Kindless", content = "c" });

        var created = await response.Content.ReadFromJsonAsync<Template>();
        Assert.Equal("plantuml", created!.Kind);
    }

    [Fact]
    public async Task Create_ReturnsBadRequest_ForUnknownKind()
    {
        var response = await this.client.PostAsJsonAsync("/api/templates", new { name = "X", content = "c", kind = "asciidoc" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_ReturnsValidationProblem_WhenNameIsTooLong()
    {
        var response = await this.client.PostAsJsonAsync("/api/templates", new { name = new string('x', 201), content = "c" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_ReplacesNameContentAndKind_AndStampsUpdatedAt()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/templates", new { name = "Before", content = "before", kind = "plantuml" });
        var created = await createResponse.Content.ReadFromJsonAsync<Template>();

        var updateResponse = await this.client.PutAsJsonAsync($"/api/templates/{created!.Id}", new { name = "After", content = "# after", kind = "markdown" });

        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updated = await updateResponse.Content.ReadFromJsonAsync<Template>();
        Assert.Equal("After", updated!.Name);
        Assert.Equal("# after", updated.Content);
        Assert.Equal("markdown", updated.Kind);
        Assert.NotNull(updated.UpdatedAt);

        var fetched = await this.client.GetFromJsonAsync<Template>($"/api/templates/{created.Id}");
        Assert.Equal("markdown", fetched!.Kind);
    }

    [Fact]
    public async Task Update_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.PutAsJsonAsync($"/api/templates/{Guid.NewGuid()}", new { name = "X", content = "c", kind = "plantuml" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Update_ReturnsBadRequest_ForUnknownKind()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/templates", new { name = "Kind guard", content = "c" });
        var created = await createResponse.Content.ReadFromJsonAsync<Template>();

        var response = await this.client.PutAsJsonAsync($"/api/templates/{created!.Id}", new { name = "Kind guard", content = "c", kind = "asciidoc" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Delete_RemovesTemplate_ThenGetReturns404()
    {
        var createResponse = await this.client.PostAsJsonAsync("/api/templates", new { name = "Doomed", content = "c" });
        var created = await createResponse.Content.ReadFromJsonAsync<Template>();

        var deleteResponse = await this.client.DeleteAsync($"/api/templates/{created!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await this.client.GetAsync($"/api/templates/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
    }

    [Fact]
    public async Task Delete_ReturnsNotFound_ForUnknownId()
    {
        var response = await this.client.DeleteAsync($"/api/templates/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
