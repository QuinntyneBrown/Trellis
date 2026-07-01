using MediatR;
using Microsoft.Extensions.Logging.Abstractions;
using Trellis.Application.Common.Behaviours;
using Xunit;

namespace Trellis.Application.Tests.Behaviours;

public class UnhandledExceptionBehaviourTests
{
    [Fact]
    public async Task Handle_ReturnsNextResult_WhenNoExceptionIsThrown()
    {
        var behaviour = new UnhandledExceptionBehaviour<TestRequest, string>(NullLogger<UnhandledExceptionBehaviour<TestRequest, string>>.Instance);

        var result = await behaviour.Handle(new TestRequest(), () => Task.FromResult("ok"), CancellationToken.None);

        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_RethrowsException_WhenNextThrows()
    {
        var behaviour = new UnhandledExceptionBehaviour<TestRequest, string>(NullLogger<UnhandledExceptionBehaviour<TestRequest, string>>.Instance);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            behaviour.Handle(new TestRequest(), () => throw new InvalidOperationException("boom"), CancellationToken.None));
    }

    public record TestRequest : IRequest<string>;
}
