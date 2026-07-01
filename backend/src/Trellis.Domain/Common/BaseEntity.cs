namespace Trellis.Domain.Common;

/// <summary>
/// Base type for all domain entities, providing a strongly typed identity.
/// </summary>
public abstract class BaseEntity
{
    /// <summary>
    /// Gets or sets the unique identifier of the entity.
    /// </summary>
    public Guid Id { get; set; }
}
