using System.Net;
using System.Net.Http.Json;
using Trellis.Application.Common.Models;
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

    [Fact]
    public async Task GetByKey_ReturnsTheMatchingTemplate()
    {
        var response = await this.client.GetAsync("/api/templates/c4-context");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var template = await response.Content.ReadFromJsonAsync<TemplateDto>();
        Assert.NotNull(template);
        Assert.Equal("c4-context", template!.Key);
        Assert.Equal("C4", template.Category);
    }

    [Fact]
    public async Task GetByKey_ReturnsNotFound_ForUnknownKey()
    {
        var response = await this.client.GetAsync("/api/templates/does-not-exist");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
