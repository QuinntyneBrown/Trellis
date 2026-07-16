using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// Default <see cref="IExplainPromptBuilder"/>: a self-contained prompt asking
/// for a lean, diagram-centric explanation of the separately uploaded source
/// attachment. All rules are embedded because the target LLM may have no
/// network access.
/// </summary>
public class ExplainPromptBuilder : IExplainPromptBuilder
{
    /// <inheritdoc />
    public string Build(AggregationResult aggregation, string attachmentFileName)
    {
        var builder = new StringBuilder();

        builder.Append("# Explain This\n\n");
        builder.Append("Explain the source code in the uploaded attachment as Markdown. Use only this prompt and the ");
        builder.Append("attachment: do not make HTTP calls, follow external links, or assume access to other material. ");
        builder.Append("Return only the explanation, with no conversational preface, and cover exactly these three sections:\n\n");

        builder.Append("## Overview\n\n");
        builder.Append("- **Background** — explain the system this code belongs to. Start with a beginner-friendly mental ");
        builder.Append("model (skippable if the reader is already familiar), then narrow to the context directly relevant ");
        builder.Append("to this codebase.\n");
        builder.Append("- **Intuition** — explain the core intuition behind how the code works. Focus on the essence, not ");
        builder.Append("the full details. Use concrete toy examples and diagrams liberally.\n");
        builder.Append("- Then add one subsection per significant component or module, explaining its responsibility in ");
        builder.Append("plain language.\n\n");

        builder.Append("## Class Diagrams\n\n");
        builder.Append("One or more PlantUML class diagrams showing the relationships (inheritance, composition, ");
        builder.Append("dependency) between the components and types.\n\n");

        builder.Append("## Sequence Diagrams\n\n");
        builder.Append("One or more PlantUML sequence diagrams showing the key runtime behaviors and interactions ");
        builder.Append("between components.\n\n");

        builder.Append("## Format\n\n");
        builder.Append("- Respond in plain Markdown — no HTML.\n");
        builder.Append("- Express every diagram as a fenced `plantuml` code block. Never use ASCII art or Mermaid.\n\n");

        builder.Append("## Uploaded files\n\n");
        builder.Append("The source files are provided in the uploaded attachment `").Append(attachmentFileName).Append("` ");
        builder.Append("(").Append(aggregation.FileCount).Append(aggregation.FileCount == 1 ? " file" : " files").Append("). ");
        builder.Append("Read that attachment before answering. Each source file sits between `=== FILE: path ===` and ");
        builder.Append("`=== END FILE: path ===` markers inside a fenced code block tagged with its language ");
        builder.Append("(PlantUML sources are tagged `plantuml`). Comments and blank lines may have been stripped from ");
        builder.Append("code files to save context.\n");

        return builder.ToString();
    }
}
