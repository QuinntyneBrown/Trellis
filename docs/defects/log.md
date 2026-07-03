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

### D-004 — Opening a document closes the Documents explorer and nothing shows which document is being edited
- **Type:** Change
- **Area:** Explorer (Documents) / Editor
- **Status:** Fixed
- **Expected:** Selecting a document from the DOCUMENTS explorer opens it in the editor while the explorer stays open, and the explorer visibly indicates which document is currently being edited (e.g. a highlighted/active row).
- **Actual:** Opening a document closes the panel, and no row is marked as the currently open document.
- **Notes:** Fixed 2026-07-02. `onDocumentOpenedFromPanel` no longer collapses the panel; the editor's `documentId` flows into the tree as `activeDocumentId`, and the matching row gets a tinted highlight plus `aria-current="true"` (VS Code active-file idiom). Covered by unit tests and the extended e2e save-and-reopen spec.

### D-005 — Refreshing the browser loses the open Documents explorer
- **Type:** Defect
- **Area:** Explorer (Documents) / Editor
- **Status:** Fixed
- **Steps to reproduce:**
  1. Click the Documents rail icon to open the Documents explorer.
  2. Open a document — it loads in the editor and the panel stays open (D-004).
  3. Refresh the browser.
- **Expected:** The layout comes back as it was: the Documents explorer is still open (and the active document still highlighted).
- **Actual:** The panel is closed after the refresh — the side-panel choice is not persisted, unlike the pane sizes which already survive reloads.
- **Notes:** Fixed 2026-07-02, test-first: e2e/tests/side-panel-persists-across-reload.spec.ts was written and confirmed failing, then the fix landed — `activeSidePanel` is now persisted via EditorLayoutPreferencesService (additive `activeSidePanel` field on the same localStorage blob, explicit null for a deliberate close, stored 'explorer' dropped when the File System Access API is unsupported) and seeded on construction. Full e2e suite green (41/41).

### D-006 — Preview shows an error after refresh until a manual Ctrl+Enter
- **Type:** Defect
- **Area:** Editor / Rendering
- **Status:** Fixed
- **Steps to reproduce:**
  1. Open a saved document (URL is `/editor/{id}`).
  2. Refresh the browser.
- **Expected:** The preview re-renders the loaded document automatically, same as when opening it from the Documents panel.
- **Actual:** The preview shows a render error until the user presses Ctrl+Enter.
- **Notes:** Race on startup: the route-driven document fetch resolves before the SignalR hub connection finishes starting, so the auto-render's `invoke()` rejected ("connection is not in the 'Connected' State") and surfaced as a failed render. Fixed 2026-07-02, test-first: e2e/tests/preview-renders-after-reload.spec.ts written and confirmed failing, then `DiagramHubService.render` gained a `whenConnected()` gate — renders issued before the hub is up park until the start()/reconnect path flips to connected, then invoke. Covered by unit tests; full e2e suite green (42/42).
