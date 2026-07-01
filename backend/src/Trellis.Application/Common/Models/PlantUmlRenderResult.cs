namespace Trellis.Application.Common.Models;

/// <summary>
/// Represents the outcome of rendering a PlantUML source string.
/// </summary>
public record PlantUmlRenderResult
{
    /// <summary>
    /// Gets a value indicating whether the render succeeded.
    /// </summary>
    public bool IsSuccess { get; init; }

    /// <summary>
    /// Gets the rendered SVG markup, when <see cref="IsSuccess"/> is <see langword="true"/>.
    /// </summary>
    public string? Svg { get; init; }

    /// <summary>
    /// Gets a short, user-facing error message, when <see cref="IsSuccess"/> is <see langword="false"/>.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Creates a successful render result.
    /// </summary>
    /// <param name="svg">The rendered SVG markup.</param>
    /// <returns>A successful <see cref="PlantUmlRenderResult"/>.</returns>
    public static PlantUmlRenderResult Success(string svg) => new()
    {
        IsSuccess = true,
        Svg = svg,
        ErrorMessage = null,
    };

    /// <summary>
    /// Creates a failed render result.
    /// </summary>
    /// <param name="errorMessage">A short, friendly error message.</param>
    /// <returns>A failed <see cref="PlantUmlRenderResult"/>.</returns>
    public static PlantUmlRenderResult Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        Svg = null,
        ErrorMessage = errorMessage,
    };
}
