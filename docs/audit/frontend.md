# Frontend Audit — Angular app (`frontend/src/app`)

Back to [audit overview](README.md).

**Shape today:** standalone components around one orchestrator page (`editor-page.component.ts`, 428 lines), a small core layer (two thin HTTP services, a SignalR wrapper exposing signals, a Monaco AMD loader, a localStorage preferences service, a File System Access wrapper with IndexedDB handle persistence, one resolver, one custom global `RouteReuseStrategy`), and feature folders for editor / explorer / documents / templates plus four tiny shared components. There is no gratuitous layering — no facades, no NgRx, no barrel files.

**Overall:** per-component structure is mostly lean and idiomatic. The real excess is duplication (two wholesale component copies), one unreachable page, a routing design with three coordinating mechanisms, and a handful of silent error paths. Comment density is unusually high (40–50% in the core files) — documentation rather than complexity, but see F14.

Severity legend: **CONFIRMED** = evidence and fix verified as stated; **PARTIAL** = real issue, fix corrected by the verifier (the corrected version appears below).

---

## F1. `pixel-resize-divider` is a wholesale copy of `resize-divider` across five files <a name="f1"></a>

**Severity: HIGH · duplication · PARTIAL (fix refined) · ~430 LOC (+~480 more in specs/POMs, see [T1](tests.md#t1))**
Files: `features/editor/resize-divider/*`, `features/editor/pixel-resize-divider/*`

The two components (154 vs 153 lines) are line-for-line identical in structure: same pointer handlers, same `isDragging` signal, same `setPointerCapture` and body-class logic, same nudge/dblclick/aria getters. Templates and SCSS are identical except class names (the pixel SCSS even says "See resize-divider.component.scss for why..."). `clamp-width.ts` and `clamp-ratio.ts` are the same one-line clamp — `clamp-width.ts` spends 9 comment lines justifying its own duplication. The only behavioral difference is one method (ratio divides the pointer delta by parent width; pixel doesn't) plus step/default/aria-label — all data, not structure.

**Recommendation (verifier-refined).** One `ResizeDividerComponent` with inputs `value/min/max/step/resetValue/ariaLabel` plus:
- `scaleToContainerWidth: boolean` — when true, divide pointer delta by parent width, keeping the existing `containerWidth > 0` guard (delta = 0 when unmeasurable).
- ARIA derived from that flag: `Math.round(value * 100)` (percent) when scaled, `Math.round(value)` (raw px) otherwise.
- `testId` input bound via `[attr.data-testid]` so `editor-page.component.html` keeps passing `'resize-divider'` / `'pixel-resize-divider'` and the e2e POMs stay untouched.
- Outputs collapse to `valueChange` + `resizeEnd`. Delete the entire `pixel-resize-divider` directory; keep one clamp helper.

**Apply-safely:** merge the pixel spec's px-specific assertions (raw aria values, 16px step, dblclick reset to `DEFAULT_SIDE_PANEL_WIDTH_PX`, px clamping) into the single spec *before* deleting the mirrored 231-line spec file. Preserve exactly: pointercancel does not emit `resizeEnd`; `releasePointerCapture` in try/catch; `is-resizing-panes` body class; the `@if` around the pixel divider in the template.

## F2. `DocumentsListPageComponent` is an unreachable duplicate of `DocumentsPanelComponent` <a name="f2"></a>

**Severity: HIGH · duplication + dead-code · CONFIRMED · ~190 LOC**
Files: `features/documents/documents-list-page/*`, `app.routes.ts:15`

Two complete implementations of "list all saved documents with open/rename/delete" exist: the slide-out panel used in the editor, and a routed page at `/documents`. Their `onDelete` and `onRename` methods are byte-for-byte identical. **Nothing links to the page** — zero `routerLink` or `router.navigate(['/documents'])` usages repo-wide; e2e exercises only the panel. It is reachable solely by hand-typing the URL.

**Recommendation.** Delete the directory and route entry. Also remove the import in `app.routes.ts:4` and fix the stale JSDoc on `DocumentsPanelComponent` (lines 9–13) claiming the panel "complements (rather than replaces) the dedicated documents list page". If a deep-linkable list is ever wanted, that's the moment to add it back.

## F3. `DiagramHubService.renderError` is written but never read — connection failures are invisible <a name="f3"></a>

**Severity: MEDIUM · quality-defect · PARTIAL (fix refined) · ~25 LOC**
Files: `core/services/diagram-hub.service.ts:25,67`

`render()` catches `invoke()` rejections into a `renderError` signal that **no component or template reads** (grep-verified). When the hub call fails, `isRendering` flips off and the preview keeps showing the stale previous diagram with no message — while the separate channel contradicts the render-seq contract it claims to protect.

**Recommendation (verifier-refined).** Delete `renderError`; in the catch, set `renderResult` to `{ isSuccess: false, svg: null, errorMessage: error instanceof Error ? error.message : 'Failed to reach the render service.' }`. The preview already renders `isSuccess: false` results — the failure becomes visible with zero new UI. Rewrite (don't delete) the spec at `diagram-hub.service.spec.ts:87-95`; remove the `renderError` mock entries in `editor-page.component.spec.ts:36,73`. Intended behavior change: a transient connection blip now shows the error banner instead of silently keeping the stale SVG.

## F4. HTTP save/upload/open failures are silently swallowed <a name="f4"></a>

**Severity: MEDIUM · quality-defect · PARTIAL (fix refined) · +12–15 LOC (a fix, not a deletion)**
Files: `editor-page.component.ts:272,325,366`

`performSave`, the upload subscribe, and `onDocumentOpenedFromPanel` have no error callbacks: a failed save leaves the dialog open forever with zero feedback; a failed panel-open has *already* rewritten the URL via `location.go` to a document that never loaded. Meanwhile disk saves got a dedicated `diskSaveError` signal + error banner — the machinery exists but only covers the rare path.

**Recommendation (verifier-refined).** Rename `diskSaveError` → `saveError` (update template binding, CSS class, and the spec at `editor-page.component.spec.ts:690-700`). Clear it before each attempt; add `error:` callbacks to all three subscribes. In `onDocumentOpenedFromPanel`, move `location.go` inside the `next` callback so a failed open never rewrites the URL. In `onFileSelected`, respect the existing `uploadSequence` guard in the error callback.

## F5. Three overlapping mechanisms coordinate document loading and URL sync <a name="f5"></a>

**Severity: MEDIUM · over-engineering · CONFIRMED · ~100 LOC**
Files: `core/routing/editor-route-reuse-strategy.ts`, `core/resolvers/document.resolver.ts`, `editor-page.component.ts:121-129, 284, 357-368`

Document identity flows through three channels that each carry long comments explaining why they bypass the others: (1) a route resolver fetches on deep-link; (2) a custom **app-wide** `RouteReuseStrategy` keeps the component alive across `editor` ↔ `editor/:id` navigations, which forces `ngOnInit` to *subscribe* to `route.data` instead of reading a snapshot; (3) five call sites use `location.go()` specifically to dodge the Router, and panel-open manually re-fetches because `onSameUrlNavigation` would no-op. The reuse strategy is a global behavior change keyed on component equality — any two routes sharing a component now silently reuse instances, a whole-app side effect installed for one editor concern.

**Recommendation.** Pick one owner: the component. Delete the resolver (+spec) and reuse strategy (+provider); subscribe to `route.paramMap` with `switchMap → getById` (redirect on 404, surface other errors via the existing banner). Keep `location.go` for in-app URL reflection, which the page already uses everywhere else. Trade-offs verified: deep-links show a brief blank editor before content arrives; back/forward across the `editor` ↔ `editor/:id` boundary recreates the component (loses open side panel and Monaco undo stack — no test covers this today). Rewrite the `route.data` stubs in `editor-page.component.spec.ts:146-184` to `paramMap` stubs.

## F6. Rename is a GET-then-PUT pipeline duplicated verbatim in two components <a name="f6"></a>

**Severity: MEDIUM · duplication · CONFIRMED · ~15 LOC**
Because `UpdateDocumentRequest` requires both name and content, renaming forces `getById(...).pipe(switchMap(full => update(...)))` — identical in `documents-panel` and `documents-list-page`. Components shouldn't know that rename means "fetch the whole document and echo its content back" (which also has a lost-update hazard). Add `DocumentsService.rename(id, newName)` hiding the choreography (or better, a name-only backend update). F2 deletes one of the two copies anyway. The spec that asserts the GET-then-PUT choreography (`documents-list-page.component.spec.ts:66`) must be rewritten against `rename()`.

## F7. `createFile`/`createFolder` are twin event pipelines when a `kind` field already discriminates them <a name="f7"></a>

**Severity: MEDIUM · duplication · CONFIRMED · ~25 LOC**
Files: `file-tree-node.component.ts:48,73`, `file-tree-node.component.html:74`, `explorer-panel.component.ts:160`, `create-entry-event.model.ts`

New File and New Folder travel through two parallel everythings — two `@Output`s, two near-identical prompt handlers, two re-emit bindings *at every recursion level*, two panel bindings, two panel handlers — both of which immediately funnel into the same `createEntry(parent, name, kind)`. The discriminator the whole pipeline needs already exists at the bottom. Put `kind: 'file' | 'directory'` into `CreateEntryEvent` and collapse to one output/handler/binding. Keep the two distinct prompt strings, both buttons and their data-testids (so the e2e POM is untouched), and `event.stopPropagation()`. Do **not** unify the service-level `createFile`/`createDirectory` — that split mirrors the real File System Access API.

## F8. Custom-equality signal + re-set-same-reference is a change-detection workaround the app doesn't need <a name="f8"></a>

**Severity: MEDIUM · over-engineering · CONFIRMED · ~12 LOC**
Files: `explorer-panel.component.ts:55,153,191,202`

`rootNode` is `signal(..., { equal: () => false })` with `this.rootNode.set(this.rootNode())` in three places to force notification after in-place mutation. But the app runs zone.js default change detection everywhere (no zoneless provider, no OnPush) — bindings like `node.expanded` re-check after every event regardless. It is the single most confusing mechanism in the panel, solving a problem the codebase doesn't have. Replace with a plain field; mutate in place as today. **Care point:** this hard-couples the tree to zone.js CD — a future OnPush/zoneless migration must reintroduce signals or immutable updates. ~15 spec usages need mechanical conversion.

## F9–F15. Low-severity confirmed cleanups <a name="f9"></a>

| # | Finding | LOC | Notes |
|---|---------|----:|-------|
| F9 <a name="f9b"></a> | **Upload reads the file twice** — local `FileReader` + server response, with an `uploadSequence` token to arbitrate the race it created (`editor-page.component.ts:311-332,421-428`) | ~20 | Delete the local read; **keep** the sequence token as a one-check guard on the upload subscription (back-to-back uploads can still complete out of order). Update the "applies its text immediately" unit test. |
| F10 | **Pass-through handler methods** — six toolbar methods that only re-emit; editor-page mirrors (`editor-toolbar.component.ts:37-68`) | ~35 | Bind directly in templates: `(clicked)="save.emit()"`, `(confirm)="performSave($event)"` (make it non-private). 6 spec call sites update. |
| F11 | **Layout defaults duplicated** — service redefines `DEFAULT_EDITOR_PANE_RATIO = 0.5` / `260` locally instead of importing the constants the dblclick-reset uses; two-tier validation split across service and page | ~12 | Verifier: make the service dumb storage returning `number \| null` (keep the `Number.isFinite` guard — it stops NaN from hand-edited localStorage); seed at the page with `clampRatio(stored ?? DEFAULT, MIN, MAX)`. Avoids a core→features import. Several service spec tests pin the tier split and need rewriting. |
| F12 | **Accent-folding duplicate-name check wrongly rejects valid names** — `localeCompare(..., { sensitivity: 'base' })` refuses `resume.puml` when `résumé.puml` exists (`explorer-panel.component.ts:222`) | ~12 | Verifier: change to `sensitivity: 'accent'` (case-insensitive, accent-sensitive). Do **not** drop the pre-check (it backs a tested error banner) or switch to exact equality (fails an existing test). Leave the sort comparator alone. |
| F13 | **Three single-interface `.model.ts` files** for component-local event payloads (`create-entry-event`, `delete-entry-event`, `rename-event`) | ~15 | Export each interface from the component that emits it; keep them exported (specs construct the payloads). |
| F14 <a name="f14"></a> | **Prose-encoded invariants** — essay comments on one-liners; cross-file invariants (tooltip z-index vs other files' z-indexes, "matches X's convention exactly") enforced only by comments | ~90 | Trim to non-obvious WHYs; replace cross-file prose with a shared SCSS variable / exported comparator so the invariant is checkable. Three comments encode real correctness constraints and must survive: user-gesture permission rules, `isSameEntry` rationale, and the mutate-in-place rationale (until F8 removes it). |
| F15 | **Dead code sweep** — `clearRootHandle` never called by production code (~30 LOC incl. tests/mocks); `MonacoLoaderService` existing-script branch unreachable (~7 LOC); three `connection-status--*` classes on an sr-only span nothing references (~3 LOC); `TemplateCategory` in its own one-line file + byte-identical `CreateDocumentRequest`/`UpdateDocumentRequest` interfaces (~12 LOC) | ~52 | All grep-verified. For `clearRootHandle`, also remove mock entries in two component specs and update the class JSDoc that enumerates it. |

## F16. Pass-through wrappers in `FileSystemAccessService` and their pass-through tests <a name="f16"></a>

**Severity: LOW · unnecessary-abstraction · PARTIAL (scope corrected) · ~115 LOC**
`createFile`, `createDirectory`, `queryPermission`, `requestPermission` are single-expression delegations to handles the caller already holds; the spec then dedicates ~65 lines to verifying the delegations call their mocks. The service is a legitimate Jest seam for what jsdom lacks (`showDirectoryPicker`, IndexedDB) — but wrapping *handle methods* buys nothing since `explorer-panel` already fabricates fake handles in its spec. Delete the four wrappers and call handle methods directly in `explorer-panel.component.ts` (types compile; `wicg-file-system-access` is in both tsconfigs). **Keep** `pickDirectory`, `listChildren`, `read/writeTextFile`, `removeEntry` (real logic: kind→recursive mapping), and the IndexedDB trio. Budget for the real cost the original finding missed: ~15 mock setup/assertion sites in `explorer-panel.component.spec.ts` pivot from service mocks to handle-method mocks (roughly line-neutral there), and the duplicate-name test's negative assertions re-express against `getFileHandle`/`getDirectoryHandle`.

## F17. Save dialog vs `window.prompt`: two mechanisms for "ask the user for a name" <a name="f17"></a>

**Severity: LOW · unnecessary-abstraction · PARTIAL · ~200 LOC — requires a UX decision first**
Rename, new-file, and new-folder all use native `window.prompt` (a convention the code comments cite approvingly); deletes/discards use `window.confirm`. But first-time save gets a bespoke modal (~208 lines across ts/html/scss/spec) plus its own e2e POM (39 lines) plus `isSaveDialogOpen` state and Ctrl+S guard branches. Replacing it with `window.prompt('Save document as', this.documentName())?.trim()` deletes ~250 lines and unifies the convention — **but** trades away the documented keep-dialog-open-until-save-succeeds behavior, and the modal appears in `docs/mocks` and `docs/architecture.md`, suggesting it may be a deliberate UX choice. Decide intentionally; if the modal stays, accept the inconsistency knowingly. If applied: four e2e specs move to Playwright `dialog` handlers, and the "dialog hidden == save landed" e2e signal must be replaced with URL/document-list waits.

---

## What's good (keep as-is)

- `DocumentsService` (46 lines) and `TemplatesService` (18 lines): direct `HttpClient` calls, zero abstraction. `DiagramHubService`: 72 lines, signals, no RxJS bridge.
- App shell: empty router-outlet host, 15-line config, 7-line main, 5 flat routes. `documentResolver` itself is a clean 33-line functional resolver (its *redundancy* is the issue, not its quality — see F5).
- `monaco-editor.component.ts` (81 lines): direct wrapper, lazy load, focus-scoped Ctrl+Enter. `save-dialog` and `diagram-preview` are minimal; `renderSeq` is a cheap, non-brittle e2e hook.
- The divider *interaction design* (per component): dumb controlled components, Pointer Events with `setPointerCapture`, live-change vs `resizeEnd` persistence split, pointercancel deliberately not persisting. The duplication is the problem, not the design.
- `activeSidePanel` as one shared signal — exclusivity and click-to-collapse from a single `.update()`.
- Explorer container/presentational split; `ExplorerTreeNode`'s `children === undefined` lazy-load convention; the reconnect flow handling the real user-gesture permission constraint with one signal and one button; `isSameEntry()` for handle comparison (dedicated test).
- Shared components are all small and all used: `error-banner` (13-line class), `loading-spinner` (11 lines), `rail-button` + hand-authored `rail-icons.ts` (42 lines replacing an icon-library dependency).
- `window.prompt`/`window.confirm` convention for rename/delete/create.
- `EditorLayoutPreferencesService`'s blanket try/catch around localStorage is the right defensiveness for private-browsing/quota risk.
