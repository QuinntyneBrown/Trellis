using Trellis.Core.PlantUml;

namespace Trellis.Api.IntegrationTests.Fakes;

/// <summary>
/// PlantUML renderer test double that throws a configured exception.
/// </summary>
public sealed class ThrowingPlantUmlRenderer : IPlantUmlRenderer
{
    private readonly Exception exception;

    /// <summary>
    /// Initializes a new instance of the <see cref="ThrowingPlantUmlRenderer"/> class.
    /// </summary>
    /// <param name="exception">The exception to throw.</param>
    public ThrowingPlantUmlRenderer(Exception exception)
    {
        this.exception = exception;
    }

    /// <inheritdoc />
    public Task<PlantUmlRenderResult> RenderAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken)
    {
        return Task.FromException<PlantUmlRenderResult>(this.exception);
    }
}
