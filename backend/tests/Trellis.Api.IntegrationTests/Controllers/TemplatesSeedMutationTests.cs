using System.Net;
using System.Net.Http.Json;
using Trellis.Api.Models;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

/// <summary>
/// The one test that mutates SEEDED template rows gets its own factory (own
/// database): xUnit gives no ordering guarantees, and deleting a seeded
/// template in the shared class fixture would break
/// <see cref="TemplatesControllerTests"/>' list assertions.
/// </summary>
public class TemplatesSeedMutationTests
{
    [Fact]
    public async Task SeededTemplate_CanBeDeleted_LikeAnyOtherRow()
    {
        using var factory = new CustomWebApplicationFactory();
        var client = factory.CreateClient();

        var list = await client.GetFromJsonAsync<List<TemplateListItemDto>>("/api/templates");
        var classDiagram = list!.Single(t => t.Name == "Class Diagram");

        var deleteResponse = await client.DeleteAsync($"/api/templates/{classDiagram.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var after = await client.GetFromJsonAsync<List<TemplateListItemDto>>("/api/templates");
        Assert.DoesNotContain(after!, t => t.Name == "Class Diagram");
    }
}
