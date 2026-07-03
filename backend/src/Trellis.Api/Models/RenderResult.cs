namespace Trellis.Api.Models;

/// <summary>
/// Represents the outcome of rendering a document source string: SVG for
/// PlantUML renders, HTML for markdown renders. Exactly one of
/// <see cref="Svg"/> and <see cref="Html"/> is populated on success -- the
/// client picks its preview branch purely from which field is set.
/// </summary>
public record RenderResult
{
    /// <summary>
    /// Gets a value indicating whether the render succeeded.
    /// </summary>
    public bool IsSuccess { get; init; }

    /// <summary>
    /// Gets the rendered SVG markup, when <see cref="IsSuccess"/> is <see langword="true"/> for a PlantUML render.
    /// </summary>
    public string? Svg { get; init; }

    /// <summary>
    /// Gets the rendered HTML markup, when <see cref="IsSuccess"/> is <see langword="true"/> for a markdown render.
    /// </summary>
    public string? Html { get; init; }

    /// <summary>
    /// Gets a short, user-facing error message, when <see cref="IsSuccess"/> is <see langword="false"/>.
    /// </summary>
    public string? ErrorMessage { get; init; }

    /// <summary>
    /// Creates a successful PlantUML render result.
    /// </summary>
    /// <param name="svg">The rendered SVG markup.</param>
    /// <returns>A successful <see cref="RenderResult"/>.</returns>
    public static RenderResult Success(string svg) => new()
    {
        IsSuccess = true,
        Svg = svg,
        Html = null,
        ErrorMessage = null,
    };

    /// <summary>
    /// Creates a successful markdown render result.
    /// </summary>
    /// <param name="html">The rendered HTML markup.</param>
    /// <returns>A successful <see cref="RenderResult"/>.</returns>
    public static RenderResult SuccessHtml(string html) => new()
    {
        IsSuccess = true,
        Svg = null,
        Html = html,
        ErrorMessage = null,
    };

    /// <summary>
    /// Creates a failed render result.
    /// </summary>
    /// <param name="errorMessage">A short, friendly error message.</param>
    /// <returns>A failed <see cref="RenderResult"/>.</returns>
    public static RenderResult Failure(string errorMessage) => new()
    {
        IsSuccess = false,
        Svg = null,
        Html = null,
        ErrorMessage = errorMessage,
    };
}
