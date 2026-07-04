# Trellis Code Audit — Design, Quality, and Complexity

**Date:** 2026-07-01
**Scope:** Entire working tree (`backend/`, `frontend/`, `e2e/`), including the uncommitted explorer create/delete changes in progress at audit time.
**Goal:** Find where the code is more complex than the problem it solves, with the owner's stated target of *radically simple implementations of every feature*.

## How this audit was produced

Seven parallel auditors each read every file in an assigned area (backend architecture, backend implementation, frontend core, editor feature, explorer/documents features, test suites, and a cross-cutting duplication/dead-code sweep). Their 51 raw findings were deduplicated to 43, and **every finding was then independently and adversarially verified** by an agent instructed to refute it against the actual code. All 43 survived: 28 were confirmed as stated, 15 were confirmed with corrections to the proposed fix (marked PARTIAL — the corrected proposal is what appears in these documents). Zero findings were rejected.

## Documents

| Document | Contents |
|---|---|
| [backend.md](backend.md) | The Clean Architecture/CQRS ceremony problem, backend dead code, and one real defect in the render pipeline |
| [frontend.md](frontend.md) | Duplicated components, dead UI surface, silent error handling gaps, and unnecessary abstractions |
| [tests.md](tests.md) | Duplicated test scaffolding, tests of language semantics, and one flaky-pattern e2e test |
| [design-ux.html](design-ux.html) | Design & UX audit (2026-07-04, separate effort): heuristic findings with screenshot evidence, plus product ideas and a roadmap for managing designs in a software shop |

## Headline verdict

Trellis is a **small app wearing a big app's clothes in exactly one place: the backend**. Most individual files across the repo are genuinely well written — the audit found far more discipline than sloppiness. The complexity problem is structural, not local:

1. **The backend's Clean Architecture + MediatR CQRS machinery is the single largest source of unjustified complexity.** The Application layer is 1,094 lines across 38 files containing roughly 120 lines of real business logic (~11%). Every operation on the app's *single entity* costs a command/query record + handler + validator + two test files, for 6–12 lines of actual work. Two entire vertical slices (templates, rendering) are pure pass-throughs wrapping one-line calls.
2. **The frontend's biggest problems are two wholesale copies:** a pixel-based resize divider that duplicates the ratio-based one across five files (~460 lines, with mirrored spec and e2e POM copies adding ~480 more), and a routed documents list page that is unreachable from the UI and duplicates the documents panel.
3. **Five genuine quality defects** hide among the complexity findings: a render-timeout gap that can permanently leak backend render slots, HTTP save/upload/open failures silently swallowed in the editor, a render-error signal no UI ever reads, an accent-folding name check that wrongly rejects valid file names, and a fixed-sleep e2e assertion.

**Estimated net reduction if the recommendations are applied: roughly 2,000–2,500 lines (~15–18% of the repo), two NuGet dependencies, and ~30 files** — with behavior pinned throughout by the existing integration and e2e suites.

## Priority roadmap

Ordered by leverage (impact ÷ risk). Items 1–3 are structural; the rest are an afternoon each.

| # | Action | Area | Est. LOC | Risk |
|---|--------|------|---------:|------|
| 1 | Collapse the backend to controllers + services: drop MediatR and FluentValidation, delete the command/handler/validator triples, inject `ApplicationDbContext`/`IPlantUmlRenderer`/`ITemplateCatalog` directly ([B1](backend.md#b1)) | backend | ~1,000 | Medium — integration tests already pin every endpoint |
| 2 | Merge the two resize dividers into one parameterized component; delete the mirrored spec and merge the twin e2e POMs ([F1](frontend.md#f1), [T1](tests.md#t1)) | frontend | ~680 | Medium — merge pixel-mode spec cases first |
| 3 | Delete the unreachable `/documents` list page ([F2](frontend.md#f2)) | frontend | ~190 | Low |
| 4 | Fix the render-timeout/cancellation gap in `PlantUmlRenderer` + pass `Context.ConnectionAborted` from the hub ([B2](backend.md#b2)) | backend | ~0 | Low — it's a defect fix |
| 5 | Surface HTTP save/upload/open failures via the existing error banner ([F4](frontend.md#f4)) | frontend | +15 | Low |
| 6 | Route hub connection failures into `renderResult` instead of the never-read `renderError` signal ([F3](frontend.md#f3)) | frontend | ~25 | Low |
| 7 | Delete the `GetTemplateByKey` slice and endpoint (dead product surface) ([B4](backend.md#b4)) | backend | ~200 | Low |
| 8 | Let the editor page own document loading; delete the resolver + custom `RouteReuseStrategy` ([F5](frontend.md#f5)) | frontend | ~100 | Medium |
| 9 | Extract the explorer e2e boot ritual into one helper ([T2](tests.md#t2)) | e2e | ~80 | Low |
| 10 | Sweep of small deletions: dead `clearRootHandle`, unreachable Monaco loader branch, single-interface model files, twin create-file/folder event pipeline, change-detection workaround, pass-through wrappers ([F6–F15](frontend.md), [B5–B9](backend.md)) | both | ~300 | Low |

Note: if item 1 is done, the backend sub-findings B3–B9 mostly come along for free — their LOC estimates overlap and should not be summed.

## What is already radically simple — do not touch

The audit explicitly catalogued what earns its keep, so a simplification pass doesn't destroy justified complexity:

- **`PlantUmlRenderer` process discipline** — readers started before the stdin write (pipe-deadlock avoidance), semaphore-bounded JVM concurrency, process-tree kill on timeout, and the non-zero-exit-overrides-emitted-SVG rule (PlantUML emits a "Syntax Error?" *picture* on failure). Every line is justified. (The timeout *scope* has a defect — see [B2](backend.md#b2) — but the mechanism is right.)
- **`PlantUmlHub`** — request/response over SignalR's own invocation correlation instead of `IHubContext` push machinery. The simplest possible live-preview transport.
- **The backend test suite** — near-zero ceremony; handler tests run against real in-memory SQLite; `CustomWebApplicationFactory` + `FakePlantUmlRenderer` (72 lines total) let CI run without a JVM. It should be the template for everything else.
- **The e2e suite's foundations** — `data-testid`-only selectors, thin genuinely-reused POMs, and `opfs-fixture.ts`, a clever 190-line patch of `showDirectoryPicker` onto OPFS so the real File System Access code path runs end-to-end and tests verify *actual disk contents*.
- **Frontend core services** — `DocumentsService` (46 lines) and `TemplatesService` (18 lines) are direct `HttpClient` calls with typed DTOs; `DiagramHubService` is 72 lines using signals with no RxJS bridge; no facades, no NgRx, no barrel files anywhere.
- **The explorer's container/presentational split** — all File System Access I/O centralized in `ExplorerPanelComponent`; `FileTreeNodeComponent` is a dumb recursive renderer with zero injected services. `isSameEntry()` instead of `===` for handle comparison is a real correctness necessity with a dedicated test.
- **The `window.prompt`/`window.confirm` convention** for rename/delete/new-file/new-folder — near-zero dialog code, applied consistently.
- **`monaco-editor.component.ts`** (81 lines) — a direct wrapper around the raw `monaco` package with no third-party wrapper dependency.
- **Domain layer restraint** — no repositories, no domain events, no value objects, no AutoMapper; hand-authored SVG icon paths in `rail-icons.ts` (42 lines) instead of an icon-library dependency.

## A note on comments

Several files carry 40–50% narrative comment density (`editor-page.component.ts`, `file-system-access.service.ts`, the explorer components). Most of this is *documentation, not complexity* — but a subset encodes cross-file invariants in prose that no tooling enforces (z-index relationships, sorting conventions, "mirrors X exactly" claims), and those will silently rot. Where a comment states an invariant, prefer a shared constant/helper that makes it checkable; see [F14](frontend.md#f14). Three comments encode genuine correctness constraints and must survive any cleanup: the File System Access user-gesture/permission constraints, the `isSameEntry()` rationale, and (until it is removed per [F9](frontend.md#f9)) the mutate-in-place signal rationale.
