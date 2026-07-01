using Microsoft.EntityFrameworkCore;
using Trellis.Application.Common.Interfaces;
using Trellis.Domain.Entities;

namespace Trellis.Infrastructure.Persistence;

/// <summary>
/// EF Core implementation of <see cref="IApplicationDbContext"/> backed by SQLite.
/// </summary>
public class ApplicationDbContext : DbContext, IApplicationDbContext
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ApplicationDbContext"/> class.
    /// </summary>
    /// <param name="options">The EF Core options for this context.</param>
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    /// <inheritdoc />
    public DbSet<PlantUmlDocument> Documents => this.Set<PlantUmlDocument>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }
}
