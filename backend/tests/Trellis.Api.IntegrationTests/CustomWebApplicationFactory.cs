using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Trellis.Api.IntegrationTests.Fakes;
using Trellis.Api.Persistence;
using Trellis.Api.PlantUml;

namespace Trellis.Api.IntegrationTests;

/// <summary>
/// A <see cref="WebApplicationFactory{TEntryPoint}"/> that swaps the real EF Core
/// SQLite connection for a private, open, in-memory one, and swaps
/// <see cref="IPlantUmlRenderer"/> for <see cref="FakePlantUmlRenderer"/>, so most
/// integration tests never need a real JVM or touch the file system.
/// </summary>
public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection connection = new("DataSource=:memory:");

    /// <inheritdoc />
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ApplicationDbContext>>();

            this.connection.Open();
            services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(this.connection));

            services.RemoveAll<IPlantUmlRenderer>();
            services.AddSingleton<IPlantUmlRenderer, FakePlantUmlRenderer>();
        });
    }

    /// <inheritdoc />
    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            this.connection.Dispose();
        }

        base.Dispose(disposing);
    }
}
