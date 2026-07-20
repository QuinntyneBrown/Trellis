using Trellis.Core.PlantUml;

namespace Trellis.Cli.Tests.Fakes;

/// <summary>
/// Configurable PlantUML renderer test double.
/// </summary>
public sealed class FakePlantUmlRenderer : IPlantUmlRenderer
{
    /// <summary>
    /// Gets or sets the result returned by the renderer.
    /// </summary>
    public PlantUmlRenderResult Result { get; set; } = PlantUmlRenderResult.Success([0x89, 0x50, 0x4E, 0x47]);

    /// <summary>
    /// Gets or sets an exception to throw instead of returning a result.
    /// </summary>
    public Exception? Exception { get; set; }

    /// <summary>
    /// Gets the most recently requested format.
    /// </summary>
    public PlantUmlOutputFormat? RequestedFormat { get; private set; }

    /// <inheritdoc />
    public Task<PlantUmlRenderResult> RenderAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken)
    {
        this.RequestedFormat = outputFormat;

        if (this.Exception is not null)
        {
            return Task.FromException<PlantUmlRenderResult>(this.Exception);
        }

        return Task.FromResult(this.Result);
    }
}
