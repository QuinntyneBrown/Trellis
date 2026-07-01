using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Trellis.Application.Common.Exceptions;
using ValidationException = Trellis.Application.Common.Exceptions.ValidationException;

namespace Trellis.Api.ErrorHandling;

/// <summary>
/// Central exception-to-response translator. Maps <see cref="ValidationException"/>
/// to a 400 validation problem, <see cref="NotFoundException"/> to a 404 problem, and
/// anything else to a generic 500 problem that never leaks internal exception details.
/// </summary>
public class CustomExceptionHandler : IExceptionHandler
{
    private readonly ILogger<CustomExceptionHandler> logger;

    /// <summary>
    /// Initializes a new instance of the <see cref="CustomExceptionHandler"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    public CustomExceptionHandler(ILogger<CustomExceptionHandler> logger)
    {
        this.logger = logger;
    }

    /// <inheritdoc />
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        switch (exception)
        {
            case ValidationException validationException:
                await WriteProblemAsync(
                    httpContext,
                    new ValidationProblemDetails(validationException.Errors)
                    {
                        Status = StatusCodes.Status400BadRequest,
                        Title = "One or more validation errors occurred.",
                    },
                    StatusCodes.Status400BadRequest,
                    cancellationToken);
                return true;

            case NotFoundException notFoundException:
                await WriteProblemAsync(
                    httpContext,
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status404NotFound,
                        Title = "The requested resource was not found.",
                        Detail = notFoundException.Message,
                    },
                    StatusCodes.Status404NotFound,
                    cancellationToken);
                return true;

            default:
                this.logger.LogError(exception, "Unhandled exception processing {Path}: {Message}", httpContext.Request.Path, exception.Message);
                await WriteProblemAsync(
                    httpContext,
                    new ProblemDetails
                    {
                        Status = StatusCodes.Status500InternalServerError,
                        Title = "An unexpected error occurred.",
                    },
                    StatusCodes.Status500InternalServerError,
                    cancellationToken);
                return true;
        }
    }

    private static async Task WriteProblemAsync(HttpContext httpContext, ProblemDetails problemDetails, int statusCode, CancellationToken cancellationToken)
    {
        httpContext.Response.StatusCode = statusCode;
        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
    }
}
