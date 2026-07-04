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

### D-007 — Adopt the VS Code-style top title bar from the HTML mocks
- **Type:** Change
- **Area:** Editor (chrome)
- **Status:** Fixed
- **Expected:** The app has the top chrome bar designed in docs/mocks: app menu (File/Edit/View/Help), a centered command-center pill showing the open document's name ("name — Trellis"), layout toggles (primary sidebar toggle functional, reflecting the open panel), and window controls — per the approved mock design.
- **Actual:** The app has no top chrome; the mock bar is marked "mock-only PROPOSAL".
- **Notes:** Fixed 2026-07-02. New `features/editor/title-bar/` component mounted above `.editor-page` (now `calc(100vh - 35px)`); command center binds `documentName`; the primary-sidebar toggle mirrors `activeSidePanel`, closes the open panel, and reopens the last-used one (falling back to Documents when Explorer is unsupported). Menus, command center, panel/secondary toggles, and window controls are static chrome in this first pass (matching the mock's note). Mocks re-synced: `mock-title-bar` proposal markers replaced with the real `title-bar` classes/`<app-title-bar>` host across all 14 pages, mock.css, components.html, and README. Unit (348/348) + e2e (43/43) green.

### D-008 — Ctrl+Shift+S silently saves instead of acting as "Save As"
- **Type:** Defect
- **Area:** Editor (save flow)
- **Status:** Fixed
- **Steps to reproduce:**
  1. Open (or save) a document, then load a template into the editor.
  2. Press Ctrl+Shift+S.
- **Expected:** "Save As": a dialog appears to give the document a name and a destination folder, and confirming creates a NEW document (never overwrites the current one).
- **Actual:** The Shift modifier is not distinguished from plain Ctrl+S, so with a document id present the content is quick-saved silently over the open document — no dialog, no name, no folder.
- **Notes:** The keydown handler matched `key.toLowerCase() === 's'` regardless of `shiftKey`. Fixed 2026-07-02, test-first (e2e/tests/save-as-with-ctrl-shift-s.spec.ts written red, then green): Ctrl+Shift+S now opens the save dialog in a dedicated 'saveAs' mode — heading "Save Document As", destination-folder select always shown, confirm always POSTs a new document and adopts its id (from disk-file mode this imports the content into the library and clears the handle). The mode resets on any dialog close so a later Ctrl+S quick-save can never create a duplicate. Also moved the shortcut listener to `document:keydown` — focus lands on `<body>` after picking a template (the click removes its own button), where the host-scoped listener silently missed the shortcut. Unit 353/353, e2e 44/44.

### D-009 — After a refresh, the active document's nested folder stays collapsed
- **Type:** Defect
- **Area:** Explorer (Documents)
- **Status:** Fixed
- **Steps to reproduce:**
  1. Save/open a document that lives inside a nested folder (e.g. parent/child).
  2. Refresh the browser.
- **Expected:** The Documents panel comes back open (D-005) with the active document's ancestor folders expanded, so the highlighted active row is visible.
- **Actual:** Folder expansion state starts empty after a refresh, so the active document sits hidden inside collapsed folders — the active highlight (D-004) can't be seen.
- **Notes:** Fixed 2026-07-02, test-first (e2e/tests/reveal-active-document-after-reload.spec.ts written red, then green). On every closed→open panel transition (including the persisted-open boot after a refresh), the next refresh expands the active document's ancestor folder chain — walked from the cached flat lists with a cycle guard — before rebuilding the tree (the VS Code reveal-active-file idiom). Reveal happens on open ONLY, so a deliberately collapsed folder survives mutation refreshes (unit-tested). Two e2e specs that encoded the pre-reveal collapsed-on-open behavior were updated. Unit 357/357, e2e 45/45.

### D-010 — Support Markdown documents alongside PlantUML
- **Type:** Change
- **Area:** Editor / Rendering / Documents
- **Status:** Fixed
- **Expected:** A database-persisted document can be Markdown or PlantUML, and markdown files opened from the file explorer render in the preview exactly like PlantUML content (auto-render on open and after reload, Ctrl+Enter re-render, same error surface).
- **Actual:** Everything was PlantUML-only; a `.md` file opened from the explorer errored through the PlantUML renderer.
- **Notes:** Implemented 2026-07-03, test-first (e2e/tests/markdown-document-round-trip.spec.ts written red first). Server-side rendering with Markdig via a new `RenderMarkdown` hub method (`RenderResult` gained an `Html` field; the preview branches purely on which field is set). Safety: raw HTML escaped (`DisableHtml`), `UseAdvancedExtensions` deliberately excluded (GenericAttributes = XSS; pinned by a test), unsafe URL schemes neutralized, external links get `noopener`. Documents carry a create-only `Kind` column (`AddDocumentKind` migration, default backfill "plantuml"); the save dialog gained a Type select; uploads accept `.md`/`.markdown` and infer kind (mismatched replace → 400); disk files infer kind from extension; Monaco switches to the bundled markdown grammar; the tree shows an MD badge. See docs/adr/backend/0002 and docs/adr/frontend/0003. Backend 70/70, frontend 372/372, e2e 47/47.

### D-011 — Templates explorer side panel with template CRUD
- **Type:** Change
- **Area:** Templates / Editor (chrome)
- **Status:** Fixed
- **Expected:** Clicking the Templates rail icon shows the templates in a Templates explorer side panel (like Documents), and templates can be created, updated, and deleted.
- **Actual:** Templates were a read-only static catalog surfaced as a pop-out picker anchored to the rail (closed on select, no active state, no CRUD).
- **Notes:** Implemented 2026-07-03, test-first (e2e/tests/templates-panel.spec.ts written red first). Templates are now a DB entity with full CRUD (`AddTemplates` migration seeds the six starters as ordinary editable/deletable rows — migration-seeding means deleted built-ins never resurrect); category dropped (names encode it); templates carry a kind (PUT-updatable, unlike documents). The panel is the third exclusive side panel through the existing `activeSidePanel` machinery (persistence, title-bar toggle memory, resize all inherited); rail testid renamed to `templates-panel-toggle` with the active state. Row actions: Apply, Update from editor, Rename, Delete; header New Template captures the current editor content/kind. The old template-picker component/POM were deleted. See docs/adr/backend/0003 and docs/adr/frontend/0004. Mocks re-authoring (editor-template-picker.html) is a noted follow-up. Backend 82/82, frontend 392/392, e2e 49/49.

### D-012 — Move New/Save/Upload into a functional File menu with Alt+N / Ctrl+U
- **Type:** Change
- **Area:** Editor (chrome) / Title bar
- **Status:** Fixed
- **Expected:** New, Save, and Upload are commands under the title bar's File menu (which becomes functional — it was static chrome from D-007), with keyboard shortcuts for New and Upload.
- **Actual:** The three actions were rail icons; the File menu did nothing; no New/Upload shortcuts existed.
- **Notes:** Implemented 2026-07-03, test-first (e2e/tests/file-menu.spec.ts written red first). File dropdown with New/Save/Upload items (item click, outside click, and Escape all close it; aria-haspopup/aria-expanded). Shortcuts: **Alt+N** for New — user-confirmed substitution, since browsers reserve Ctrl+N at the browser level and never deliver it to pages, so the menu advertises a shortcut that actually works — and **Ctrl+U** for Upload as requested (interceptable). The rail now holds only the three panel toggles + connection status; the hidden upload input moved to editor-page (testid `upload-input`), driven by the menu item and Ctrl+U alike. rail-tooltips e2e retargeted to the panel toggles; 13 `openSaveDialog` POM call sites re-pointed to the new file-menu POM. Mocks re-authoring (rail + File menu) is a noted follow-up. Frontend 395/395, e2e 50/50.

### D-013 — Export a folder subtree as one aggregated Markdown download
- **Type:** Change
- **Area:** Explorer (Documents) / Backend
- **Status:** Fixed
- **Expected:** A folder row in the Documents explorer has an Export action that aggregates every PlantUML and Markdown document in that folder — including all child folders — into a single markdown document, saved via a browser download named `<folder-name>.md`.
- **Actual:** No aggregation or export capability existed anywhere; documents could only be viewed one at a time in the editor.
- **Notes:** Implemented 2026-07-04, test-first (e2e/tests/export-folder.spec.ts written red first — the suite's first `waitForEvent('download')`). New `GET /api/folders/{id}/export` on FoldersController: in-memory BFS over the flat folder list with a cycle guard (the backend twin of `collectDescendantFolderIds`), returning `text/markdown; charset=utf-8`. The format contract (documented on the endpoint): H1 = folder name, subfolders one heading deeper than their parent and documents one deeper than their containing folder (both capped at H6); folders before documents per level, case-insensitively name-sorted; markdown content inlined verbatim, PlantUML wrapped in ```` ```plantuml ```` fences; document-less subfolders pruned; a wholly empty export returns the H1 plus an italic note; CRLF normalized to LF. Frontend: folder-row Export action (`document-folder-export`, arrow-into-tray icon) bubbles to the panel, which fetches via `FoldersService.exportFolder` (`responseType: 'text'`) and hands the text to a new injectable `FileDownloadService` (Blob → object URL → synthetic anchor click). Mocks re-authoring (documents-panel folder-row actions) remains a noted follow-up alongside D-011/D-012's. Backend 89/89, frontend 420/420, e2e 53/53.
