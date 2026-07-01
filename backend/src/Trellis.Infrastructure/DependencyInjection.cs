using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Trellis.Application.Common.Interfaces;
using Trellis.Infrastructure.DateTime;
using Trellis.Infrastructure.Persistence;
using Trellis.Infrastructure.Persistence.Initialisation;
using Trellis.Infrastructure.PlantUml;
using Trellis.Infrastructure.Templates;

namespace Trellis.Infrastructure;

/// <summary>
/// Registers Infrastructure layer services with the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Wires the EF Core SQLite database context, the PlantUML renderer, the template
    /// catalog and supporting services for the Infrastructure layer.
    /// </summary>
    /// <param name="services">The service collection to add registrations to.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddInfrastructureServices(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = ResolveToAbsoluteConnectionString(
            configuration.GetConnectionString("DefaultConnection") ?? "Data Source=App_Data/trellis.db");

        services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(connectionString));

        services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());
        services.AddScoped<ApplicationDbContextInitialiser>();

        services.Configure<PlantUmlOptions>(configuration.GetSection(PlantUmlOptions.SectionName));

        services.AddSingleton<IPlantUmlRenderer, PlantUmlRenderer>();
        services.AddSingleton<ITemplateCatalog, TemplateCatalog>();
        services.AddSingleton<IDateTimeProvider, SystemDateTimeProvider>();

        return services;
    }

    /// <summary>
    /// Rewrites a "Data Source=..." SQLite connection string so its path is always
    /// absolute, anchored at <see cref="AppContext.BaseDirectory"/>, and ensures the
    /// containing directory exists. This avoids a common pitfall where a relative
    /// SQLite path is resolved by the driver against the process's current working
    /// directory (which varies between `dotnet run`, a published exe, and a test
    /// host) rather than the application's own base directory.
    /// </summary>
    /// <param name="connectionString">The raw connection string from configuration.</param>
    /// <returns>The connection string with an absolute Data Source path.</returns>
    private static string ResolveToAbsoluteConnectionString(string connectionString)
    {
        const string dataSourceKey = "Data Source";

        var segments = connectionString.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        for (var i = 0; i < segments.Length; i++)
        {
            var keyValue = segments[i].Split('=', 2, StringSplitOptions.TrimEntries);
            if (keyValue.Length != 2 || !string.Equals(keyValue[0], dataSourceKey, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            var relativeOrAbsolutePath = keyValue[1];
            if (string.IsNullOrWhiteSpace(relativeOrAbsolutePath) || relativeOrAbsolutePath == ":memory:")
            {
                continue;
            }

            var fullPath = Path.IsPathRooted(relativeOrAbsolutePath)
                ? relativeOrAbsolutePath
                : Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, relativeOrAbsolutePath));

            var directory = Path.GetDirectoryName(fullPath);
            if (!string.IsNullOrEmpty(directory))
            {
                Directory.CreateDirectory(directory);
            }

            segments[i] = $"{dataSourceKey}={fullPath}";
        }

        return string.Join(';', segments);
    }
}
