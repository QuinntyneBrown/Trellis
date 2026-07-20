using Microsoft.Extensions.Logging.Abstractions;
using Trellis.Cli.Commands;
using Trellis.Cli.Tests.Fakes;

namespace Trellis.Cli.Tests.Commands;

/// <summary>
/// Tests the render command syntax.
/// </summary>
public sealed class RenderCommandTests
{
    [Fact]
    public void Create_RequiresThePathArgument()
    {
        var handler = new RenderCommandHandler(
            new FakePlantUmlRenderer(),
            new RecordingCommandConsole(),
            NullLogger<RenderCommandHandler>.Instance);
        var command = new RenderCommand(handler).Create();

        var parseResult = command.Parse(Array.Empty<string>());

        Assert.NotEmpty(parseResult.Errors);
    }
}
