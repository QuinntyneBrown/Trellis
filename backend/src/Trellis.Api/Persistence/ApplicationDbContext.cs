using Microsoft.EntityFrameworkCore;
using Trellis.Api.Domain;

namespace Trellis.Api.Persistence;

/// <summary>
/// The EF Core database context, backed by SQLite.
/// </summary>
public class ApplicationDbContext : DbContext
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ApplicationDbContext"/> class.
    /// </summary>
    /// <param name="options">The EF Core options for this context.</param>
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    /// <summary>
    /// Gets the set of persisted PlantUML documents.
    /// </summary>
    public DbSet<PlantUmlDocument> Documents => this.Set<PlantUmlDocument>();

    /// <summary>
    /// Gets the set of virtual folders used to organize documents.
    /// </summary>
    public DbSet<Folder> Folders => this.Set<Folder>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
