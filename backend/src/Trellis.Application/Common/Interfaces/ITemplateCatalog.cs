using Trellis.Application.Common.Models;

namespace Trellis.Application.Common.Interfaces;

/// <summary>
/// Port for reading the catalog of vendored PlantUML starter templates.
/// Implemented by the Infrastructure layer.
/// </summary>
public interface ITemplateCatalog
{
    /// <summary>
    /// Gets every template in the catalog.
    /// </summary>
    /// <returns>The full list of templates.</returns>
    IReadOnlyList<TemplateDto> GetAll();

    /// <summary>
    /// Gets a single template by its key.
    /// </summary>
    /// <param name="key">The kebab-case template key.</param>
    /// <returns>The matching template, or <see langword="null"/> if none exists.</returns>
    TemplateDto? GetByKey(string key);
}
