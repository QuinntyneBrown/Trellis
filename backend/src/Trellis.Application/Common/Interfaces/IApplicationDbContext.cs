using Microsoft.EntityFrameworkCore;
using Trellis.Domain.Entities;

namespace Trellis.Application.Common.Interfaces;

/// <summary>
/// Port representing the persistence context the Application layer depends on.
/// Implemented by the Infrastructure layer.
/// </summary>
public interface IApplicationDbContext
{
    /// <summary>
    /// Gets the set of persisted PlantUML documents.
    /// </summary>
    DbSet<PlantUmlDocument> Documents { get; }

    /// <summary>
    /// Persists all tracked changes to the underlying store.
    /// </summary>
    /// <param name="cancellationToken">A token used to observe cancellation requests.</param>
    /// <returns>The number of state entries written to the store.</returns>
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
