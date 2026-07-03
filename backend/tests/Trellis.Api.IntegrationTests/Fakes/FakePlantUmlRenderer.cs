using Trellis.Api.Models;
using Trellis.Api.PlantUml;

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

    /// <inheritdoc />
    public Task<RenderResult> RenderAsync(string source, CancellationToken cancellationToken)
    {
        return Task.FromResult(RenderResult.Success(CannedSvg));
    }
}
