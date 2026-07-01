using Trellis.Api.ErrorHandling;

namespace Trellis.Api.Common;

/// <summary>
/// Registers Api layer (presentation) services with the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// The name of the CORS policy that allows the frontend dev server to call this API.
    /// </summary>
    public const string CorsPolicyName = "TrellisCors";

    /// <summary>
    /// Wires controllers, Swagger, the custom exception handler, SignalR (with a raised
    /// maximum receive message size) and the CORS policy required by the frontend.
    /// </summary>
    /// <param name="services">The service collection to add registrations to.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddApiServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddControllers();
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        services.AddExceptionHandler<CustomExceptionHandler>();
        services.AddProblemDetails();

        services.AddSignalR(options =>
        {
            // The 32 KB SignalR default is too small for realistic PlantUML source
            // with several include directives.
            options.MaximumReceiveMessageSize = 256 * 1024;
        });

        var allowedOrigins = configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
            ?? new[] { "http://localhost:4200" };

        services.AddCors(options =>
        {
            options.AddPolicy(CorsPolicyName, policy =>
            {
                policy
                    .WithOrigins(allowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
            });
        });

        services.AddHealthChecks();

        return services;
    }
}
