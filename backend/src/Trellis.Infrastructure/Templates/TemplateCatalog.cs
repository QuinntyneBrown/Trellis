using System.Text.Json;
using Microsoft.Extensions.Logging;
using Trellis.Application.Common.Interfaces;
using Trellis.Application.Common.Models;

namespace Trellis.Infrastructure.Templates;

/// <summary>
/// Reads the vendored templates manifest and its accompanying .puml files on first
/// use, caching the resulting templates in memory for the lifetime of the process.
/// </summary>
public class TemplateCatalog : ITemplateCatalog
{
    private static readonly JsonSerializerOptions ManifestJsonOptions = new(JsonSerializerDefaults.Web);

    private readonly string templatesRootPath;
    private readonly ILogger<TemplateCatalog> logger;
    private readonly object gate = new();
    private IReadOnlyList<TemplateDto>? cachedTemplates;

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplateCatalog"/> class.
    /// </summary>
    /// <param name="logger">The logger.</param>
    public TemplateCatalog(ILogger<TemplateCatalog> logger)
        : this(Path.Combine(AppContext.BaseDirectory, "Vendor", "templates"), logger)
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="TemplateCatalog"/> class with an
    /// explicit templates root path, primarily for testability.
    /// </summary>
    /// <param name="templatesRootPath">The folder containing manifest.json and the template .puml files.</param>
    /// <param name="logger">The logger.</param>
    public TemplateCatalog(string templatesRootPath, ILogger<TemplateCatalog> logger)
    {
        this.templatesRootPath = templatesRootPath;
        this.logger = logger;
    }

    /// <inheritdoc />
    public IReadOnlyList<TemplateDto> GetAll()
    {
        return this.EnsureLoaded();
    }

    /// <inheritdoc />
    public TemplateDto? GetByKey(string key)
    {
        return this.EnsureLoaded()
            .FirstOrDefault(template => string.Equals(template.Key, key, StringComparison.OrdinalIgnoreCase));
    }

    private IReadOnlyList<TemplateDto> EnsureLoaded()
    {
        if (this.cachedTemplates is not null)
        {
            return this.cachedTemplates;
        }

        lock (this.gate)
        {
            this.cachedTemplates ??= this.LoadFromDisk();
        }

        return this.cachedTemplates;
    }

    private IReadOnlyList<TemplateDto> LoadFromDisk()
    {
        var manifestPath = Path.Combine(this.templatesRootPath, "manifest.json");

        if (!File.Exists(manifestPath))
        {
            this.logger.LogError("Template manifest not found at {ManifestPath}.", manifestPath);
            return Array.Empty<TemplateDto>();
        }

        var manifestJson = File.ReadAllText(manifestPath);
        var entries = JsonSerializer.Deserialize<List<TemplateManifestEntry>>(manifestJson, ManifestJsonOptions)
            ?? new List<TemplateManifestEntry>();

        var templates = new List<TemplateDto>(entries.Count);

        foreach (var entry in entries)
        {
            var contentPath = Path.Combine(this.templatesRootPath, entry.File);

            if (!File.Exists(contentPath))
            {
                this.logger.LogError("Template file {ContentPath} referenced by manifest entry {Key} was not found.", contentPath, entry.Key);
                continue;
            }

            templates.Add(new TemplateDto
            {
                Key = entry.Key,
                Name = entry.Name,
                Category = entry.Category,
                Content = File.ReadAllText(contentPath),
            });
        }

        return templates;
    }
}
