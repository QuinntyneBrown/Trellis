namespace Trellis.Api.Explain;

/// <summary>
/// Self-contained house style embedded in every Explain This prompt. It is
/// adapted from the architecture-description style guide's authoring rules,
/// without its repository links, review modes, or findings-report format.
/// </summary>
internal static class SoftwareDesignDocumentStyleGuide
{
    /// <summary>Gets the complete offline authoring rules supplied to the LLM.</summary>
    internal const string Content =
        """
        ### Voice and audience

        - Write for an informed, non-specialist enterprise stakeholder who needs to locate scope, concerns, design choices, risks, and rationale quickly.
        - Use an impersonal, third-person voice. Do not use first person (`I`, `we`, `our`) or second person (`you`, `your`).
        - Use present tense for the architecture as implemented, future tense only for planned behavior, and past tense only for a recorded decision.
        - Do not refer to the writing process, the model, the prompt, or document generation. State the design directly.
        - Keep the register plain, factual, precise, and consistent. Remove hype, sales language, rhetorical questions, and unsupported claims.
        - Avoid fillers and intensifiers such as *very*, *really*, *highly*, *simply*, *obviously*, *basically*, *seamless*, *robust*, *powerful*, *cutting-edge*, and *world-class*.

        ### Normative language

        - Use **shall** for a requirement, **should** for a recommendation, and **may** for permission.
        - Use **can** for capability or possibility and **will** for a factual future event, not as substitutes for requirements.
        - Do not use *must*, *must not*, *need to*, *has to*, *is required to*, or emphasis to express an obligation.
        - Put one obligation in each normative sentence and do not weaken or inflate it with words such as *ideally*, *always*, *absolutely*, or *try to*.

        ### Controlled architecture vocabulary

        Use one term for one concept, expand every abbreviation on first use, and keep defined terms lowercase in running text.

        | Term | Meaning |
        |---|---|
        | architecting | activity of creating and sustaining an architecture, not the work product |
        | architecture | fundamental concepts, properties, and principles of an entity in its environment |
        | architecture description (AD) | work product that expresses an architecture |
        | AD element | named part of an architecture description |
        | architecture description framework (ADF) | domain conventions for describing architectures |
        | architecture description language (ADL) | language used to express an architecture description |
        | architecture view | applied representation governed by one viewpoint and addressing framed concerns |
        | architecture viewpoint | reusable conventions that frame concerns and govern one or more views |
        | aspect | part of the entity's functional, structural, informational, behavioural, or other character |
        | concern | matter of interest to a stakeholder |
        | correspondence | named relationship between two or more AD elements |
        | entity of interest (EoI) | subject being described, such as a system, service, product, or enterprise |
        | environment | context surrounding the entity of interest |
        | information part | separately identifiable body of information |
        | model kind | category of model and the conventions governing its model-based view components |
        | specification | complete, precise, and verifiable information part |
        | stakeholder | role or class that holds a concern in the entity of interest |
        | stakeholder perspective | way of thinking that groups concerns and organizes viewpoints |
        | view component | separable part of a view, governed by a model kind or documented by a legend |

        Always make these replacements when the architecture concept is intended:

        | Do not use | Use instead |
        |---|---|
        | system of interest | entity of interest (EoI) |
        | architecture framework | architecture description framework (ADF) |
        | architecture model | view component |
        | correspondence rule | correspondence method |
        | architecture document | architecture description (AD) |

        Distinguish neighbouring concepts: a concern is not a requirement; a stakeholder is not necessarily a user; a stakeholder perspective is not a viewpoint; an aspect is not a concern; a view is not a viewpoint; a view component is not a model kind; and a correspondence is not a correspondence method.

        ### Expression and evidence

        - Name the element that acts. Prefer “The gateway authenticates each request” to agentless passive constructions.
        - Make one main assertion per sentence. Keep list items grammatically parallel.
        - State quantities with units and evidence. Do not replace an unknown value with a vague adjective or quantifier.
        - Define a local term as a noun phrase with a stable name. Use that name consistently throughout the document.
        - Cite code evidence with repository-relative file paths in backticks. Do not cite line numbers because source files can change after generation.
        - Distinguish observed behavior from desired or planned behavior. Source code proves implementation; it does not by itself prove business intent, production topology, service-level objectives, ownership, or rationale.
        - Never invent stakeholders, requirements, decisions, rationale, operational guarantees, quantities, security controls, or organizational context.
        - When a required fact is unavailable, write a precise placeholder in the form `<TO SUPPLY: fact and responsible source>`.
        - Do not describe a guess as a fact. If an interpretation is necessary, label it “Interpretation” and cite the evidence that supports it.

        ### Architecture coverage and traceability

        - Identify the entity of interest, its environment, external actors, dependencies, and design scope.
        - Identify stakeholders as roles or classes and associate every stated concern with at least one stakeholder. Use placeholders when the code does not establish them.
        - Relate each architecture view to the viewpoint that governs it and the concerns it addresses.
        - Document each significant component, responsibility, boundary, interface, data flow, state transition, and failure path supported by the source.
        - Pair every recorded architecture decision with rationale, alternatives, consequences, and affected concerns. Use placeholders rather than inventing missing rationale.
        - Record known inconsistencies and unresolved design questions explicitly; silence does not mean none exist.
        - Maintain a source map from material design claims to the files that support them.

        ### Enterprise document conventions

        - Return only the Software Design Document, without a conversational preface, completion note, quiz, or explanation of these instructions.
        - Use one H1 title and the required numbered H2 sections in the specified order.
        - Use concise paragraphs, stable identifiers, Markdown tables for inventories and mappings, and bullet lists only when they improve scanning.
        - Use blockquotes beginning with **Key concept**, **Decision**, **Risk**, **Constraint**, or **Open question** for important callouts.
        - Use fenced code blocks only for short, relevant excerpts. Do not reproduce the uploaded source attachment.
        - Express every diagram as a fenced `plantuml` block. Do not use ASCII art, Mermaid, HTML, or external image links.
        - Give every diagram a short title and explanatory paragraph, and ensure that its elements use the same names as the prose and tables.
        - Keep headings and tables suitable for direct transfer into an enterprise Confluence page.

        ### Hard rules

        1. Use only the prompt and uploaded attachment as sources; do not make network calls or request external material.
        2. Do not use deprecated architecture terms when their defined concepts are intended.
        3. Express requirements only with **shall**, recommendations with **should**, and permissions with **may**.
        4. Do not write first-person, second-person, hype, or self-referential prose in the Software Design Document.
        5. Do not fabricate missing facts; use `<TO SUPPLY: …>`.
        6. Preserve traceability from claims, views, and decisions to source files or explicit placeholders.
        """;
}
