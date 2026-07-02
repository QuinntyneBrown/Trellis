using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace Trellis.Api.ErrorHandling;

/// <summary>
/// Last-resort exception-to-response translator: logs the failure and returns a
/// generic 500 problem that never leaks internal exception details. Expected
/// failures (validation, not-found) are handled inline by the controllers -
/// except for the two delete-race shapes below, which can only surface here.
/// </summary>
public class CustomExceptionHandler : IExceptionHandler
{
    /// <summary>SQLite's SQLITE_CONSTRAINT primary result code (FK violations and friends).</summary>
    private const int SqliteConstraintErrorCode = 19;

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
        // Both shapes mean "the row this request depends on was deleted while
        // the request was in flight" - e.g. inserting a document into a folder
        // that a concurrent request just cascade-deleted (FK violation), or
        // renaming/deleting a row a concurrent folder cascade already removed
        // (0 rows affected). The controllers' inline existence checks cannot
        // close that race window, so it is translated to the same 404 the
        // request would have received a moment later.
        if (exception is DbUpdateConcurrencyException
            || (exception is DbUpdateException { InnerException: SqliteException { SqliteErrorCode: SqliteConstraintErrorCode } }))
        {
            this.logger.LogWarning(exception, "Delete race processing {Path}; returning 404.", httpContext.Request.Path);

            httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
            await httpContext.Response.WriteAsJsonAsync(
                new ProblemDetails
                {
                    Status = StatusCodes.Status404NotFound,
                    Title = "The requested resource no longer exists.",
                },
                cancellationToken);

            return true;
        }

        this.logger.LogError(exception, "Unhandled exception processing {Path}: {Message}", httpContext.Request.Path, exception.Message);

        httpContext.Response.StatusCode = StatusCodes.Status500InternalServerError;
        await httpContext.Response.WriteAsJsonAsync(
            new ProblemDetails
            {
                Status = StatusCodes.Status500InternalServerError,
                Title = "An unexpected error occurred.",
            },
            cancellationToken);

        return true;
    }
}
