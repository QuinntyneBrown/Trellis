namespace Trellis.Core.PlantUml;

/// <summary>
/// Represents the result of a PlantUML rendering operation.
/// </summary>
public sealed record PlantUmlRenderResult
{
    /// <summary>
    /// Gets a value indicating whether rendering succeeded.
    /// </summary>
    public bool IsSuccess { get; init; }

    /// <summary>
    /// Gets the rendered bytes on success.
    /// </summary>
    public byte[]? Content { get; init; }

    /// <summary>
    /// Gets the user-facing error on failure.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Creates a successful result.
    /// </summary>
    /// <param name="content">The rendered bytes.</param>
    /// <returns>A successful result.</returns>
    public static PlantUmlRenderResult Success(byte[] content) => new()
    {
        IsSuccess = true,
        Content = content,
    };

    /// <summary>
    /// Creates a failed result.
    /// </summary>
    /// <param name="errorMessage">The user-facing error.</param>
    /// <returns>A failed result.</returns>
    public static PlantUmlRenderResult Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        ErrorMessage = errorMessage,
    };
}
