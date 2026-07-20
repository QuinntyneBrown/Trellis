using System.Text;
using Trellis.Core.PlantUml;

namespace Trellis.Api.IntegrationTests.Fakes;

/// <summary>
/// A test double for <see cref="IPlantUmlRenderer"/> that always returns a canned
/// successful SVG string, so most integration tests never need a real JVM.
/// </summary>
public class FakePlantUmlRenderer : IPlantUmlRenderer
{
    /// <summary>
    /// The canned SVG markup returned by every call to <see cref="RenderAsync"/>.
    /// </summary>
    public const string CannedSvg = "<svg xmlns=\"http://www.w3.org/2000/svg\"><text>fake</text></svg>";

    /// <summary>
    /// Gets the most recently requested output format.
    /// </summary>
    public PlantUmlOutputFormat? RequestedFormat { get; private set; }

    /// <inheritdoc />
    public Task<PlantUmlRenderResult> RenderAsync(
        string source,
        PlantUmlOutputFormat outputFormat,
        CancellationToken cancellationToken)
    {
        this.RequestedFormat = outputFormat;
        return Task.FromResult(PlantUmlRenderResult.Success(Encoding.UTF8.GetBytes(CannedSvg)));
    }
}
