using Microsoft.EntityFrameworkCore;

namespace Trellis.Api.Persistence.Initialisation;

/// <summary>
/// Applies pending EF Core migrations and performs one-time SQLite tuning at startup.
/// </summary>
public class ApplicationDbContextInitialiser
{
    private readonly ApplicationDbContext context;
    private readonly ILogger<ApplicationDbContextInitialiser> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="ApplicationDbContextInitialiser"/> class.
    /// </summary>
    /// <param name="context">The database context to initialise.</param>
    /// <param name="logger">The logger.</param>
    public ApplicationDbContextInitialiser(ApplicationDbContext context, ILogger<ApplicationDbContextInitialiser> logger)
    {
        this.context = context;
        this.logger = logger;
    }

    /// <summary>
    /// Applies any pending migrations and enables SQLite's write-ahead log journal mode.
    /// </summary>
    public async Task InitialiseAsync()
    {
        try
        {
            await this.context.Database.MigrateAsync();
            await this.context.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
        }
        catch (Exception exception)
        {
            this.logger.LogError(exception, "An error occurred while initialising the database.");
            throw;
        }
    }

    /// <summary>
    /// Deletes the entire database, if it exists. Intended for use only in the E2E
    /// test environment, so that every run starts from a guaranteed-fresh database.
    /// </summary>
    public async Task ResetAsync()
    {
        await this.context.Database.EnsureDeletedAsync();
    }
}
