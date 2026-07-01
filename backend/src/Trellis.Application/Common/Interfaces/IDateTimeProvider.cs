namespace Trellis.Application.Common.Interfaces;

/// <summary>
/// Port for obtaining the current date and time, so handlers stay testable.
/// </summary>
public interface IDateTimeProvider
{
    /// <summary>
    /// Gets the current UTC date and time.
    /// </summary>
    DateTimeOffset UtcNow { get; }
}
