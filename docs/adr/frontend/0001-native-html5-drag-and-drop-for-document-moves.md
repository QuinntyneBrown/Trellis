# ADR-0001: Native HTML5 Drag-and-Drop for Document Moves

**Date:** 2026-07-02
**Category:** frontend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

Defect D-001 asks for drag-and-drop assignment of documents to folders in the Documents panel,
with drag-and-drop named as the ideal interaction. The tree is recursive
(`DocumentTreeNodeComponent` self-imports), folders can nest arbitrarily, and the panel's tree
container needs to double as a "move to root" drop zone. `@angular/cdk` is not currently a
dependency of this project.

## Decision

Implement drag-and-drop with the native HTML5 API (`draggable`, `dragstart`, `dragenter`,
`dragover`, `dragleave`, `drop`) rather than adding `@angular/cdk`'s `DragDropModule`.

Key mechanics:
- A custom dataTransfer type, `application/x-trellis-document-id`, carries the document id and
  identifies our drags: during `dragover` only `dataTransfer.types` is readable (DnD protected
  mode), so the type's presence is the identification.
- Document rows are drag sources; folder rows and the tree container are drop targets. Folder-row
  handlers `stopPropagation()` so the enclosing root drop zone never co-fires.
- Per-row `dragenter`/`dragleave` counting prevents highlight flicker while crossing child
  elements (chevron, name, action buttons).
- The same-folder no-op guard lives in `DocumentsPanelComponent.onMoveDocument` — the single
  entry point that folder drops, root drops, and the "Move to Folder…" dialog all funnel into —
  because only the panel holds the flat document list, and `getData()` is unreadable mid-drag.
- A "Move to Folder…" dialog (mirroring the save dialog, reusing `flattenFolderOptions`) is the
  keyboard-accessible fallback, since drag-and-drop is pointer-only.

## Options Considered

### Option 1: Native HTML5 drag-and-drop (chosen)
- **Pros:** No new dependency; works naturally with a recursive tree (any element can be a drop
  target); real OS-level drag semantics; Playwright's `dragTo` drives it in Chromium.
- **Cons:** Verbose event choreography with well-known traps (mandatory `preventDefault` in
  `dragover`, protected-mode `getData`, dragleave flicker) — all mitigated and unit-tested.

### Option 2: `@angular/cdk` DragDropModule
- **Pros:** Higher-level API, built-in previews/placeholders, battle-tested.
- **Cons:** New dependency for one feature; `cdkDropList` is list-reorder-shaped and notoriously
  awkward for nested trees (nested drop lists intercept each other); drop-on-node (rather than
  reorder) still requires custom work.

### Option 3: Dialog/context-menu only, no drag-and-drop
- **Pros:** Least code.
- **Cons:** The defect explicitly names drag-and-drop as the ideal interaction.

## Consequences

### Positive
- Zero dependency growth; the interaction matches the defect's ask; the move plumbing is
  UI-agnostic (a future context menu can reuse `onMoveDocument` untouched).

### Negative
- HTML5 DnD does not work on most mobile browsers without a shim — acceptable for this
  desktop-oriented editor, and the dialog fallback covers non-pointer input.

### Risks
- jsdom implements neither `DataTransfer` nor `DragEvent`, so unit tests call handlers directly
  with stub events. E2E coverage of the real browser pipeline lives in
  `e2e/tests/documents-move-document.spec.ts`.

## Implementation Notes

- `frontend/src/app/features/documents/document-tree-node/` — drag source/target handlers,
  `DOCUMENT_DRAG_TYPE`, `MoveDocumentEvent`.
- `frontend/src/app/features/documents/documents-panel/` — root drop zone, `onMoveDocument`
  no-op guard + destination auto-expand, dialog wiring.
- `frontend/src/app/features/documents/move-document-dialog/` — the fallback dialog.
- `frontend/src/app/shared/folder-options.ts` — relocated from the save dialog so both dialogs
  share the flattened, nbsp-indented folder option list.

## References

- docs/defects/log.md — D-001
- ADR-0001 (backend): Dedicated Move Endpoint for Document Folder Assignment
