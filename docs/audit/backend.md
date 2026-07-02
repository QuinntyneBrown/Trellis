# Backend Audit — Trellis.Api / Application / Domain / Infrastructure

Back to [audit overview](README.md).

**Shape today:** a textbook 4-project Clean Architecture (Api / Application / Domain / Infrastructure) with MediatR CQRS. Every one of the 9 operations over the single `PlantUmlDocument` entity is a command/query record + handler + (usually) FluentValidation validator triple, dispatched through two pipeline behaviours (`ValidationBehaviour`, `UnhandledExceptionBehaviour`), behind interface ports (`IApplicationDbContext`, `IPlantUmlRenderer`, `ITemplateCatalog`, `IDateTimeProvider`).

**The numbers:** ~2,224 LOC of source (excluding migrations). The Application layer alone is 1,094 LOC across 38 files containing roughly **120 lines of real business logic (~11%)**. A typical CRUD operation costs 3 source files plus 2 test files for 6–12 lines of logic (`DeleteDocument`: 3 files / 71 lines for 6 lines of work). The genuinely irreducible logic lives almost entirely in `PlantUmlRenderer` (~150 lines) and `TemplateCatalog` (~60 lines). The individual infrastructure pieces are well written; the over-complexity is almost entirely in the dispatch/layering machinery around them, which is sized for a large multi-team system rather than a one-entity CRUD-plus-render app.

Severity legend: findings were adversarially verified; **CONFIRMED** = evidence and fix verified as stated, **PARTIAL** = real issue, fix corrected by the verifier (the corrected version is what appears below).

---

## B1. Collapse the Clean Architecture / CQRS machinery <a name="b1"></a>

**Severity: HIGH · over-engineering · CONFIRMED · ~1,000 LOC**
Files: all of `Trellis.Application`, `Trellis.Api/Common/DependencyInjection.cs`, `DocumentsController.cs`

Every request flows Controller → `ISender.Send` → `UnhandledExceptionBehaviour` → `ValidationBehaviour` → Handler → `IApplicationDbContext` (a pure pass-through registered as `provider.GetRequiredService<ApplicationDbContext>()`). There is exactly one entity, one `DbSet`, no per-request cross-cutting behavior, and no second consumer of the Application layer.

**Recommendation.** Collapse to a single `Trellis.Api` project (Domain entity and Infrastructure classes become folders). Controllers inject `ApplicationDbContext`, `IPlantUmlRenderer`, and `TemplateCatalog` directly and do the 5–12 lines of EF work inline:

- Validation becomes DataAnnotations on Api-layer request records (`[Required]`, `[MaxLength(200)]`) — `[ApiController]` yields the same `ValidationProblemDetails` 400 shape automatically with zero custom code. This also fixes the current binding asymmetry (POST binds the Application-layer `CreateDocumentCommand` directly as the HTTP body while PUT has a dedicated `UpdateDocumentRequestBody`).
- Not-found becomes a null check returning `NotFound()`; `NotFoundException`, `ValidationException`, and both pipeline behaviours are deleted. `CustomExceptionHandler` shrinks to its never-leak-details 500 branch.
- `PlantUmlHub` injects `IPlantUmlRenderer` directly with two inline guards preserving the exact current failure messages (`"PlantUML source must not be empty."`, 100k max length) returned as `PlantUmlRenderResult.Failure(...)` — the same shape the hub already converts `ValidationException` into today.
- Deletes the MediatR and FluentValidation packages, 9 command/query records, 9 handlers, 7 validators, both behaviours, and `IApplicationDbContext`.

**Apply-safely notes** (from verification):
- `Content = ""` is valid today (`NotNull()`, not `NotEmpty()`): use `[Required(AllowEmptyStrings = true)]` or a plain guard, while `Name` must keep rejecting empty (`Create_ReturnsValidationProblem_WhenNameIsMissing` pins this).
- The handler unit tests encode real semantics that must be ported to integration tests, not deleted: `UpdatedAt` set on update and upload-replace but null on create; upload's create-vs-replace branch; `Name` preserved on upload-replace. The `Update_RouteIdWinsOverBody` contract must survive.
- Keep the `IPlantUmlRenderer` seam — `FakePlantUmlRenderer` is what lets integration tests run without a JVM.
- The existing `WebApplicationFactory` integration suite already pins every endpoint's behavior; run it plus e2e after the move.

**Keep regardless of this refactor:** `PlantUmlRenderer`, `CustomExceptionHandler`'s 500 branch, `PlantUmlHub`'s request/response design, the DTO projection in the list query (excludes `Content` from list payloads; documented SQLite `ORDER BY DateTimeOffset` workaround).

The findings below (B3–B9) are subsets or independent slices of this collapse. If B1 is done wholesale, they come along for free; if the CQRS shape is kept, each is worth doing on its own. **Do not sum the LOC estimates.**

---

## B2. Render timeout doesn't cover the stdin write; hub passes `CancellationToken.None` — a stuck JVM permanently leaks a render slot <a name="b2"></a>

**Severity: MEDIUM · quality-defect · PARTIAL (fix corrected) · the one real backend bug**
Files: `Trellis.Infrastructure/PlantUml/PlantUmlRenderer.cs:126-151`, `Trellis.Api/Hubs/PlantUmlHub.cs:37-42`

The timeout CTS is created *after* `Process.Start` and after the stdin `WriteAsync` (which uses only the caller's token — and `PlantUmlHub.RenderDiagram` calls `mediator.Send(command)` with no token, so it is `CancellationToken.None` for every real render). Failure scenario: java launches but hangs before consuming stdin while the source exceeds the OS pipe buffer (~4–64 KB; the validator allows 100 KB) — `WriteAsync` blocks forever and the semaphore slot (max 4) is never released. After four such events, rendering is dead until app restart. Additionally, external cancellation during `WaitForExitAsync` propagates without `TryKillProcessTree`, orphaning the java process.

**Recommendation (verifier-corrected).**
- In `RenderCoreAsync`, create the timeout CTS + linked CTS immediately after `process.Start()` succeeds. Guard the stdin write with `WriteAsync(sourceBytes, linkedCts.Token).AsTask().WaitAsync(linkedCts.Token)` (the outer `WaitAsync` guarantees the timeout path is reached even if pipe-write cancellation isn't honored). Keep closing stdin in `finally`, and keep treating a non-cancellation write failure (broken pipe from an early-exiting java) as non-fatal so the stderr-based friendly-error path still runs.
- Move `TryKillProcessTree` into a `catch (OperationCanceledException)` covering *both* timeout and external cancellation (kill, then: return the timeout `Failure` if `timeoutCts` fired, otherwise rethrow) — this also deletes the `when(...)` filter gymnastics.
- In the hub, do **not** add a `CancellationToken` parameter (net8.0 SignalR only binds synthetic tokens for *streaming* hub methods; on a plain method it becomes a client-bound argument and breaks invocation binding). Pass the existing connection-abort token instead: `await this.mediator.Send(command, this.Context.ConnectionAborted)`.

**Apply-safely notes:** with `ConnectionAborted` flowing, routine client disconnects will surface OCE into the hub's generic catch — filter OCE there so the error-level log doesn't fire for disconnects. An early-exiting java must not be reclassified as a timeout.

---

## B3. Pure pass-through slices: Templates and Rendering wrap one-line calls in eight files <a name="b3"></a>

**Severity: MEDIUM · unnecessary-abstraction · CONFIRMED · ~200 LOC**
Files: `GetTemplatesQueryHandler.cs`, `GetTemplateByKeyQueryHandler.cs`, `RenderDiagramCommandHandler.cs`, `TemplatesController.cs`, `PlantUmlHub.cs`

`GetTemplatesQueryHandler.Handle` is literally `Task.FromResult(this.catalog.GetAll())`; `GetTemplateByKeyQueryHandler` is the same for `GetByKey`; `RenderDiagramCommandHandler` is one `LogDebug` (of a `CorrelationId` that exists only to be logged) plus `await this.renderer.RenderAsync(...)`. Even if MediatR stays for Documents, `TemplatesController` should inject `ITemplateCatalog` and `PlantUmlHub` should inject `IPlantUmlRenderer` directly, with the render length/empty checks as 3 inline guard lines in the hub. Whitespace-only template key changes from 400 to 404 (untested, arguably more correct); keep the two validation message strings verbatim; move the empty/too-long coverage into hub-level tests.

## B4. `GET /api/templates/{key}` is dead product surface <a name="b4"></a>

**Severity: MEDIUM · dead-code · CONFIRMED · ~200 LOC**
Files: the `GetTemplateByKey` slice, `TemplatesController.cs:45-51`, `ITemplateCatalog.GetByKey`, `e2e/tests/template-picker-c4.spec.ts:26`

The frontend only calls `GET /api/templates`, and the list DTO already includes full `Content` — the by-key endpoint returns nothing the client doesn't already have. Its sole consumer is one e2e test that uses it to fetch expected template content. Delete the slice (query/handler/validator, controller action, `TemplateCatalog.GetByKey`, its unit + integration tests) and change the e2e test to fetch the list once and `find(t => t.key === key)`, guarded with `expect(template).toBeDefined()`.

## B5. `TemplateCatalog` manifest machinery for six static templates <a name="b5"></a>

**Severity: MEDIUM · over-engineering · CONFIRMED · ~90 LOC**
Files: `TemplateCatalog.cs`, `TemplateManifestEntry.cs`, `Trellis.Api/Vendor/templates/manifest.json`

Serving 6 fixed starter templates involves a JSON manifest, a 4-property record, `JsonSerializerOptions`, per-entry missing-file skip logic, a lock-guarded double-checked lazy cache, and a test-only constructor — 173 lines across three files for data that changes only when a developer adds a `.puml` file and rebuilds. Hardcode the six `(key, name, category, file)` tuples as a static array and read the files eagerly in the constructor (~35 lines; singleton construction gives thread safety for free). A missing file then fails loudly instead of silently shortening the list. Keep the csproj `Vendor\**` copy globs — only `manifest.json` is deleted.

## B6. Validators that exist only to turn `Guid.Empty` into 400 instead of 404 <a name="b6"></a>

**Severity: LOW · unnecessary-abstraction · CONFIRMED · ~100 LOC**
`GetDocumentByIdQueryValidator` and `DeleteDocumentCommandValidator` each contain a single `Id NotEmpty` rule; without them a zero GUID finds no row and returns 404 — arguably more correct. Each rule costs a class plus a dedicated test file. Delete both (and the `Id` rule inside `UpdateDocumentCommandValidator`, along with its `Guid.Empty` test case).

## B7. `IDateTimeProvider` port duplicates .NET 8's built-in `TimeProvider` <a name="b7"></a>

**Severity: LOW · unnecessary-abstraction · CONFIRMED · ~45 LOC**
Three files (interface, system impl, test double) exist so three handlers can stamp timestamps testably — exactly what framework `TimeProvider` / `TimeProvider.System` / `FakeTimeProvider` provide. Or, under B1, just use `DateTimeOffset.UtcNow` and port the exact-timestamp assertions to integration-level round-trip checks.

## B8. `BaseEntity` abstract class for a single entity <a name="b8"></a>

**Severity: LOW · unnecessary-abstraction · CONFIRMED · ~12 LOC**
`BaseEntity` provides only `Guid Id` and has exactly one subclass — speculative generality. Inline the property into `PlantUmlDocument`, delete `Trellis.Domain/Common`. EF key discovery is by property name, so mapping is unaffected.

## B9. Small confirmed cleanups <a name="b9"></a>

- **`DocumentDto` mapping duplicated verbatim in four places** (LOW · ~30 LOC): the identical five-property initializer appears in Create/Update/Upload handlers and the by-id projection. Add one static `ToDto` for the three handlers (the query projection must stay inline for SQL translation) — or under B1, return the entity directly (it has no navigation properties or secrets; keep `DocumentListItemDto` regardless, since the list endpoint deliberately excludes `Content`).
- **Hand-rolled SQLite connection-string parser** (LOW · PARTIAL · ~28 LOC): `ResolveToAbsoluteConnectionString` re-implements in 35 lines what `SqliteConnectionStringBuilder` (already a transitive dependency) does correctly, including alias forms the hand parser mishandles. The verifier's corrected replacement (~12 lines) guards `Directory.CreateDirectory` against `""`/root paths and skips empty `DataSource` — the naive 7-line version throws on `:memory:`.
- **Three stacked catch-all layers on the render path** (LOW · ~18 LOC): renderer catch-all → `UnhandledExceptionBehaviour` → hub catch-all, with layers 1 and 3 producing the same generic message. Keep exactly one catch-all boundary — the hub (it must never throw per the SignalR contract) — and reduce `RenderAsync` to semaphore wait / try-finally. Keep `WaitAsync` outside the `try` so `Release` only runs after a successful acquire.

---

## What's good (keep as-is)

- `PlantUmlRenderer`'s process discipline and the exit-code-overrides-SVG rule — see [README](README.md#what-is-already-radically-simple--do-not-touch).
- `PlantUmlHub`'s request/response design; `CustomExceptionHandler`'s compact translation; `Program.cs` (~50 readable lines, documented CORS/message-size settings; honest E2E database-reset-before-health-check).
- Domain layer restraint: no repositories, domain events, value objects, or AutoMapper; manual explicit mapping.
- The persistence layer is right-sized: one entity, one fluent configuration, one migration, WAL pragma; the list query's server-side DTO projection with the documented SQLite `ORDER BY DateTimeOffset` workaround.
- Controllers keep `IFormFile` at the HTTP edge with size/extension/empty guards where they belong; route id authoritative over body on PUT.
