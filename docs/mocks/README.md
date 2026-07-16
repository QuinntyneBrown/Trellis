# Frontend HTML mocks

Static HTML mocks reverse-engineered from the Angular frontend under
`frontend/src/app`, as plain HTML/CSS — no build step, no JavaScript, no
network. They currently cover the Diagram Wizard's screens and states; the
older pages covering the rest of the app were deleted once they documented a
retired shell (see Fidelity below).

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
- **Same styles.** One hand-compiled stylesheet,
  [`assets/mock-dark.css`](assets/mock-dark.css), annotated block by block
  with the SCSS file it came from; colors, sizes, and hover/active/focus
  states are copied verbatim, so hovering rail icons shows the real
  tooltips, tree rows and buttons show the real hover fills, etc. It is
  compiled from today's SCSS, which consumes the dark `--tds-*` tokens; the
  sheet inlines those tokens verbatim from `frontend/src/styles/tokens.scss`,
  and `var(--tds-*)` references are preserved exactly as the components write
  them. Every page here links it.

  There used to be a second, light stylesheet serving fourteen `editor-*`
  pages. Those pages and that sheet were **deleted**: they documented a shell
  the app has retired. Since they were cut, the theme went dark, New/Save/Upload
  moved off the rail into the hamburger's File menu, the title bar's menus/logo
  were replaced by a copy-contents button, `pixel-resize-divider` was folded
  into one `resize-divider` component, and per-row tree actions moved into a
  right-click context menu — so rather than mislead, they were removed. Those
  screens are unmocked until someone re-cuts them against the current shell.
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
  14px/19px) in the app's `vs-dark` theme (gutter `#6e7681` on `#1f1f1f`).
- **The rendered diagram.** A hand-drawn SVG imitating what the vendored
  PlantUML 1.2026.6 outputs for a starter template (modern default style:
  `#E2E2F0` shapes, `#181818` lines; C4 renders use the C4-PlantUML
  palette). This art **stays light**: the app deliberately keeps the
  rendered plate white
  (`.diagram-preview__svg { background-color: #ffffff }`) even on the dark
  pane, so exported diagrams keep the background they'll have outside
  Trellis. It reads as a white plate with the rounded corners and drop
  shadow the real app gives it.


Static mocks can't capture behavior: pane dragging, keyboard shortcuts
(Ctrl+Enter render, Ctrl+S save), the SignalR connection lifecycle, native
`window.confirm`/`window.prompt` flows (delete/rename), and the browser's
directory/file pickers are described in the page header comments instead.

## Inventory

| Mock | Route / state | Primary components |
| --- | --- | --- |
| [editor-wizard-choose-type.html](editor-wizard-choose-type.html) | `/editor` — Diagram Wizard step 1: choose C4 Model or Sequence Diagram | `editor-page`, `editor-toolbar`, `rail-button`, `wizard-panel`, `monaco-editor`, `diagram-preview`, `connection-status` |
| [editor-wizard-c4-type.html](editor-wizard-c4-type.html) | `/editor` — wizard step 2 (C4): five C4 types, Container selected, skeleton seeded | + `wizard-panel` |
| [editor-wizard-c4-elements-empty.html](editor-wizard-c4-elements-empty.html) | `/editor` — wizard step 3 (C4): pristine element form, empty list, Next disabled | + `wizard-panel` |
| [editor-wizard-c4-elements.html](editor-wizard-c4-elements.html) | `/editor` — wizard step 3 (C4): five elements added and rendered | + `wizard-panel`, `tree-action-button` |
| [editor-wizard-c4-relationships.html](editor-wizard-c4-relationships.html) | `/editor` — wizard step 4 (C4): three relationships added, full diagram rendered | + `wizard-panel`, `tree-action-button` |
| [editor-wizard-c4-finish.html](editor-wizard-c4-finish.html) | `/editor` — wizard C4 track complete: summary, restart/close | + `wizard-panel` |
| [editor-wizard-sequence-participants.html](editor-wizard-sequence-participants.html) | `/editor` — wizard step 2 (sequence): four participants added and rendered | + `wizard-panel`, `tree-action-button` |
| [editor-wizard-sequence-messages.html](editor-wizard-sequence-messages.html) | `/editor` — wizard step 3 (sequence): six messages, sequence-starter-equivalent diagram rendered | + `wizard-panel`, `tree-action-button` |
| [editor-wizard-sequence-finish.html](editor-wizard-sequence-finish.html) | `/editor` — wizard sequence track complete: summary, restart/close | + `wizard-panel` |
| [index.html](index.html) | Gallery of the above (25% live previews) | — |

### Diagram Wizard

The nine `editor-wizard-*` pages mock the **shipped** Diagram Wizard,
which lives at `frontend/src/app/features/wizard/wizard-panel/`. It is the
fifth exclusive docked side panel (opened by the "Diagram Wizard" rail
icon, a magic wand in `rail-icons.ts`) and builds a diagram through guided
steps. Key design facts:

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
- **The sequence track outgrew these mocks.** The participants step now
  also takes an optional diagram title, an optional per-participant color
  (`actor Customer #EEE`), and nestable participant boxes
  (`box "Shop" #LightBlue … end box`; nesting is why generated sequence
  documents open with `!pragma teoz true` — the classic engine cannot draw
  a box inside a box — plus the `skinparam defaultFontSize 10` house
  style). The messages step became a uniform **step list**: messages,
  `== section ==` dividers, group markers (`alt`/`opt`/`loop`/`group`,
  `else`, `end` — inserted flat, indentation computed, unbalanced markers
  repaired at emission) and manual `activate`/`deactivate` steps. Rows
  drag to reorder (native HTML5 DnD, the Documents tree's idiom),
  multi-select with Ctrl/Shift click, and carry a right-click
  `tree-context-menu` with **Reverse as replies** (unwinds the selected
  calls as dashed replies) and **Delete**. An **Automatic lifelines**
  toggle (default on) marks calls/replies with `++`/`--` from a call-stack
  simulation that never emits an unmatched `--`. The
  `editor-wizard-sequence-*` mocks predate all of this and show only the
  original participants/messages forms.
- **Content is a superset of the seeded starters.** The C4 track rebuilds
  the "C4 - Container" starter and the sequence track the "Sequence
  Diagram" starter (both seeded by the `AddTemplates` migration), so
  generated C4 code opens with the real `!define RELATIVE_INCLUDE` /
  `!include C4_Container.puml` idiom, while a generated sequence diagram
  is the starter's shape plus the teoz preamble and activation marks.
  Mid-flow facsimiles (C4 elements without relationships, participants
  without messages) keep final element positions for step-to-step
  continuity — a real render would pack unlinked elements differently.
- **Ids and aliases are auto-derived — one deliberate deviation from these
  mocks.** The mocked forms carry no Id/Alias field, and the ids and aliases
  they show (`shop`, `web`, `api`, `db`; aliases `Web`, `Orders`, `DB`) are
  the seeded starters' hand-picked ones, which are not derivable from the
  names. The shipped wizard therefore **auto-derives** element ids and
  participant aliases as deterministic slugs from the name ("Web
  Application" → `webApplication`, "Order Service" → `orderService`),
  de-duplicated with a numeric suffix. So the generated document is
  *structurally* equivalent to the seeded starter, **not byte-identical**,
  and the literal ids in these mocks are illustrative.
- **Current shell.** These pages mirror the app as it is today and are
  therefore **dark** (they link `assets/mock-dark.css`; see Fidelity
  above): empty title-bar left region, copy-contents button in the
  title-bar center, page-owned upload input, the hamburger-first rail
  (Application Menu, Explorer, Templates, Documents, Explain This) plus the
  wizard toggle last, one `resize-divider` class for both seams, and the
  preview's hover-revealed copy/download chip.
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
  Trellis", or the open disk file's name), layout
  toggles (the primary-sidebar toggle is functional and fills while a side
  panel is open), Windows-convention window controls (close hovers
  `#c42b1c`). Menus, command center, panel/secondary toggles, and window
  controls are static chrome in this first pass.
- `features/editor/editor-toolbar/` — VS Code-style vertical activity rail:
  Application Menu (hamburger, whose File submenu holds New/Save/Upload),
  Explorer (only in browsers with the File System Access API), Templates,
  Documents, Explain This, Diagram Wizard; connection dot pinned to the
  bottom.
- `shared/components/rail-button/` (+ `rail-icons.ts`) — 40×40 icon buttons,
  hand-authored outline icons, hover/focus tooltip, active accent bar.
- `shared/components/tree-action-button/` (+ `tree-action-icons.ts`) —
  compact 1.4rem icon-only row actions shared by both trees and the
  Documents panel header; `label` feeds both the native `title` tooltip and
  `aria-label`.
- `features/documents/move-document-dialog/` — "Move to Folder…" modal,
  visually mirroring the save dialog; destination select reuses the shared
  `folder-options.ts` flattening.
- `features/templates/templates-panel/` — the Templates side panel.
- `features/editor/monaco-editor/` — Monaco wrapper (facsimile in mocks).
- `features/editor/diagram-preview/` — placeholder / error / SVG / spinner
  states keyed by `data-render-seq`.
- `features/editor/resize-divider/` — 1px seams with 9px grab areas and
  ARIA separator semantics; one component for both the panel and pane seams.
- `features/editor/save-dialog/` — modal name prompt.
- `features/documents/…` — Documents side panel and its recursive folder-tree rows.
- `features/explorer/…` — explorer panel states and recursive tree nodes.
- `features/wizard/wizard-panel/` — the Diagram Wizard side panel
  (`editor-wizard-*` pages): a standalone component hosted by `editor-page`
  as the fifth exclusive side panel, toggled by the `wizard` rail icon
  (`data-testid="wizard-panel-toggle"`) and persisted through
  `EditorLayoutPreferencesService` like the others (see the annotated block
  at the end of `mock-dark.css`).
- `shared/components/…` — connection-status, error-banner, loading-spinner.
- `styles.scss` — global font stack, border-box sizing, and the ink and
  background that make an otherwise unstyled page dark (`var(--tds-ink)` on
  `var(--tds-surface-editor)`); `styles/tokens.scss` defines those tokens.

## Regenerating / editing

The mocks are checked in as plain files; edit them directly. If you change
shared chrome (the rail, pane layout), keep the pages in sync — every editor
mock repeats that structure by design, exactly like the real DOM does.
