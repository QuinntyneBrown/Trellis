using MediatR;
using Microsoft.Extensions.Logging;

namespace Trellis.Application.Common.Behaviours;

/// <summary>
/// A MediatR pipeline behaviour that logs any unhandled exception raised while
/// processing a request, then rethrows it unchanged.
/// </summary>
/// <typeparam name="TRequest">The request type.</typeparam>
/// <typeparam name="TResponse">The response type.</typeparam>
public class UnhandledExceptionBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly ILogger<UnhandledExceptionBehaviour<TRequest, TResponse>> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="UnhandledExceptionBehaviour{TRequest, TResponse}"/> class.
    /// </summary>
    /// <param name="logger">The logger used to record unhandled exceptions.</param>
    public UnhandledExceptionBehaviour(ILogger<UnhandledExceptionBehaviour<TRequest, TResponse>> logger)
    {
        this.logger = logger;
    }

    /// <inheritdoc />
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        try
        {
            return await next();
        }
        catch (Exception exception)
        {
            var requestName = typeof(TRequest).Name;
            this.logger.LogError(exception, "Trellis Application request {RequestName} was unhandled: {Message}", requestName, exception.Message);
            throw;
        }
    }
}
