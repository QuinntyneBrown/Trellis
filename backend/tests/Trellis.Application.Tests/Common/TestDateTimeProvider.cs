using Trellis.Application.Common.Interfaces;

namespace Trellis.Application.Tests.Common;

/// <summary>
/// A deterministic <see cref="IDateTimeProvider"/> test double.
/// </summary>
public class TestDateTimeProvider : IDateTimeProvider
{
    /// <summary>
    /// Initializes a new instance of the <see cref="TestDateTimeProvider"/> class.
    /// </summary>
    /// <param name="utcNow">The fixed value to return from <see cref="UtcNow"/>.</param>
    public TestDateTimeProvider(DateTimeOffset utcNow)
    {
        this.UtcNow = utcNow;
    }

    /// <inheritdoc />
    public DateTimeOffset UtcNow { get; }
}
