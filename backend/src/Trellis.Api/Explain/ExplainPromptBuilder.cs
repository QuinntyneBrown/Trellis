using System.Text;

namespace Trellis.Api.Explain;

/// <summary>
/// Default <see cref="IExplainPromptBuilder"/>: a self-contained prompt for
/// authoring an evidence-based enterprise Software Design Document from the
/// separately uploaded source attachment. All style and document-structure
/// rules are embedded because the target LLM may have no network access.
/// </summary>
public class ExplainPromptBuilder : IExplainPromptBuilder
{
    /// <inheritdoc />
    public string Build(AggregationResult aggregation, string attachmentFileName)
    {
        var builder = new StringBuilder();

        builder.Append("# Explain This — Software Design Document\n\n");
        builder.Append("Author a publication-ready Software Design Document in structured Markdown from the source code ");
        builder.Append("in the uploaded attachment. The document is intended for an enterprise Confluence knowledge base. ");
        builder.Append("Use only this prompt and the attachment: do not make HTTP calls, follow external links, or assume ");
        builder.Append("access to repositories, standards, tickets, or organizational knowledge.\n\n");

        builder.Append("## Required deliverable\n\n");
        builder.Append("Return only the Software Design Document. Use this exact section order and retain every section. ");
        builder.Append("When the source does not establish required enterprise context, keep the section and insert a ");
        builder.Append("specific `<TO SUPPLY: …>` placeholder. Begin with `# Software Design Document — <entity name>`, ");
        builder.Append("using `<TO SUPPLY: entity name>` when the name is not established.\n\n");
        builder.Append("- `## 1. Document control` — title, entity of interest, owner, status, version, date, audience, and references.\n");
        builder.Append("- `## 2. Executive summary` — purpose, design scope, principal capabilities, and material constraints.\n");
        builder.Append("- `## 3. Scope and objectives` — included and excluded responsibilities, goals, and success criteria.\n");
        builder.Append("- `## 4. System context` — environment, external actors, upstream/downstream dependencies, trust boundaries, and a PlantUML context diagram.\n");
        builder.Append("- `## 5. Stakeholders and concerns` — role-based stakeholders, their concerns, and a traceable mapping table.\n");
        builder.Append("- `## 6. Requirements, constraints, and assumptions` — separate evidenced requirements, technical constraints, and unresolved assumptions.\n");
        builder.Append("- `## 7. Architecture overview` — architectural style, boundaries, responsibilities, principal components, and a PlantUML component or container view.\n");
        builder.Append("- `## 8. Detailed design` — module breakdown, interfaces, contracts, data model, state, runtime workflows, error handling, and PlantUML sequence diagrams where useful.\n");
        builder.Append("- `## 9. Quality attributes` — security and privacy, reliability, performance and scalability, maintainability and testability, and accessibility where applicable.\n");
        builder.Append("- `## 10. Deployment and operations` — topology, configuration, secrets, observability, release, recovery, and operational ownership.\n");
        builder.Append("- `## 11. Architecture decisions and rationale` — choices, alternatives, rationale, consequences, affected concerns, and evidence.\n");
        builder.Append("- `## 12. Risks, limitations, and known inconsistencies` — severity, impact, mitigation, owner, and unresolved design questions.\n");
        builder.Append("- `## 13. Testing and verification` — test strategy, existing evidence, gaps, and acceptance or verification criteria.\n");
        builder.Append("- `## 14. Traceability and source map` — map material claims, components, interfaces, views, and decisions to attachment file paths.\n");
        builder.Append("- `## 15. Glossary` — stable definitions for domain-specific and architecture terms used in the document.\n\n");

        builder.Append("## Embedded architecture writing guide\n\n");
        builder.Append(SoftwareDesignDocumentStyleGuide.Content).Append("\n\n");

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
