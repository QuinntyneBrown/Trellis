using Trellis.Api.Models;

namespace Trellis.Api.Templates;

/// <summary>
/// The catalog of vendored PlantUML starter templates. The six entries are fixed at
/// build time, so they are declared here and their .puml files read eagerly on
/// construction - a missing file fails loudly instead of silently shortening the
/// list. Registered as a singleton, which also makes the one-time load thread safe.
/// </summary>
public class TemplateCatalog
{
    private static readonly (string Key, string Name, string Category, string File)[] Entries =
    {
        ("blank", "Blank", "General", "blank.puml"),
        ("sequence", "Sequence Diagram", "General", "sequence.puml"),
        ("class", "Class Diagram", "General", "class.puml"),
        ("c4-context", "C4 - Context", "C4", "c4-context.puml"),
        ("c4-container", "C4 - Container", "C4", "c4-container.puml"),
        ("c4-component", "C4 - Component", "C4", "c4-component.puml"),
    };

    private readonly IReadOnlyList<TemplateDto> templates;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplateCatalog"/> class, reading
    /// every template file from the vendored templates folder.
    /// </summary>
    public TemplateCatalog()
    {
        var templatesRootPath = Path.Combine(AppContext.BaseDirectory, "Vendor", "templates");

        this.templates = Entries
            .Select(entry => new TemplateDto
            {
                Key = entry.Key,
                Name = entry.Name,
                Category = entry.Category,
                Content = File.ReadAllText(Path.Combine(templatesRootPath, entry.File)),
            })
            .ToArray();
    }

    /// <summary>
    /// Gets every template in the catalog.
    /// </summary>
    /// <returns>The full list of templates.</returns>
    public IReadOnlyList<TemplateDto> GetAll() => this.templates;
}
