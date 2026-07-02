using System.Net;
using System.Net.Http.Json;
using Trellis.Api.Models;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

public class TemplatesControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient client;

    public TemplatesControllerTests(CustomWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
    }

    [Fact]
    public async Task GetAll_ReturnsTheVendoredTemplateCatalog()
    {
        var response = await this.client.GetAsync("/api/templates");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var templates = await response.Content.ReadFromJsonAsync<List<TemplateDto>>();
        Assert.NotNull(templates);
        Assert.Contains(templates!, template => template.Key == "blank");
        Assert.Contains(templates!, template => template.Key == "c4-context");
        Assert.All(templates!, template => Assert.False(string.IsNullOrWhiteSpace(template.Content)));
    }
}
