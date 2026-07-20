using System.Text;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Trellis.Core.PlantUml;

namespace Trellis.Core.Tests.PlantUml;

/// <summary>
/// Exercises the vendored PlantUML renderer through the locally installed JVM.
/// </summary>
public sealed class PlantUmlRendererTests
{
    private const string ValidSource = "@startuml\nAlice -> Bob: Hello\n@enduml";

    [Fact]
    public async Task RenderAsync_ReturnsPngBytes_WhenPngIsRequested()
    {
        using var renderer = CreateRenderer();

        var result = await renderer.RenderAsync(ValidSource, PlantUmlOutputFormat.Png, CancellationToken.None);

        Assert.True(result.IsSuccess, result.ErrorMessage);
        Assert.NotNull(result.Content);
        Assert.True(result.Content.AsSpan().StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }));
    }

    [Fact]
    public async Task RenderAsync_ReturnsSvgBytes_WhenSvgIsRequested()
    {
        using var renderer = CreateRenderer();

        var result = await renderer.RenderAsync(ValidSource, PlantUmlOutputFormat.Svg, CancellationToken.None);

        Assert.True(result.IsSuccess, result.ErrorMessage);
        Assert.NotNull(result.Content);
        Assert.StartsWith("<svg", Encoding.UTF8.GetString(result.Content), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RenderAsync_ReturnsFailure_WhenSourceIsInvalid()
    {
        using var renderer = CreateRenderer();

        const string invalidSource = "@startuml broken\nactor User\nif (condition?) then (yes)\nUser -> System : go";

        var result = await renderer.RenderAsync(invalidSource, PlantUmlOutputFormat.Png, CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Null(result.Content);
        Assert.False(string.IsNullOrWhiteSpace(result.ErrorMessage));
    }

    [Fact]
    public async Task RenderAsync_Throws_WhenAlreadyCancelled()
    {
        using var renderer = CreateRenderer();
        using var cancellation = new CancellationTokenSource();
        cancellation.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            renderer.RenderAsync(ValidSource, PlantUmlOutputFormat.Png, cancellation.Token));
    }

    private static PlantUmlRenderer CreateRenderer()
    {
        return new PlantUmlRenderer(
            Options.Create(new PlantUmlOptions()),
            NullLogger<PlantUmlRenderer>.Instance);
    }
}
