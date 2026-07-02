# Frontend HTML mocks

Static HTML mocks reverse-engineered from the Angular frontend under
`frontend/src/app`. They capture every screen and meaningful UI state of the
app as plain HTML/CSS — no build step, no JavaScript, no network.

## Viewing

Open [`index.html`](index.html) in a browser (double-click works; everything
is relative-path and offline). It shows a live-preview gallery of all mocks.
Individual pages can also be opened directly.

## Fidelity

The mocks mirror the DOM the app actually renders, not an artist's
impression:

- **Same structure.** Angular component host elements appear as-is
  (`<app-editor-toolbar>`, `<app-rail-button>`, …), with the same class
  names, `data-testid` attributes, and ARIA roles/labels/values the
  templates produce. Angular's style bindings appear as literal `style`
  attributes (e.g. the side panel's `display`/`width`).
- **Same styles.** [`assets/mock.css`](assets/mock.css) is hand-compiled
  from the component SCSS files; every rule block is annotated with its
  source file. Colors, sizes, and hover/active/focus states are copied
  verbatim, so hovering rail icons shows the real tooltips, tree rows and
  buttons show the real hover fills, etc.
- **Real data shapes.** Template names/categories match the backend's
  static template catalog; document timestamps appear as raw ISO-8601
  strings in each row's `title` tooltip, exactly as
  `DocumentTreeNodeComponent` renders them (there is no date pipe in the
  app); the render error text is what
  `PlantUmlRenderer.BuildFriendlyErrorMessage` forwards from PlantUML's
  stderr; both trees are sorted folders-first, case-insensitive, matching
  `FileSystemAccessService.listChildren()`.

Two things are facsimiles, clearly marked with `mock-only` comments:

- **The Monaco surface.** The app instantiates `monaco-editor` (theme `vs`,
  language `plaintext`, minimap off) at runtime; the mocks approximate the
  rendered surface with `.mock-monaco` (gutter `#237893` on `#fffffe`,
  Consolas 14px/19px).
- **The rendered diagram.** A hand-drawn SVG imitating what the vendored
  PlantUML 1.2026.6 outputs for the `sequence.puml` starter template
  (modern default style: `#E2E2F0` shapes, `#181818` lines).

Static mocks can't capture behavior: pane dragging, keyboard shortcuts
(Ctrl+Enter render, Ctrl+S save), the SignalR connection lifecycle, native
`window.confirm`/`window.prompt` flows (delete/rename), and the browser's
directory/file pickers are described in the page header comments instead.

## Inventory

| Mock | Route / state | Primary components |
| --- | --- | --- |
| [editor-blank.html](editor-blank.html) | `/editor` — blank untitled document, preview placeholder | `editor-page`, `editor-toolbar`, `rail-button`, `monaco-editor`, `diagram-preview`, `connection-status` |
| [editor-rendered.html](editor-rendered.html) | `/editor` — sequence template rendered (render-seq 1) | + `diagram-preview` success branch |
| [editor-rendering.html](editor-rendering.html) | `/editor` — re-render in flight, spinner overlay | + `loading-spinner` |
| [editor-render-error.html](editor-render-error.html) | `/editor` — hub returned `isSuccess: false` | + `diagram-preview` error branch |
| [editor-template-picker.html](editor-template-picker.html) | `/editor` — Templates panel open | + `template-picker` |
| [editor-save-dialog.html](editor-save-dialog.html) | `/editor` — modal save prompt | + `save-dialog` |
| [editor-documents-tree.html](editor-documents-tree.html) | `/editor` — Documents side panel docked (260px): virtual folder tree with expanded/collapsed folders and root documents | + `documents-panel`, `document-tree-node`, `resize-divider` |
| [editor-documents-tree-empty.html](editor-documents-tree-empty.html) | `/editor` — Documents panel, no documents or folders yet | + `documents-panel` empty branch |
| [editor-documents-tree-save-dialog.html](editor-documents-tree-save-dialog.html) | `/editor` — save dialog with the destination-folder select | + `save-dialog` folder branch |
| [editor-explorer-panel.html](editor-explorer-panel.html) | `/editor` — Explorer tree, disk file opened | + `explorer-panel`, `file-tree-node`, `pixel-resize-divider` |
| [editor-explorer-open-folder.html](editor-explorer-open-folder.html) | `/editor` — Explorer before any folder is connected | + `explorer-panel` open-folder branch |
| [editor-explorer-reconnect.html](editor-explorer-reconnect.html) | `/editor` — restored handle needs a permission re-grant | + `explorer-panel` reconnect branch |
| [editor-disk-save-error.html](editor-disk-save-error.html) | `/editor` — disk write failed, fixed error toast | + `error-banner` as `.editor-page__disk-save-error` |
| [components.html](components.html) | Style guide: color tokens + every atom/molecule with states | all shared components |
| [index.html](index.html) | Gallery of the above (25% live previews) | — |

### Documents virtual folder tree

The Documents panel organizes database-persisted documents into *virtual
folders* — rows in the database, not directories on disk — with full
create/read/update/delete for both documents and folders (the three
`editor-documents-tree*` mocks above). Key design facts (details in each
page's header comment):

- **Data model:** a `Folders` table (`id`, `name`, `parentFolderId`
  nullable) and a nullable `folderId` on `PlantUmlDocument`; root = null.
  The tree is assembled client-side from two flat lists (`GET /api/folders`
  + `GET /api/documents`) — no tree endpoint. Deleting a folder cascades to
  everything inside it (`DELETE /api/folders/{id}`).
- **Shared visual language:** the tree rows come from
  `DocumentTreeNodeComponent`, which shares one tree-row style source with
  the Explorer's `FileTreeNodeComponent`
  (`frontend/src/app/shared/styles/_tree-row.scss`); the mock stylesheet
  groups the two blocks' selectors the same way. Sorting matches the
  Explorer: folders first, then documents, case-insensitive.
- **Native dialogs, as everywhere else:** create/rename use
  `window.prompt`, deletes use `window.confirm` (deleting a folder warns it
  deletes the contents too), so those flows are described in header
  comments rather than mocked as pages.
- **Single-line document rows:** the raw ISO-8601 `updatedAt` string lives
  in the row's `title` tooltip rather than a visible second line.
- A document's folder is chosen at first save only (the save dialog's
  select); documents cannot be moved, and `PUT /api/documents/{id}`
  structurally has no folder field.

The previous flat-list Documents panel mock and the `/documents` route's
page mocks were removed when this shipped: the panel is now always the
tree, and the routed page no longer exists in the app.

## Component map

Where each piece of mock markup comes from (paths relative to
`frontend/src/app`):

- `app.component.*`, `app.routes.ts` — shell and the `/editor` and
  `/editor/:documentId` routes.
- `features/editor/editor-page/` — overall layout: 48px rail, optional side
  panel (170–500px, default 260px), editor pane (ratio 0.2–0.8, default
  0.5), preview pane; owns the save dialog and disk-save error toast.
- `features/editor/editor-toolbar/` — VS Code-style vertical activity rail:
  Explorer (only in browsers with the File System Access API), New, Save,
  Upload (hidden file input), Templates, Documents; connection dot pinned
  to the bottom.
- `shared/components/rail-button/` (+ `rail-icons.ts`) — 40×40 icon buttons,
  hand-authored outline icons, hover/focus tooltip, active accent bar.
- `features/templates/template-picker/` — pop-out catalog panel.
- `features/editor/monaco-editor/` — Monaco wrapper (facsimile in mocks).
- `features/editor/diagram-preview/` — placeholder / error / SVG / spinner
  states keyed by `data-render-seq`.
- `features/editor/resize-divider/`, `pixel-resize-divider/` — 1px seams
  with 9px grab areas and ARIA separator semantics.
- `features/editor/save-dialog/` — modal name prompt.
- `features/documents/…` — Documents side panel and its recursive folder-tree rows.
- `features/explorer/…` — explorer panel states and recursive tree nodes.
- `shared/components/…` — connection-status, error-banner, loading-spinner.
- `styles.scss` — global font stack, `#111827` text, border-box sizing.

## Regenerating / editing

The mocks are checked in as plain files; edit them directly. If you change
shared chrome (the rail, pane layout), keep the pages in sync — every editor
mock repeats that structure by design, exactly like the real DOM does.
