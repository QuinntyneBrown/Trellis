# ADR-0004: Templates Side Panel

**Date:** 2026-07-03
**Category:** frontend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

The Templates rail icon opened a pop-out picker anchored to the rail: it
closed on selection, had no active state, no persistence, and surfaced a
read-only catalog. D-011 makes templates CRUD entities and asks for a
Templates explorer "similar to Documents".

## Decision

1. **Third exclusive side panel.** `'templates'` joins the
   `activeSidePanel` union (`'explorer' | 'documents' | 'templates' |
   null`), so panel exclusivity, reload persistence (D-005), the title-bar
   toggle's last-panel memory, resizing, and the rail active state all come
   from the existing machinery — the union sites and the
   `EditorLayoutPreferencesService` whitelist were the only wiring. The rail
   testid renamed `template-picker-toggle` → `templates-panel-toggle`
   (mirrors `documents-panel-toggle`). The panel STAYS OPEN when a template
   is applied — pinned by e2e.
2. **Flat single component** (`features/templates/templates-panel/`): no
   folders means none of the Documents panel's recursive-node, drag-drop, or
   reveal machinery — only its open-transition refresh and stale-response
   token idioms carry over.
3. **The editor is the content source** for mutations, via
   `[editorContent]` / `[editorKind]` inputs: New Template captures the
   current buffer under a prompted name; "Update from editor" overwrites a
   template (confirm-guarded); Rename prompts; Delete confirms. No
   template-editing editor mode — that would add a third editor identity
   (document / disk file / template) with its own save semantics for little
   gain.
4. **Applying fetches by id**: rows carry summaries only; the editor page's
   `onTemplateApplied` confirms discard BEFORE the fetch (dialog stays
   synchronous with the click), then adopts the template's content AND kind
   (a markdown template switches the editor to markdown).

## Options Considered

### Option 1: Side panel + editor-as-source row actions (chosen)
- **Pros:** Uniform with the other panels; zero new state machinery; CRUD
  without a new editing surface.
- **Cons:** Editing template content requires round-tripping through the
  editor buffer.

### Option 2: Keep the pop-out, add CRUD to it
- **Pros:** Less layout change.
- **Cons:** Pop-outs are transient; CRUD affordances need a persistent
  surface, and the request explicitly asked for a Documents-like explorer.

### Option 3: Template-editing editor mode
- **Pros:** Natural content editing.
- **Cons:** A third editor identity with its own save/unsaved-changes
  semantics — disproportionate machinery.

## Consequences

### Positive
- Templates behave like first-class library items; the old picker component,
  its POM, and its transient-UX quirks are gone.

### Negative
- "Update from editor" is indirect (load → edit → update) compared to
  in-place editing; acceptable for v1.

### Risks
- Union-site drift: a future fourth panel must touch the same enumerated
  sites (SidePanel type, layout-prefs whitelist, toolbar, wrapper SCSS
  child selector) — each is unit-tested here as the guard.

## Implementation Notes

- New: `features/templates/templates-panel/` (4 files),
  `core/models/template-summary.model.ts` + create/update request models,
  `'update'` glyph in `tree-action-icons.ts`, e2e
  `pom/components/templates-panel.component.ts`.
- Rewritten: `template.model.ts`, `templates.service.ts` (documents-service
  idioms incl. rename's fetch-then-echo of content AND kind).
- Deleted: `features/templates/template-picker/`, its POM and spec.
- docs/mocks/editor-template-picker.html re-authoring is a follow-up.

## References

- docs/defects/log.md — D-011
- docs/adr/backend/0003 — DB-backed, migration-seeded templates
