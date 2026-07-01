using FluentValidation.Results;

namespace Trellis.Application.Common.Exceptions;

/// <summary>
/// Thrown by the validation pipeline behaviour when one or more validators fail.
/// Carries its errors in the exact shape of ASP.NET Core's ValidationProblemDetails.Errors,
/// so the API layer can pass it straight through.
/// </summary>
public class ValidationException : Exception
{
    /// <summary>
    /// Initializes a new instance of the <see cref="ValidationException"/> class.
    /// </summary>
    public ValidationException()
        : base("One or more validation failures have occurred.")
    {
        this.Errors = new Dictionary<string, string[]>();
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="ValidationException"/> class from a set of failures.
    /// </summary>
    /// <param name="failures">The validation failures to aggregate.</param>
    public ValidationException(IEnumerable<ValidationFailure> failures)
        : this()
    {
        this.Errors = failures
            .GroupBy(failure => failure.PropertyName, failure => failure.ErrorMessage)
            .ToDictionary(group => group.Key, group => group.ToArray());
    }

    /// <summary>
    /// Gets the validation errors, keyed by property name.
    /// </summary>
    public IDictionary<string, string[]> Errors { get; }
}
