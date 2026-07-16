# Frontend HTML mocks

Static HTML mocks reverse-engineered from the Angular frontend under
`frontend/src/app`. They capture every screen and meaningful UI state of the
app as plain HTML/CSS — no build step, no JavaScript, no network.

## Design system

[`design-system/`](design-system/) is a separate, self-contained product:
the **Trellis Design System** documentation site (tokens, foundations,
components, patterns), heavily inspired by the VS Code design system and
expressed in **dark mode**. That dark token set is no longer a *target*:
the app has adopted it — `frontend/src/styles/tokens.scss` is a verbatim
copy of [`design-system/assets/tokens.css`](design-system/assets/tokens.css)
and every component now consumes those `--tds-*` properties, so the running
app is dark. The design system is published to an Azure Static Web App by
[`.github/workflows/deploy-design-system.yml`](../../.github/workflows/deploy-design-system.yml)
on pushes to `main`; start at
[`design-system/index.html`](design-system/index.html) or its
[README](design-system/README.md).

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
- **Same styles.** Two hand-compiled stylesheets, each annotated block by
  block with the SCSS file it came from; colors, sizes, and
  hover/active/focus states are copied verbatim, so hovering rail icons
  shows the real tooltips, tree rows and buttons show the real hover fills,
  etc. **Which sheet a page links tells you which app it documents:**
  - [`assets/mock-dark.css`](assets/mock-dark.css) — the **current** app.
    Compiled from today's SCSS, which consumes the dark `--tds-*` tokens;
    the sheet inlines those tokens verbatim from
    `frontend/src/styles/tokens.scss`, and `var(--tds-*)` references are
    preserved exactly as the components write them. Linked by the nine
    `editor-wizard-*` pages.
  - [`assets/mock.css`](assets/mock.css) — the **retired light theme**.
    Compiled from an older revision and still accurate to the fourteen
    `editor-*` pages it serves, but no longer to the app: since it was
    written, the theme went dark, New/Save/Upload moved off the rail into
    the hamburger's File menu, the title bar's menus/logo were replaced by
    a copy-contents button, `pixel-resize-divider` was folded into one
    `resize-divider` component, and per-row tree actions moved into a
    right-click context menu. Re-cutting those pages against the current
    shell would move them to the dark sheet and retire this one.
- **Real data shapes.** Template names/categories match the backend's
  static template catalog; document timestamps appear as raw ISO-8601
  strings in each row's `title` tooltip, exactly as
  `DocumentTreeNodeComponent` renders them (there is no date pipe in the
  app); the render error text is what
  `PlantUmlRenderer.BuildFriendlyErrorMessage` forwards from PlantUML's
  stderr; both trees are sorted folders-first, case-insensitive, matching
  `FileSystemAccessService.listChildren()`.

Two things are facsimiles, clearly marked with `mock-only` comments:

- **The Monaco surface.** The app instantiates `monaco-editor` (language
  `plaintext`/`markdown`, minimap off) at runtime; the mocks approximate the
  rendered surface with `.mock-monaco` at the same metrics (Consolas
  14px/19px) in whichever theme the page documents — `vs-dark` on the dark
  sheet (gutter `#6e7681` on `#1f1f1f`), the retired `vs` on the light one
  (gutter `#237893` on `#fffffe`).
- **The rendered diagram.** A hand-drawn SVG imitating what the vendored
  PlantUML 1.2026.6 outputs for a starter template (modern default style:
  `#E2E2F0` shapes, `#181818` lines; C4 renders use the C4-PlantUML
  palette). This art is **the same on both sheets and stays light**: the
  app deliberately keeps the rendered plate white
  (`.diagram-preview__svg { background-color: #ffffff }`) even on the dark
  pane, so exported diagrams keep the background they'll have outside
  Trellis. On the dark pages it reads as a white plate with the rounded
  corners and drop shadow the real app gives it.


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
| [editor-documents-tree.html](editor-documents-tree.html) | `/editor` — Documents side panel docked (260px): virtual folder tree with expanded/collapsed folders, root documents, the active (open) document highlighted, draggable document rows | + `documents-panel`, `document-tree-node`, `tree-action-button`, `resize-divider` |
| [editor-documents-tree-empty.html](editor-documents-tree-empty.html) | `/editor` — Documents panel, no documents or folders yet | + `documents-panel` empty branch |
| [editor-documents-tree-save-dialog.html](editor-documents-tree-save-dialog.html) | `/editor` — save dialog with the destination-folder select | + `save-dialog` folder branch |
| [editor-documents-tree-move-dialog.html](editor-documents-tree-move-dialog.html) | `/editor` — "Move to Folder…" dialog over the docked tree (keyboard fallback to drag-and-drop) | + `move-document-dialog` |
| [editor-explorer-panel.html](editor-explorer-panel.html) | `/editor` — Explorer tree, disk file opened | + `explorer-panel`, `file-tree-node`, `pixel-resize-divider` |
| [editor-explorer-open-folder.html](editor-explorer-open-folder.html) | `/editor` — Explorer before any folder is connected | + `explorer-panel` open-folder branch |
| [editor-explorer-reconnect.html](editor-explorer-reconnect.html) | `/editor` — restored handle needs a permission re-grant | + `explorer-panel` reconnect branch |
| [editor-disk-save-error.html](editor-disk-save-error.html) | `/editor` — disk write failed, fixed error toast | + `error-banner` as `.editor-page__disk-save-error` |
| [editor-wizard-choose-type.html](editor-wizard-choose-type.html) | `/editor` — Diagram Wizard step 1: choose C4 Model or Sequence Diagram (proposed) | + `wizard-panel` (proposed) |
| [editor-wizard-c4-type.html](editor-wizard-c4-type.html) | `/editor` — wizard step 2 (C4): five C4 types, Container selected, skeleton seeded (proposed) | + `wizard-panel` (proposed) |
| [editor-wizard-c4-elements-empty.html](editor-wizard-c4-elements-empty.html) | `/editor` — wizard step 3 (C4): pristine element form, empty list, Next disabled (proposed) | + `wizard-panel` (proposed) |
| [editor-wizard-c4-elements.html](editor-wizard-c4-elements.html) | `/editor` — wizard step 3 (C4): five elements added and rendered (proposed) | + `wizard-panel` (proposed), `tree-action-button` |
| [editor-wizard-c4-relationships.html](editor-wizard-c4-relationships.html) | `/editor` — wizard step 4 (C4): three relationships added, full diagram rendered (proposed) | + `wizard-panel` (proposed), `tree-action-button` |
| [editor-wizard-c4-finish.html](editor-wizard-c4-finish.html) | `/editor` — wizard C4 track complete: summary, restart/close (proposed) | + `wizard-panel` (proposed) |
| [editor-wizard-sequence-participants.html](editor-wizard-sequence-participants.html) | `/editor` — wizard step 2 (sequence): four participants added and rendered (proposed) | + `wizard-panel` (proposed), `tree-action-button` |
| [editor-wizard-sequence-messages.html](editor-wizard-sequence-messages.html) | `/editor` — wizard step 3 (sequence): six messages, sequence-starter equivalent rendered (proposed) | + `wizard-panel` (proposed), `tree-action-button` |
| [editor-wizard-sequence-finish.html](editor-wizard-sequence-finish.html) | `/editor` — wizard sequence track complete: summary, restart/close (proposed) | + `wizard-panel` (proposed) |
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
- **Icon row actions:** every row action (and the panel header's New
  Folder) is a compact `tree-action-button` icon button with a native
  `title` tooltip — one shared component across both trees.
- **Moving documents:** drag a document row onto a folder row (drop-target
  highlight; the tree's empty space is the move-to-root zone) or use the
  row's "Move to Folder…" dialog. The move goes through the dedicated
  `PUT /api/documents/{id}/folder` endpoint (`folderId: null` = root);
  `PUT /api/documents/{id}` itself remains structurally folder-free. The
  destination folder auto-expands after a move.
- **Active document:** the row of the document currently open in the
  editor carries `document-tree-node__row--active` + `aria-current="true"`
  (the VS Code active-file idiom), and the panel stays open when a
  document is opened.

The previous flat-list Documents panel mock and the `/documents` route's
page mocks were removed when this shipped: the panel is now always the
tree, and the routed page no longer exists in the app.

### Diagram Wizard (proposed feature)

The nine `editor-wizard-*` pages are **design mocks for a feature that is
not implemented yet** — there is no `frontend/src/app/features/wizard/`
today. They propose a fifth docked side panel (opened by a new "Diagram
Wizard" rail icon, a magic wand that would join `rail-icons.ts`) that
builds a diagram through guided steps. Key design facts:

- **One-way append model (wizard → diagram).** Every wizard action —
  picking a C4 type, adding an element/participant/relationship/message —
  writes PlantUML into the open editor and immediately re-renders the
  preview. The wizard never parses the editor back, the document stays
  hand-editable throughout, and the wizard only ever appends. Because
  `data-render-seq` counts completed renders (one per append; the first
  render is deferred until the diagram has content), the mocks carry true
  cumulative values: 0 → 5 → 8 across the C4 track, 0 → 4 → 10 across the
  sequence track.
- **Two tracks.** C4: diagram type (all five vendored C4-PlantUML views:
  Context, Container, Component, Dynamic, Deployment) → elements →
  relationships → finish. Sequence: participants → messages → finish. The
  progress pips show a generic Type · Build · Finish trio until a track is
  chosen, then expand to the track's own step count.
- **Content reproduces the seeded starters.** The C4 track rebuilds the
  "C4 - Container" starter and the sequence track the "Sequence Diagram"
  starter (both seeded by the `AddTemplates` migration), so generated C4
  code opens with the real `!define RELATIVE_INCLUDE` / `!include
  C4_Container.puml` idiom and the sequence track's final preview is the
  same known-good facsimile `editor-rendered.html` uses. Mid-flow
  facsimiles (C4 elements without relationships, participants without
  messages) keep final element positions for step-to-step continuity — a
  real render would pack unlinked elements differently.
- **Current shell, newer than the other mocks.** These pages mirror the
  app as it is today and are therefore **dark** (they link
  `assets/mock-dark.css`; see Fidelity above): empty title-bar left region,
  copy-contents button in the title-bar center, page-owned upload input,
  the hamburger-first rail (Application Menu, Explorer, Templates,
  Documents, Explain This) plus the proposed wizard toggle, one
  `resize-divider` class for both seams, and the preview's hover-revealed
  copy/download chip. The older mocks above predate that shell, still
  render light, and intentionally do not carry the wizard icon.
- **Panel anatomy.** `wizard-panel` copies the Explain panel's form-column
  idiom in the shared panel chrome: uppercase header, dot-pip progress
  with caption, hint, option cards (`role="radiogroup"`/`radio`), labeled
  inputs/selects, a primary Add button per step, an "added" divider over
  the running list (rows: kind badge, name, context, mono arrow, and a
  `tree-action-button` remove), and a pinned Back/Next footer that becomes
  Finish on the last build step and Restart/Close when done.

## Component map

Where each piece of mock markup comes from (paths relative to
`frontend/src/app`):

- `app.component.*`, `app.routes.ts` — shell and the `/editor` and
  `/editor/:documentId` routes.
- `features/editor/editor-page/` — overall layout: 35px title bar, then 48px
  rail, optional side panel (170–500px, default 260px), editor pane (ratio
  0.2–0.8, default 0.5), preview pane; owns the save dialog and disk-save
  error toast.
- `features/editor/title-bar/` — VS Code-style top chrome (D-007): app menu,
  command-center pill with the open document's name ("Untitled diagram —
  Trellis", or the open disk file's name on the Explorer pages), layout
  toggles (the primary-sidebar toggle is functional and fills while a side
  panel is open), Windows-convention window controls (close hovers
  `#c42b1c`). Menus, command center, panel/secondary toggles, and window
  controls are static chrome in this first pass.
- `features/editor/editor-toolbar/` — VS Code-style vertical activity rail:
  Explorer (only in browsers with the File System Access API), New, Save,
  Upload (hidden file input), Templates, Documents; connection dot pinned
  to the bottom.
- `shared/components/rail-button/` (+ `rail-icons.ts`) — 40×40 icon buttons,
  hand-authored outline icons, hover/focus tooltip, active accent bar.
- `shared/components/tree-action-button/` (+ `tree-action-icons.ts`) —
  compact 1.4rem icon-only row actions shared by both trees and the
  Documents panel header; `label` feeds both the native `title` tooltip and
  `aria-label`.
- `features/documents/move-document-dialog/` — "Move to Folder…" modal,
  visually mirroring the save dialog; destination select reuses the shared
  `folder-options.ts` flattening.
- `features/templates/template-picker/` — pop-out catalog panel.
- `features/editor/monaco-editor/` — Monaco wrapper (facsimile in mocks).
- `features/editor/diagram-preview/` — placeholder / error / SVG / spinner
  states keyed by `data-render-seq`.
- `features/editor/resize-divider/`, `pixel-resize-divider/` — 1px seams
  with 9px grab areas and ARIA separator semantics.
- `features/editor/save-dialog/` — modal name prompt.
- `features/documents/…` — Documents side panel and its recursive folder-tree rows.
- `features/explorer/…` — explorer panel states and recursive tree nodes.
- `features/wizard/wizard-panel/` — **proposed, not yet implemented**: the
  Diagram Wizard side panel (`editor-wizard-*` pages); its mock styles are
  hand-authored in the Explain panel's idiom against the same tokens, and
  `rail-icons.ts` would gain a `wizard` entry (see the annotated block at
  the end of `mock-dark.css`).
- `shared/components/…` — connection-status, error-banner, loading-spinner.
- `styles.scss` — global font stack, border-box sizing, and the ink and
  background that make an otherwise unstyled page dark (`var(--tds-ink)` on
  `var(--tds-surface-editor)`); `styles/tokens.scss` defines those tokens.

## Regenerating / editing

The mocks are checked in as plain files; edit them directly. If you change
shared chrome (the rail, pane layout), keep the pages in sync — every editor
mock repeats that structure by design, exactly like the real DOM does.
