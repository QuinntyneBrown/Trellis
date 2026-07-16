using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// Default <see cref="IExplainPromptBuilder"/>: an "explain this" prompt
/// adapted from Geoffrey Litt's explain-diff prompt
/// (https://gist.github.com/geoffreylitt/a29df1b5f9865506e8952488eac3d524)
/// for a plain LLM/ollama chat -- same Background / Intuition / Code
/// walkthrough / Quiz structure, but asking for markdown chat output instead
/// of an interactive HTML file, with diagrams as PlantUML fences instead of
/// HTML figures. It mandates the architecture description style guide at
/// https://github.com/QuinntyneBrown/architecture-description-style-guide.
/// </summary>
public class ExplainPromptBuilder : IExplainPromptBuilder
{
    /// <inheritdoc />
    public string Build(AggregationResult aggregation)
    {
        var builder = new StringBuilder();

        builder.Append("# Explain This\n\n");
        builder.Append("Please give me a rich explanation of the code included below.\n\n");

        builder.Append("## What to cover\n\n");
        builder.Append("Structure your explanation in these sections:\n\n");
        builder.Append("- **Background** — Explain the system this code belongs to. We don't know how much the reader ");
        builder.Append("already knows, so start with a deep background for beginners (note that it can be skipped if the ");
        builder.Append("reader is already familiar), then narrow to the background directly relevant to this code.\n");
        builder.Append("- **Intuition** — Explain the core intuition behind how the code works. Focus on the essence, ");
        builder.Append("not the full details. Use concrete examples with toy data, and use diagrams liberally.\n");
        builder.Append("- **Code walkthrough** — Do a high-level walkthrough of the files. Group and order them in an ");
        builder.Append("understandable way rather than file-by-file in listing order.\n");
        builder.Append("- **Quiz** — Finish with five multiple-choice questions that test whether the reader actually ");
        builder.Append("understood the substance of the code — medium difficulty, no gotchas. Put the answers, with a ");
        builder.Append("short explanation of each, at the very end.\n\n");

        builder.Append("## Style guide\n\n");
        builder.Append("When describing the architecture you MUST follow the architecture description style guide at ");
        builder.Append("https://github.com/QuinntyneBrown/architecture-description-style-guide.\n\n");

        builder.Append("## Format\n\n");
        builder.Append("- Respond in plain markdown suitable for a chat window — no HTML.\n");
        builder.Append("- Write with clarity and flow, in classic style, with smooth transitions between sections.\n");
        builder.Append("- Use fenced code blocks for code excerpts.\n");
        builder.Append("- Express diagrams as ```plantuml fenced code blocks — never ASCII art.\n");
        builder.Append("- Use block-quote callouts for key concepts, definitions, and important edge cases.\n\n");

        builder.Append("## Files (").Append(aggregation.FileCount).Append(aggregation.FileCount == 1 ? " file" : " files").Append(")\n\n");
        builder.Append("Each file below sits between `=== FILE: path ===` and `=== END FILE: path ===` markers, inside a ");
        builder.Append("fenced code block tagged with its language (PlantUML sources are tagged `plantuml`). Comments and ");
        builder.Append("blank lines may have been stripped from code files to save context.\n\n");
        builder.Append(aggregation.Content);

        return builder.ToString();
    }
}
