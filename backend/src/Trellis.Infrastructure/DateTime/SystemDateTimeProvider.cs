using Trellis.Application.Common.Interfaces;

namespace Trellis.Infrastructure.DateTime;

/// <summary>
/// Provides the current UTC date and time from the system clock.
/// </summary>
public class SystemDateTimeProvider : IDateTimeProvider
{
    /// <inheritdoc />
    public DateTimeOffset UtcNow => DateTimeOffset.UtcNow;
}
