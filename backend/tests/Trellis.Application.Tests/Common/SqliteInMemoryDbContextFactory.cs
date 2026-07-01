using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Trellis.Infrastructure.Persistence;

namespace Trellis.Application.Tests.Common;

/// <summary>
/// Creates <see cref="ApplicationDbContext"/> instances backed by a real, shared,
/// open SQLite in-memory connection, so tests exercise genuine SQL semantics rather
/// than EF Core's InMemory provider. Implements <see cref="IDisposable"/> so the
/// underlying connection (and therefore the in-memory database) is torn down when
/// the owning test class is disposed.
/// </summary>
public sealed class SqliteInMemoryDbContextFactory : IDisposable
{
    private readonly SqliteConnection connection;

    /// <summary>
    /// Initializes a new instance of the <see cref="SqliteInMemoryDbContextFactory"/> class,
    /// opening the shared connection and creating the schema.
    /// </summary>
    public SqliteInMemoryDbContextFactory()
    {
        this.connection = new SqliteConnection("DataSource=:memory:");
        this.connection.Open();

        using var context = this.CreateContext();
        context.Database.EnsureCreated();
    }

    /// <summary>
    /// Creates a new <see cref="ApplicationDbContext"/> sharing the underlying in-memory
    /// connection, mimicking the short-lived scoped lifetime a real request would use.
    /// </summary>
    /// <returns>A new database context instance.</returns>
    public ApplicationDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(this.connection)
            .Options;

        return new ApplicationDbContext(options);
    }

    /// <inheritdoc />
    public void Dispose()
    {
        this.connection.Dispose();
    }
}
