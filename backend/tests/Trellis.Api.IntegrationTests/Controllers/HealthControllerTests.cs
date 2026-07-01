using System.Net;
using Xunit;

namespace Trellis.Api.IntegrationTests.Controllers;

public class HealthControllerTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient client;

    public HealthControllerTests(CustomWebApplicationFactory factory)
    {
        this.client = factory.CreateClient();
    }

    [Fact]
    public async Task Health_ReturnsOk()
    {
        var response = await this.client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }
}
