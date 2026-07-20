using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Trellis.Core.PlantUml;

namespace Trellis.Core.Common;

/// <summary>
/// Registers the reusable Trellis services.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// Adds the shared PlantUML rendering services.
    /// </summary>
    /// <param name="services">The service collection to populate.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The supplied service collection.</returns>
    public static IServiceCollection AddTrellisCore(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<PlantUmlOptions>(configuration.GetSection(PlantUmlOptions.SectionName));
        services.AddSingleton<IPlantUmlRenderer, PlantUmlRenderer>();

        return services;
    }
}
