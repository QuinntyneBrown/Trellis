# Test Suite Audit — Jest specs, xUnit tests, Playwright e2e

Back to [audit overview](README.md).

**Shape today:** ~3,900 lines of frontend Jest specs, ~1,100 lines of backend xUnit tests (handler tests against real in-memory SQLite, validator spot-checks, `WebApplicationFactory` integration tests), and ~2,200 lines of Playwright e2e with a `data-testid`-driven POM plus an OPFS fixture that fakes `window.showDirectoryPicker`.

**Overall verdict: test quality is high and behavior-focused.** The backend suite is close to exemplary in its leanness; the e2e suite verifies real outcomes (actual disk contents via OPFS, render-sequence counters) rather than UI incidentals; POM classes are thin and genuinely reused. No suite-wide structural over-engineering was found. The problems are localized: literal twin files, a copy-pasted boot ritual, duplicated inline TestBed blocks that have already drifted, and a block of tests that assert JavaScript semantics rather than app behavior. Roughly 450–500 of the frontend suite's ~3,900 lines are literal duplication rather than coverage.

Severity legend: **CONFIRMED** = evidence and fix verified as stated; **PARTIAL** = real issue, fix corrected by the verifier (the corrected version appears below).

---

## T1. Twin resize-divider spec files and twin e2e POM classes <a name="t1"></a>

**Severity: MEDIUM · duplication · PARTIAL (fix refined) · ~250–280 LOC**
Files: `resize-divider.component.spec.ts` (251 lines), `pixel-resize-divider.component.spec.ts` (232 lines), `e2e/pom/components/resize-divider.component.ts`, `e2e/pom/components/pixel-resize-divider.component.ts`

The pixel spec is a test-by-test mirror of the ratio spec — same `fakePointerEvent` helper (its own comment: "Mirrors resize-divider.component.spec.ts's own fakePointerEvent exactly"), same 15 cases with only ratio-vs-pixel arithmetic changed. The two e2e POM classes are byte-for-byte identical except the testid string and docstrings; their only caller is `editor.page.ts`.

**Recommendation.** The root fix is the component merge ([frontend F1](frontend.md#f1)), which deletes one spec outright once its px-specific assertions are merged in. Independently and immediately: merge the two e2e POMs into one `DividerComponent` whose constructor takes the testid (`'resize-divider' | 'pixel-resize-divider'`) — ~50 lines, zero behavior change, two construction sites to update. If the component merge is declined, at minimum move `fakePointerEvent` into a shared test helper; skip fancier shared-suite extractions unless parameterized by a full setup object.

## T2. Every explorer e2e test repeats the same 7-line boot ritual <a name="t2"></a>

**Severity: MEDIUM · duplication · PARTIAL (scope corrected) · ~80 LOC**
Files: `explorer-create-and-delete-entries.spec.ts` (7×), `explorer-browse-and-open-file.spec.ts` (2×), `explorer-save-writes-to-disk.spec.ts` (2×), `explorer-unsaved-changes-guard.spec.ts` (1×, inside its local helper)

`installFakeDirectoryPicker → new EditorPage → goto → waitForAppReady → seedOpfsFixtureTree → explorerPanel.open → explorerPanel.openFolder` is copy-pasted verbatim 12 times across 4 files, and the ordering constraint (install must precede goto; seed must follow goto) is re-learned per file via comments.

**Recommendation (verifier-corrected).** One exported helper in `e2e/utils/opfs-fixture.ts`: `openExplorerWithTree(page, tree): Promise<EditorPage>`, with both ordering rules documented once on it. Replace exactly the 12 occurrences. Do **not** touch `explorer-documents-panel-exclusivity.spec.ts` or `explorer-resize-panel.spec.ts` (they never use the ritual), and do **not** use it in `explorer-auto-reopen.spec.ts` — its regression value depends on the picker *never* being patched. Prefer the plain helper over a `test.extend` fixture (the per-test tree argument makes a fixture clumsier). Keep the per-test regression comments attached to their tests.

## T3. `editor-page.component.spec.ts` duplicates its TestBed provider list inline twice — and the copies have already drifted <a name="t3"></a>

**Severity: MEDIUM · duplication · CONFIRMED · ~45 LOC**
Files: `editor-page.component.spec.ts:299,745,704`

Two clamp tests each re-run `TestBed.resetTestingModule().configureTestingModule({...})` with a hand-copied duplicate of the `beforeEach` 8-provider list, solely because one mock return value must change before construction. **Both copies already silently omit the `MonacoLoaderService` provider** — they only pass because those tests never call `detectChanges()`, a landmine for the next edit. The same file defines the identical `ctrlSEvent` helper twice in two describe blocks.

**Recommendation.** Extract a `providers()` helper built from the same mock variables (restoring `MonacoLoaderService` parity — hoist the `fakeMonaco`/`editorStub` consts it captures) and have both clamp tests use it; hoist `ctrlSEvent` to file scope.

## T4. `file-system-access.service.spec.ts` tests JavaScript semantics, not behavior <a name="t4"></a>

**Severity: LOW · over-engineering · CONFIRMED · ~70 LOC**
Files: `file-system-access.service.spec.ts:16,238,258,285,304`

Three "propagates a rejection rather than swallowing it" tests target single-expression wrappers with no try/catch — they verify that an async function without a catch rejects, i.e. the language, against `jest.fn` mocks. The "forwards an explicit mode" variants re-test one-line argument forwarding twice each. `fakeDirectoryHandle` hand-rolls an 18-line manual async-iterator protocol object where `values: async function* () { ... }` does the same.

**Recommendation.** Keep the tests that encode real decisions: `pickDirectory`'s AbortError→null mapping, `listChildren`'s sort, `writeTextFile`'s finally-close, `removeEntry`'s recursive-only-for-directories mapping, default `'readwrite'` mode, and the IndexedDB round-trip/swallow suite. Delete the three propagates-rejection tests; fold each explicit-mode case into the default-mode test *keeping* an explicit-mode call and assertion (a default-only assertion cannot distinguish a hardcoded `'readwrite'` from a forwarded parameter). Note this overlaps with [frontend F16](frontend.md#f16) — if the wrappers are deleted, their tests go with them.

## T5. Small confirmed/partial spec cleanups <a name="t5"></a>

| # | Finding | LOC | Notes |
|---|---------|----:|-------|
| T5a | `explorer-panel.component.spec.ts` repeats `createFixture(); detectChanges(); await flush(); detectChanges();` in all ~21 tests, plus three 20-line hand-built tree literals (CONFIRMED) | ~60 | Add `bootComponent(configure?)` preserving the pre-construction hook the deferred pattern exists for, and a `treeNode(name, kind, overrides?)` builder. A few tests currently skip the trailing `detectChanges` — run the suite to confirm the uniform boot is assertion-neutral. The builder must keep `handle` overridable (identity assertions exist). |
| T5b | `editor-layout-preferences.service.spec.ts` duplicates its robustness tests per field (PARTIAL) | ~35 | `describe.each` over the two fields for the six shared cases (default-when-unset, exact-blob round-trip, corrupt JSON, non-numeric, setItem-throws, getItem-throws); keep the genuinely field-specific tests separate. Restore mocks in `afterEach` so a broken `Storage.prototype` spy can't leak between parameterized runs. |
| T5c | Constant re-export tests assert wiring, not behavior (`editor-page.component.spec.ts:347,789`) (PARTIAL — **do not simply delete**) | ~10 | The verifier found deletion unsafe: a wrong-constant assignment (e.g. `MIN = MAX`) would pass every remaining test and ship degenerate drag bounds. Either keep them, or better: replace each pair with one test querying the rendered divider and asserting its actual `minRatio`/`maxRatio` inputs — same test count, strictly more coverage. |
| T5d | Fixed 300ms sleep to prove a negative in `explorer-unsaved-changes-guard.spec.ts:46` (PARTIAL) | ~0 | Replace the `page.once` + sleep with `const dialogPromise = page.waitForEvent('dialog')` *before* the row click, `await (await dialogPromise).dismiss()`, then assert the editor content once. The decline path is synchronous after `window.confirm` returns, so no poll is needed — and the test now fails loudly if the confirm guard is removed, which the current version silently tolerates. Once `waitForEvent('dialog')` is pending the dialog MUST be handled on every branch, or subsequent `evaluate` calls hang. |

---

## What's good (keep as-is — and use as the template)

- **Backend suite: exemplary.** `SqliteInMemoryDbContextFactory` (50 lines) and `TestDateTimeProvider` (21 lines) are the only Application-test helpers; handlers are tested against real SQLite semantics with separate seed/act/verify contexts. Validator tests are 2–4 concise spot-checks, not line-by-line restatements of FluentValidation config. `CustomWebApplicationFactory` + `FakePlantUmlRenderer` (72 lines) give full HTTP round-trips with zero ceremony.
- **e2e selectors** are uniformly the stable `data-testid` contract via one shared `byTestId` helper — never CSS classes or text. Not brittle.
- **`opfs-fixture.ts`** (190 lines) patches `showDirectoryPicker` to hand back an OPFS directory so the real File System Access path runs end-to-end with no native dialogs; `readOpfsFile` verifies actual disk writes bypassing the app, with a justified, documented retry for a real OPFS lock race.
- **Monaco POM** reads the buffer through `window.monaco` (documented: Monaco virtualizes DOM lines) and types through the real keyboard; `normalize-eol.ts` documents a real Windows CRLF pitfall.
- **Purpose-built regression coverage**: `explorer-create-and-delete-entries.spec.ts:149-186` pins `FileSystemFileHandle` reference instability across directory refreshes — behavior coverage of a real bug class, failure mode explained in a comment.
- **POM layer earns its keep**: small, single-purpose classes genuinely reused across many specs (`ExplorerPanelComponent` by 7 specs); the layer adds value, not indirection.
- Service specs are lean: `documents.service.spec.ts` uses `HttpTestingController` idiomatically; `diagram-hub.service.spec.ts` stubs only the single `buildConnection()` seam.
