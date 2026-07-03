# ADR-0003: Per-Document Kind with a Result-Shape-Driven Preview

**Date:** 2026-07-03
**Category:** frontend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

With markdown support (D-010), the app needs to know, per document, which
pipeline renders it, which Monaco language highlights it, and how the save
flow should classify new content. Nothing in the codebase carried a
content-type concept before.

## Decision

1. **Kind is a validated string `"plantuml" | "markdown"`**, not an enum:
   the backend entity is serialized raw as the API JSON, and these exact
   lowercase values are the wire contract matching the TS union
   (`DocumentKind`). Stored as a create-only `Kind` column (default/backfill
   `"plantuml"` via the `AddDocumentKind` migration); update/move never
   touch it.
2. **Kind sources**: the save dialog gains a Type select shown under the
   same create-only condition as the folder select (Save As / first save),
   seeded from the editor's current kind; disk files infer from extension
   (`inferDocumentKindFromFileName`, `.md`/`.markdown`); uploads are
   inferred server-side (a kind-mismatched replacing upload is a 400);
   templates and new documents reset to plantuml.
3. **The editor page owns a `documentKind` signal** threaded through every
   content path (`applyDocument`, `onDiskFileOpened`, `onTemplateSelected`,
   `performSave`, uploads) and passed to `DiagramHubService.render(source,
   kind)`, which dispatches to `RenderMarkdown` vs `RenderDiagram`.
4. **The preview branches on the result shape, not on a kind input**:
   `RenderResult.svg` set → centered SVG box; `RenderResult.html` set →
   markdown prose column (`data-testid="preview-markdown"`). The component
   stays a pure function of the result. Prose styles live under
   `:host ::ng-deep .diagram-preview__markdown` — **required**, because
   `[innerHTML]`-injected elements carry no emulated-encapsulation
   attributes and plain component-scoped selectors never match them.
5. **Monaco** gains a `language` input (`setModelLanguage` at runtime; the
   bundled `basic-languages/markdown` grammar needs no new dependency), and
   the Documents tree shows an "MD" badge on markdown rows.

## Options Considered

### Option 1: Result-shape-driven preview (chosen)
- **Pros:** The preview needs no kind plumbing and cannot disagree with what
  the server actually rendered; failure handling is shared.
- **Cons:** The contract must guarantee exactly one of svg/html on success
  (it does, by construction of the two factories).

### Option 2: Kind input on the preview component
- **Pros:** Explicit.
- **Cons:** A second source of truth that can drift from the result,
  especially around races between kind switches and in-flight renders.

## Consequences

### Positive
- Markdown documents behave identically to PlantUML ones everywhere that
  matters (open, reload auto-render, Ctrl+Enter, error surface, Save As).

### Negative
- The markdown HTML is injected with the sanitizer bypassed — acceptable
  only because the server output is safe by construction (ADR backend/0002);
  the frontend must never render markdown from any other source into this
  branch.

### Risks
- New content paths added later (e.g. collaborative editing) must remember
  to set `documentKind` — the editor-page spec's kind-flow tests are the
  guard.

## Implementation Notes

- `core/models/document-kind.model.ts`, `render-result.model.ts` (+`html`),
  `diagram-hub.service.ts`, `diagram-preview.component.*`,
  `monaco-editor.component.ts`, `editor-page.component.*`,
  `save-dialog.component.*` (Type select, `SaveDialogResult.kind`),
  `document-tree-node.component.*` (MD badge), upload `accept` list.

## References

- docs/defects/log.md — D-010
- docs/adr/backend/0002 — server-side markdown rendering with Markdig
