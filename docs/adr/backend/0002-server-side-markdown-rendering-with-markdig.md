# ADR-0002: Server-Side Markdown Rendering with Markdig

**Date:** 2026-07-03
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

Documents can now be Markdown as well as PlantUML (D-010). PlantUML renders
server-side (SignalR hub → Java → SVG), and the frontend preview injects the
result with Angular's sanitizer bypassed (`bypassSecurityTrustHtml`) — safe
today because the SVG comes from our own renderer. Markdown needed a render
path whose output is equally trustworthy under that same injection, and the
requirement was explicit behavior parity with PlantUML: auto-render on
open/reload, Ctrl+Enter, the same error surface.

## Decision

Render markdown **server-side with Markdig**, through the existing SignalR
hub, as a **second hub method `RenderMarkdown(string source)`** on
`PlantUmlHub` (route unchanged):

- SignalR does not support method overloads, and adding a kind parameter to
  `RenderDiagram` would break the deployed client contract plus every
  byte-pinned guard-message test. A sibling method keeps the PlantUML
  surface byte-identical and gives markdown parallel guards ("Markdown
  source must not be empty." / same 100k length cap).
- Markdig is synchronous and CPU-bound (milliseconds): no semaphore, no
  cancellation branch, `Task.FromResult`.
- `PlantUmlRenderResult` was renamed to `RenderResult` and gained a nullable
  `Html` field + `SuccessHtml` factory. Exactly one of `Svg`/`Html` is set
  on success; the client picks its preview branch purely from which field
  arrived. PlantUML results just gain an inert `html: null` on the wire.

**The safety model is the point** (`Markdown/MarkdigMarkdownRenderer.cs`):

1. `DisableHtml()` — raw HTML blocks/inlines in the source are emitted as
   escaped literal text, so every tag in the output is Markdig-generated
   with all text/attribute content HTML-escaped.
2. Deliberately **NOT `UseAdvancedExtensions()`** — that bundle includes
   GenericAttributes (`{#id .class onclick=...}`), which is author-controlled
   arbitrary attribute injection, i.e. XSS under the client's sanitizer
   bypass. Only specific benign extensions are enabled (pipe tables, task
   lists, autolinks, emphasis extras, list extras). A renderer test pins the
   exclusion so a future "just use advanced extensions" refactor fails loudly.
3. A post-parse URL walk: link/image URLs keep only `http:`/`https:`/
   `mailto:`/relative/`#fragment`; everything else (`javascript:`, `data:`,
   `file:` — including protocol-relative `//host`, which .NET parses as
   file-scheme) is neutralized to `#`. External links additionally get
   `target="_blank" rel="noopener noreferrer"` so a preview click never
   navigates the SPA away.

## Options Considered

### Option 1: Server-side Markdig via the existing hub (chosen)
- **Pros:** One render pipeline and error surface for both kinds; output
  safe-by-construction with no JS sanitizer dependency; same
  connection-parking (D-006) behavior for free; trivially unit-testable.
- **Cons:** A network round trip for a transform the browser could do; one
  new NuGet package.

### Option 2: Client-side rendering (marked/ngx-markdown + DOMPurify)
- **Pros:** Instant preview, no round trip; enables future live-typing preview.
- **Cons:** A second, divergent render path in the frontend; two new JS
  dependencies including a sanitizer that must be configured correctly
  forever; the preview's existing sanitizer bypass becomes a standing trap.

### Option 3: Kind parameter on the existing RenderDiagram method
- **Pros:** No second method.
- **Cons:** Breaks the deployed invoke contract and pinned tests; forks the
  guard messages internally anyway.

## Consequences

### Positive
- Markdown gets full parity (auto-render, reload, Ctrl+Enter, errors) by
  riding the existing pipeline; the preview stays a pure function of the
  result shape.

### Negative
- Every keystroke-render round-trips the hub; acceptable at current scale
  and consistent with PlantUML behavior.

### Risks
- Markdig extension drift could reintroduce attribute injection — mitigated
  by the pinning test and the URL-walk tests (`MarkdigMarkdownRendererTests`).

## Implementation Notes

- `Markdig` 1.3.2 pinned in `backend/Directory.Packages.props`.
- `Hubs/PlantUmlHub.cs` (`RenderMarkdown`), `Models/RenderResult.cs`,
  `Markdown/IMarkdownRenderer.cs` + `MarkdigMarkdownRenderer.cs`, DI in
  `Common/DependencyInjection.cs`.

## References

- docs/defects/log.md — D-010
- docs/adr/frontend/0003 — per-document kind and result-shape-driven preview
