# Defect & Change Log

See [README.md](README.md) for entry format and conventions.

<!-- Add new entries below, in ID order. -->

### D-001 — No way to assign a document to a folder in the Documents explorer
- **Type:** Change
- **Area:** Explorer (Documents)
- **Status:** Fixed
- **Expected:** From the DOCUMENTS explorer, it should be possible to move a document into a folder — drag and drop onto the target folder is the preferred interaction.
- **Actual:** No mechanism exists to assign/move a document to a folder.
- **Notes:** Fixed 2026-07-02. Drag a document row onto a folder row (or onto the tree's empty space to move to root); a "Move to Folder…" icon button on each document row opens a dialog as the keyboard-accessible fallback. Backend: new `PUT /api/documents/{id}/folder` endpoint (see docs/adr/backend/0001). Frontend design: docs/adr/frontend/0001. Covered by 6 backend integration tests, unit tests, and e2e/tests/documents-move-document.spec.ts.

### D-002 — DOCUMENTS explorer toolbar is cramped and cluttered
- **Type:** Change
- **Area:** Explorer (Documents)
- **Status:** Fixed
- **Expected:** A tighter, cleaner toolbar — actions like New Folder, Open, Rename, and Delete should be compact icon buttons (with tooltips) instead of taking up space as labeled controls.
- **Actual:** Toolbar feels cramped/cluttered with the current control layout.
- **Notes:** Fixed 2026-07-02 together with D-003 via a shared `TreeActionButtonComponent` (compact icon buttons with `title`/`aria-label` tooltips) used by the tree rows and the panel header. See docs/adr/frontend/0002.

### D-003 — Files explorer toolbar is cramped and cluttered
- **Type:** Change
- **Area:** Explorer (Files)
- **Status:** Fixed
- **Expected:** A tighter, cleaner toolbar — actions like New File, New Folder, and Delete should be compact icon buttons (with tooltips) instead of taking up space as labeled controls.
- **Actual:** Toolbar feels cramped/cluttered with the current control layout.
- **Notes:** Fixed 2026-07-02 with D-002 — both trees share one `TreeActionButtonComponent` and the `_tree-row.scss` mixin, so they read identically. See docs/adr/frontend/0002.
