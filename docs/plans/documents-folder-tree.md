# Plan: Virtual Document Folders (file-tree documents panel)

## Context

The Documents side panel lists SQLite-persisted documents as a flat, updatedAt-desc list (`documents-panel` → `document-list-item` rows). The approved mocks (`docs/mocks/editor-documents-tree.html`, `editor-documents-tree-empty.html`, `editor-documents-tree-save-dialog.html`) define the target UX: **virtual folders** — database rows, not disk directories — rendered as a recursive tree reusing the Explorer's tree-row idiom, with a panel header ("Documents" + New Folder), per-row hover actions, native `window.prompt`/`window.confirm` flows, and a destination-folder select in the save dialog.

Session decisions already made:
- **"Collapse first, then build"** — already satisfied: the backend is now a single `Trellis.Api` project (controllers → `ApplicationDbContext` directly, DataAnnotations validation, no MediatR); documents-list-page is deleted; the resize-divider merge landed. This plan targets that simplified codebase (verified by exploration).
- **Move is deferred** — folder chosen at first save only; `PUT /api/documents/{id}` cannot change folders; Ctrl+S keeps the current folder. Upload stays root.

**First implementation step: save this plan to `docs/plans/documents-folder-tree.md`** (the user asked for the plan in the docs folder).

## Locked design

- **Data model:** `Folder { Id: Guid, Name: string(200), ParentFolderId: Guid? }`; `PlantUmlDocument` gains `FolderId: Guid?` (null = root).
- **API:** `GET/POST /api/folders`, `PUT /api/folders/{id}` (rename), `DELETE /api/folders/{id}` (cascade-deletes contained subfolders + documents); documents list/create gain `folderId`. No tree endpoint — client assembles the tree from two flat lists.
- **Sorting:** folders first, then documents, `localeCompare(..., { sensitivity: 'base' })` — matching `FileSystemAccessService.listChildren()`. `updatedAt` moves into the document row's `title` tooltip (single-line rows).
- **Hard e2e contract:** root documents stay directly visible as `[data-testid="document-item"][data-document-name]` rows with `document-item-open/rename/delete` buttons and native dialogs; save dialog keeps its testids. The two pinned specs (`documents-list-management.spec.ts`, `save-and-reopen-document.spec.ts`) must pass **unmodified**. Folder rows get new testids (`document-folder`, `data-folder-name`, `document-folder-new-folder/-rename/-delete`), header button `documents-new-folder`, tree container `documents-tree`.

## Key decisions (resolved during design)

- **D1 — POST validates folder existence → 404.** Precedent: `Upload` returns `NotFound()` for unknown `documentId`. Without the guard, SQLite FK enforcement (on by default in Microsoft.Data.Sqlite) would surface as a 500. Same guard for `parentFolderId` on `POST /api/folders`.
- **D2 — Request records (StyleCop SA1402/SA1649: one type per file, filename = type).** Split the shared `Contracts/DocumentRequest.cs`: new `CreateDocumentRequest` (`Name` required/200, `Content` required-allow-empty, `FolderId: Guid?`); rename `DocumentRequest` → `UpdateDocumentRequest` (shape unchanged — PUT *structurally* cannot accept a folder, mirroring the frontend's existing create/update model split). Folders: `CreateFolderRequest` (`Name`, `ParentFolderId?`), `RenameFolderRequest` (`Name`). `Folder` entity doubles as JSON response shape (like `PlantUmlDocument`); no `GET /api/folders/{id}` exists, so `POST` returns `Created($"/api/folders/{id}", folder)` (commented deviation from `CreatedAtAction`).
- **D3 — Save-dialog confirm payload becomes `{ name, folderId }`** (`SaveDialogResult` model beside the component). `performSave(name, folderId = null)` made public and bound directly: `(confirm)="performSave($event.name, $event.folderId)"`. Ctrl+S paths still call `performSave(name)` — safe: quick-save only runs on the update path, which never sends folderId.
- **D4 — Editor page (container) fetches folders on dialog open** into a `saveDialogFolders` signal bound as `[folders]`; fetch error → `[]` (dialog stays usable with "(No folder)"). Dialog stays dumb and flattens `Folder[]` to indented options itself.
- **D5 — EF/SQLite cascade.** Both FKs configured without navigation properties: self-FK `Folder.ParentFolderId` and `PlantUmlDocument.FolderId`, both `OnDelete(DeleteBehavior.Cascade)`. SQLite enforces FKs by default and cascades recursively — the controller deletes one folder row, the engine wipes the subtree. Self-referencing cascade is legal on SQLite (unlike SQL Server). Migration gotcha: adding an FK to the existing `Documents` table triggers EF's automatic SQLite table rebuild — data preserved, existing rows get NULL `FolderId`; review generated SQL for `onDelete: Cascade` on both FKs.
- **D6 — Frontend tree.** New recursive `DocumentTreeNodeComponent` mirroring `FileTreeNodeComponent` exactly (standalone self-import, `depth` input, `indentPx = 8 + depth*16` inline, CSS-triangle chevron, `stopPropagation`, native dialogs in the node, outputs re-emitted per level). No `parentNode` input — delete needs only `node.id`; root creation lives on the panel header. Node model: `{ id, name, kind: 'folder'|'document', document?, children?, expanded? }` — **no** `loadState`/lazy-load convention (both lists are always fully loaded). Pure `buildDocumentTree(folders, documents, expandedIds)` helper (+spec). Panel keeps `@Input open` / `@Output documentOpened` so `editor-page.component.html`'s panel binding is untouched; panel owns all I/O, caches both lists, holds `expandedFolderIds: Set<string>` (pruned on refresh; toggle rebuilds from cache without HTTP; create-subfolder pre-expands the parent). Shared tree-row styles move to `shared/styles/_tree-row.scss`, `@use`d by both `file-tree-node` and `document-tree-node` SCSS (explorer visuals unchanged). `document-list-item/` is deleted.

## Implementation steps

### Phase 0 — Plan doc
0. Write this plan to `docs/plans/documents-folder-tree.md`.

### Phase 1 — Backend (independently shippable; wire changes are additive)
1. `Domain/Folder.cs` — `Guid Id`, `string Name`, `Guid? ParentFolderId` (XML docs in house style).
2. `Persistence/Configurations/FolderConfiguration.cs` — `ToTable("Folders")`, Name required/200, self-FK cascade (D5); auto-discovered via `ApplyConfigurationsFromAssembly`.
3. `Persistence/Configurations/PlantUmlDocumentConfiguration.cs` — add `FolderId` FK cascade.
4. `Domain/PlantUmlDocument.cs` — add `Guid? FolderId` ("null = root; assigned at creation only").
5. `Persistence/ApplicationDbContext.cs` — `DbSet<Folder> Folders => this.Set<Folder>();`
6. Migration (no local tool manifest — global tool):
   `dotnet tool install --global dotnet-ef --version 8.0.28` (once), then from `backend/`:
   `dotnet ef migrations add AddFolders --project src/Trellis.Api --output-dir Persistence/Migrations`. Review per D5. Applied automatically at startup (`ApplicationDbContextInitialiser`).
7. Contracts per D2 (`CreateDocumentRequest.cs`, `CreateFolderRequest.cs`, `RenameFolderRequest.cs`; rename `DocumentRequest.cs` → `UpdateDocumentRequest.cs`).
8. `Models/DocumentListItemDto.cs` — add `required Guid? FolderId`.
9. `Controllers/DocumentsController.cs` — Create takes `CreateDocumentRequest` + D1 guard + sets `FolderId`; GetList projection gains `FolderId`; Update takes `UpdateDocumentRequest` (behavior unchanged); Upload untouched.
10. `Controllers/FoldersController.cs` — GetList (`AsNoTracking().ToListAsync()`, no server ordering — documented), Create (parent guard → 404; `Created(...)`), Rename (404/`Ok`), Delete (404; `Remove` + save; engine cascades; `NoContent`).
11. Integration tests (see Testing). `dotnet test` green.

### Phase 2 — Frontend data layer
12. `core/models/folder.model.ts`, `core/models/create-folder-request.model.ts`.
13. `document-summary.model.ts` + `document.model.ts` gain `folderId: string | null`; `create-document-request.model.ts` gains `folderId: string | null` (required in TS — every create site decides).
14. `core/services/folders.service.ts` (+spec) — thin HttpClient mirror of `DocumentsService`: `list()`, `create(request)`, `rename(id, newName)` (PUT `{name}`), `delete(id)`.
15. **Add `DocumentsService.rename(id, newName)`** wrapping today's GET-then-PUT choreography (audit F6; note: this method does not exist yet — the panel currently inlines the switchMap). Panel will call it.
16. `core/models/document-tree-node.model.ts` + `features/documents/documents-panel/build-document-tree.ts` (+spec) per D6.

### Phase 3 — Documents panel becomes a tree (pinned e2e specs stay green)
17. `features/documents/document-tree-node/document-tree-node.component.{ts,html,scss}` (+spec) per D6. Outputs: `toggleExpand`, `openDocument(DocumentSummary)`, `createFolder({parentId, name})`, `renameNode({node, newName})`, `deleteNode(node)`. Prompts: `'New folder name'`, `'Rename folder'`/`'Rename document'` seeded + trim/unchanged-skip (matching `DocumentListItemComponent`). Confirms: document → `Delete "X"? This cannot be undone.` (existing wording); folder → `Delete "X" and everything inside it? This cannot be undone.`
18. `shared/styles/_tree-row.scss`; slim `file-tree-node.component.scss` to `@use` it.
19. Rework `documents-panel.component.{ts,html,scss}`: header + `documents-tree` container + empty state (`No saved documents yet.` only when both lists empty); all I/O + refresh orchestration (forkJoin) per D6; rename dispatch by kind (documents → `DocumentsService.rename`, folders → `FoldersService.rename`).
20. Delete `features/documents/document-list-item/` (all files).
21. Update `documents-panel.component.spec.ts` (+ `FoldersService` mock); add node component spec. `npm test` green; re-run the two pinned e2e specs.

### Phase 4 — Save dialog folder select
22. `save-dialog-result.model.ts`; dialog gains `@Input folders: Folder[] = []`, `selectedFolderId` signal (reset to null on open), `confirm: EventEmitter<SaveDialogResult>`; template gains `<select data-testid="save-dialog-folder">` with "(No folder)" first and nbsp-indented depth-first options via pure `folder-options.ts` helper (+spec); SCSS `.save-dialog__select` matches `__input`.
23. `editor-page.component.ts/.html` per D3/D4 (inject `FoldersService`; fetch on `onSaveClicked`; `performSave(name, folderId)`; create request gains `folderId`).
24. Update `editor-page.component.spec.ts` (FoldersService mock in the shared providers factory — required because the always-mounted panel now injects it; create-payload expectations; new tests: fetch-on-open, folderId sent, fetch-error fallback) and `save-dialog.component.spec.ts`.

### Phase 5 — E2E + polish
25. Extend `e2e/pom/components/documents-panel.component.ts`: `folder(name)`, `createRootFolder`, `createSubfolder`, `toggleFolder`, `renameFolder`, `deleteFolder` (assert confirm message contains `everything inside it`), `expectFolderListed/NotListed`.
26. Extend `save-document-dialog.component.ts` POM: `selectFolder(label)` via `selectOption({label})` (label-match caveat for nested nbsp-indented options — new spec only selects root-level folders).
27. New `e2e/tests/documents-folder-tree.spec.ts` (unique names; try/finally cleanup deleting the folder — cascade cleans the doc): create folder → save doc into it via dialog select → assert NOT listed collapsed → expand → listed → rename folder → still listed (expansion preserved by id) → delete folder w/ cascade confirm → folder and doc gone.
28. Sync `docs/mocks/`: update the three proposed mocks to the shipped DOM (document rows keep `document-item` testids; folder testids as implemented), move them from "Proposed" to the main inventory in `README.md` + `index.html`.

## Files touched (summary)

- **Backend new:** `Domain/Folder.cs`, `Configurations/FolderConfiguration.cs`, `Contracts/{CreateDocumentRequest,CreateFolderRequest,RenameFolderRequest}.cs`, `Controllers/FoldersController.cs`, migration pair, `IntegrationTests/Controllers/FoldersControllerTests.cs`.
- **Backend modified:** `PlantUmlDocument.cs`, `ApplicationDbContext.cs`, `PlantUmlDocumentConfiguration.cs`, `DocumentRequest.cs`→`UpdateDocumentRequest.cs`, `DocumentsController.cs`, `DocumentListItemDto.cs`, snapshot, `DocumentsControllerTests.cs`.
- **Frontend new:** `folder.model.ts`, `create-folder-request.model.ts`, `document-tree-node.model.ts`, `folders.service.ts`(+spec), `build-document-tree.ts`(+spec), `document-tree-node/`(component+spec), `save-dialog-result.model.ts`, `folder-options.ts`(+spec), `shared/styles/_tree-row.scss`.
- **Frontend modified:** `document-summary.model.ts`, `document.model.ts`, `create-document-request.model.ts`, `documents.service.ts`(+spec — rename helper), `documents-panel/*`, `save-dialog/*`, `editor-page/*`, `file-tree-node.component.scss`.
- **Frontend deleted:** `features/documents/document-list-item/` (all files).
- **E2E:** `documents-panel` + `save-document-dialog` POMs; new `documents-folder-tree.spec.ts`.
- **Docs:** `docs/plans/documents-folder-tree.md` (this plan); mock sync (step 28).

## Testing

- **Integration (xUnit, plain Assert):** FoldersControllerTests — create root/child 201 + echo, unknown parent 404, name validation 400, list, rename 200/404, delete 204/404, **cascade** (A ⊃ B with docs in each + root doc: DELETE A → folders gone, both docs 404, root doc survives). DocumentsControllerTests additions — POST with/without/unknown folderId (201/201-null/404), list exposes folderId, PUT leaves folderId unchanged (pins no-move), upload → null folderId.
- **Jest:** build-document-tree (nesting, sort, expanded set, orphan→root); folders.service; document-tree-node (testids/classes, indent math, chevron, recursion, prompt/confirm gating incl. cascade wording, stopPropagation, re-emits, document-row contract); documents-panel (root docs visible unexpanded, forkJoin refresh, header create, expanded-state preserve/prune, rename/delete dispatch by kind); save-dialog + folder-options (default null, indented options, `{name, folderId}` emission, reset on reopen); editor-page (create payload, fetch-on-open, error fallback, Ctrl+S unchanged).
- **E2E:** two pinned specs pass unmodified; new folder-tree spec per step 27.

**Verification commands:**
```
cd backend  && dotnet build && dotnet test    # StyleCop SA1402/SA1649 enforced at build
cd frontend && npm test
cd e2e      && npm test                       # playwright starts backend (E2E env) + ng serve
```
Manual check: run the app, compare panel/dialog against the three mocks.

## Risks / notes

- SQLite table rebuild in the migration (FK on existing `Documents`): automatic in EF 8; existing rows get NULL `FolderId`; review generated SQL.
- Every TestBed constructing `EditorPageComponent` needs the new `FoldersService` mock (panel is always mounted) — add once to the shared providers factory.
- Panel refreshes only on open (unchanged behavior); mutations while open refresh explicitly.
- Error surfacing parity: panel mutations stay fire-and-refresh (no error UI), as today.
- Panel sort order changes from updatedAt-desc to name sort (locked; neither pinned e2e spec asserts ordering); backend list ordering kept as-is (client re-sorts).
- Duplicate folder names within a parent are allowed (no uniqueness requirement).
- `folderId` appears in all document JSON — additive; TS models extended to match.

## Post-implementation review (adversarial, multi-agent)

A 3-dimension review + adversarial verification pass over the shipped feature confirmed 9 findings (2 more were refuted). Eight were fixed immediately:
- Backend delete races (create-into-deleted-folder FK violation; rename/delete racing a cascade) now translate to 404 centrally in `CustomExceptionHandler` instead of generic 500s.
- The save dialog's folder select renders only for first-time saves (`folderSelectionEnabled`) — an existing document's discarded selection is no longer possible.
- `DocumentsPanelComponent.refresh()` and the editor page's dialog folder fetch carry monotonic sequence tokens so stale responses can't clobber newer state.
- Integration tests strengthened: PUT with a real other folder's id pins the no-move contract; folder rename now has name-validation coverage.
- The folder-tree e2e spec's cleanup checks panel visibility before toggling.

**Accepted follow-up (not fixed, by design parity):** documents-panel mutations remain fire-and-refresh with no error UI — a failed folders/documents fetch silently shows the empty state, exactly as the flat list behaved. If error surfacing is wanted, mirror the explorer panel's `app-error-banner` pattern.
