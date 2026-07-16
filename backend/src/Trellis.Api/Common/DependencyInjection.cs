using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Trellis.Api.ErrorHandling;
using Trellis.Api.Explain;
using Trellis.Api.Markdown;
using Trellis.Api.Persistence;
using Trellis.Api.Persistence.Initialisation;
using Trellis.Api.PlantUml;

namespace Trellis.Api.Common;

/// <summary>
/// Registers every service the application needs with the dependency injection container.
/// </summary>
public static class DependencyInjection
{
    /// <summary>
    /// The name of the CORS policy that allows the frontend dev server to call this API.
    /// </summary>
    public const string CorsPolicyName = "TrellisCors";

    /// <summary>
    /// Wires controllers, Swagger, the exception handler, SignalR (with a raised
    /// maximum receive message size), CORS, the EF Core SQLite database context,
    /// and the PlantUML and markdown renderers.
    /// </summary>
    /// <param name="services">The service collection to add registrations to.</param>
    /// <param name="configuration">The application configuration.</param>
    /// <returns>The same service collection, for chaining.</returns>
    public static IServiceCollection AddTrellisServices(this IServiceCollection services, IConfiguration configuration)
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

        var connectionString = ResolveToAbsoluteConnectionString(
            configuration.GetConnectionString("DefaultConnection") ?? "Data Source=App_Data/trellis.db");

        services.AddDbContext<ApplicationDbContext>(options => options.UseSqlite(connectionString));
        services.AddScoped<ApplicationDbContextInitialiser>();

        services.Configure<PlantUmlOptions>(configuration.GetSection(PlantUmlOptions.SectionName));
        services.AddSingleton<IPlantUmlRenderer, PlantUmlRenderer>();
        services.AddSingleton<IMarkdownRenderer, MarkdigMarkdownRenderer>();

        services.AddSingleton<IFileAggregator, FileAggregator>();
        services.AddSingleton<IExplainPromptBuilder, ExplainPromptBuilder>();
        services.AddHttpClient<IGitRepositoryFetcher, GitRepositoryFetcher>(client =>
        {
            // GitHub rejects requests without a User-Agent outright.
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Trellis-Explain/1.0");
            client.Timeout = TimeSpan.FromSeconds(60);
        });

        return services;
    }

    /// <summary>
    /// Rewrites a SQLite connection string so its Data Source path is always absolute,
    /// anchored at <see cref="AppContext.BaseDirectory"/>, and ensures the containing
    /// directory exists. This avoids a common pitfall where a relative SQLite path is
    /// resolved by the driver against the process's current working directory (which
    /// varies between `dotnet run`, a published exe, and a test host) rather than the
    /// application's own base directory.
    /// </summary>
    /// <param name="connectionString">The raw connection string from configuration.</param>
    /// <returns>The connection string with an absolute Data Source path.</returns>
    private static string ResolveToAbsoluteConnectionString(string connectionString)
    {
        var builder = new SqliteConnectionStringBuilder(connectionString);

        // In-memory databases have no path to anchor.
        if (builder.Mode == SqliteOpenMode.Memory || string.IsNullOrWhiteSpace(builder.DataSource) || builder.DataSource == ":memory:")
        {
            return connectionString;
        }

        if (!Path.IsPathRooted(builder.DataSource))
        {
            builder.DataSource = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, builder.DataSource));
        }

        var directory = Path.GetDirectoryName(builder.DataSource);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        return builder.ConnectionString;
    }
}
