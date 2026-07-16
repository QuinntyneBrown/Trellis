namespace Trellis.Api.Explain;

/// <summary>
/// The single source of truth for which files participate in an "Explain
/// This" aggregation: the GetFiles-style extension allowlist (plus markdown
/// and PlantUML), the fixed folder exclusions, and the fenced-code-block
/// language tag each extension renders with.
/// </summary>
public static class ExplainContentPolicy
{
    /// <summary>
    /// Maps every supported extension to the language tag used on its fenced
    /// code block in the aggregated output. PlantUML files deliberately map
    /// to "plantuml" so downstream renderers (and LLMs) treat the content as
    /// diagram source.
    /// </summary>
    private static readonly Dictionary<string, string> FenceLanguageByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".ts"] = "typescript",
        [".html"] = "html",
        [".scss"] = "scss",
        [".css"] = "css",
        [".cs"] = "csharp",
        [".csproj"] = "xml",
        [".sln"] = "text",
        [".json"] = "json",
        [".yaml"] = "yaml",
        [".yml"] = "yaml",
        [".md"] = "markdown",
        [".puml"] = "plantuml",
    };

    /// <summary>
    /// Folder names that are always skipped, mirroring GetFiles' fixed
    /// exclusions: generated/vendored trees that waste LLM context.
    /// </summary>
    private static readonly HashSet<string> ExcludedFolderNames = new(StringComparer.OrdinalIgnoreCase)
    {
        "node_modules",
        "dist",
        "bin",
        "obj",
        ".git",
    };

    /// <summary>
    /// Determines whether the file at <paramref name="path"/> participates in
    /// aggregation: its extension must be on the allowlist and no folder
    /// segment of its path may be excluded.
    /// </summary>
    /// <param name="path">The forward-slash relative path to test.</param>
    /// <returns><see langword="true"/> when the file should be aggregated.</returns>
    public static bool IsIncluded(string path)
    {
        var extension = System.IO.Path.GetExtension(path);
        if (string.IsNullOrEmpty(extension) || !FenceLanguageByExtension.ContainsKey(extension))
        {
            return false;
        }

        // Every segment except the last (the file name itself) is a folder.
        var segments = path.Split('/');
        for (var i = 0; i < segments.Length - 1; i++)
        {
            if (ExcludedFolderNames.Contains(segments[i]))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Gets the fenced-code-block language tag for the file at
    /// <paramref name="path"/> ("plantuml" for .puml, "csharp" for .cs, ...).
    /// </summary>
    /// <param name="path">The file path whose extension picks the tag.</param>
    /// <returns>The language tag, or "text" for unknown extensions.</returns>
    public static string FenceLanguageFor(string path)
    {
        var extension = System.IO.Path.GetExtension(path);
        return FenceLanguageByExtension.TryGetValue(extension, out var language) ? language : "text";
    }
}
