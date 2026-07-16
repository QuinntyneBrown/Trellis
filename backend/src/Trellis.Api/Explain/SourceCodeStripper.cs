using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// GetFiles-style token-count reduction for aggregated code files: strips
/// comments and collapses whitespace. Comment removal is string-literal-aware
/// (a character-by-character state machine, like GetFiles' own stripper) so
/// comment-like sequences inside string/char/template literals survive.
///
/// Markdown and PlantUML files are never passed through here -- the caller
/// (<see cref="FileAggregator"/>) includes them verbatim, because prose and
/// diagram source are exactly what the "Explain This" prompt wants intact.
/// </summary>
public static class SourceCodeStripper
{
    /// <summary>
    /// Strips comments (per the extension's comment syntax) and collapses
    /// whitespace: trailing whitespace is trimmed from every line and lines
    /// left blank are dropped.
    /// </summary>
    /// <param name="content">The raw file content.</param>
    /// <param name="path">The file path, whose extension selects the comment syntax.</param>
    /// <returns>The stripped content.</returns>
    public static string Strip(string content, string path)
    {
        var extension = System.IO.Path.GetExtension(path).ToLowerInvariant();

        var withoutComments = extension switch
        {
            ".ts" or ".cs" or ".scss" or ".css" => StripCLikeComments(content),
            ".html" or ".csproj" => StripHtmlComments(content),

            // .json/.sln/.yaml/.yml have no (portable) comment syntax worth
            // the risk of a false positive; they only get whitespace collapse.
            _ => content,
        };

        return CollapseWhitespace(withoutComments);
    }

    /// <summary>
    /// Removes <c>//</c> line comments and <c>/* */</c> block comments while
    /// tracking single-quote, double-quote and backtick string state (with
    /// backslash escapes). A <c>//</c> immediately preceded by <c>:</c> is
    /// deliberately NOT treated as a comment start so unquoted URLs -- e.g.
    /// CSS <c>url(http://...)</c> -- survive intact.
    /// </summary>
    private static string StripCLikeComments(string content)
    {
        var result = new StringBuilder(content.Length);
        var inString = false;
        var stringDelimiter = '\0';
        var i = 0;

        while (i < content.Length)
        {
            var current = content[i];
            var next = i + 1 < content.Length ? content[i + 1] : '\0';

            if (inString)
            {
                result.Append(current);
                if (current == '\\' && i + 1 < content.Length)
                {
                    result.Append(next);
                    i += 2;
                    continue;
                }

                if (current == stringDelimiter || current == '\n')
                {
                    // A newline ends "string state" defensively: an unterminated
                    // literal must not swallow the rest of the file.
                    inString = false;
                }

                i++;
                continue;
            }

            if (current is '"' or '\'' or '`')
            {
                inString = true;
                stringDelimiter = current;
                result.Append(current);
                i++;
                continue;
            }

            if (current == '/' && next == '/' && (i == 0 || content[i - 1] != ':'))
            {
                while (i < content.Length && content[i] != '\n')
                {
                    i++;
                }

                continue;
            }

            if (current == '/' && next == '*')
            {
                i += 2;
                while (i + 1 < content.Length && !(content[i] == '*' && content[i + 1] == '/'))
                {
                    i++;
                }

                i = Math.Min(i + 2, content.Length);
                continue;
            }

            result.Append(current);
            i++;
        }

        return result.ToString();
    }

    /// <summary>Removes <c>&lt;!-- --&gt;</c> comments (HTML and XML share the syntax).</summary>
    private static string StripHtmlComments(string content)
    {
        var result = new StringBuilder(content.Length);
        var i = 0;

        while (i < content.Length)
        {
            if (i + 3 < content.Length && content[i] == '<' && content[i + 1] == '!' && content[i + 2] == '-' && content[i + 3] == '-')
            {
                var end = content.IndexOf("-->", i + 4, StringComparison.Ordinal);
                i = end < 0 ? content.Length : end + 3;
                continue;
            }

            result.Append(content[i]);
            i++;
        }

        return result.ToString();
    }

    /// <summary>Trims trailing whitespace from every line and drops blank lines.</summary>
    private static string CollapseWhitespace(string content)
    {
        var lines = content.Split('\n');
        var kept = new List<string>(lines.Length);

        foreach (var line in lines)
        {
            var trimmed = line.TrimEnd('\r', ' ', '\t');
            if (trimmed.Length > 0)
            {
                kept.Add(trimmed);
            }
        }

        return string.Join('\n', kept);
    }
}
