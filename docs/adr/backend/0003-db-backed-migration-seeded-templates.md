# ADR-0003: DB-Backed, Migration-Seeded Templates

**Date:** 2026-07-03
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

Templates were a read-only static catalog: six hardcoded entries in
`TemplateCatalog` reading `Vendor/templates/*.puml` eagerly at startup,
served by a single `GET /api/templates`. D-011 requires full template CRUD
(create, update, delete), which a file-backed catalog cannot offer.

## Decision

Templates become an ordinary EF entity (`Domain/Template.cs`: Id, Name,
Content, Kind, CreatedAt, UpdatedAt) with a documents-style CRUD controller,
and **the six built-in starters are seeded by the `AddTemplates` migration's
`InsertData`** as ordinary rows — renameable, updatable, deletable like any
user template.

Key choices:

1. **Migration seeding, not seed-if-empty.** A startup seed-if-empty would
   resurrect deleted built-ins on every boot with an empty table; the
   migration runs exactly once per database (recorded in
   `__EFMigrationsHistory`), so deletions stick. E2E and integration-test
   databases re-migrate from scratch, so seeds are always present there.
   Seed content is embedded as `string.Join("\n", ...)` literals — NOT raw
   string literals, which would smuggle CRLF in from a Windows checkout.
2. **Category dropped.** The old `'General' | 'C4'` category was redundant
   with the seeded names ("C4 - Context"); the panel is a flat name-sorted
   list. A conscious simplification.
3. **Kind is required and updatable on PUT** — a deliberate divergence from
   documents (create-only kind): "Update from editor" replaces a template's
   content wholesale and may legitimately change what it is, and a full-
   replace PUT has no "leave unchanged" ambiguity to defend against.
4. **List DTO excludes content** (`TemplateListItemDto { Id, Name, Kind,
   UpdatedAt }`), name-ordered client-side after projection (SQLite BINARY
   collation would case-sensitively misorder); `GET /{id}` returns the full
   entity. Mirrors the documents endpoints.
5. `TemplateCatalog`, `TemplateDto`, and `Vendor/templates/` are deleted;
   the migration is the permanent source of the seed content. The
   `Vendor/**` csproj copy rules remain for the PlantUML jar and C4 includes.

## Options Considered

### Option 1: Migration-seeded entity (chosen)
- **Pros:** One template model with full CRUD; deletions of built-ins are
  permanent; deterministic across every environment.
- **Cons:** Seed content frozen into a migration file (fine — migrations
  are immutable history by design).

### Option 2: Seed-if-empty at startup
- **Pros:** Seed content lives in ordinary code.
- **Cons:** Deleting all built-ins resurrects them on the next boot —
  user data loss of intent.

### Option 3: Keep built-ins read-only + separate user templates
- **Pros:** Starters are protected.
- **Cons:** Two template types with different rules across API and UI.

## Consequences

### Positive
- Templates flow through the same idioms as documents (controller, tests,
  service, panel), keeping the codebase uniform.

### Negative
- Users can delete or break the starters; acceptable — they can recreate
  equivalents, and a fresh database always has them.

### Risks
- A future migration must not recreate the Templates table: the model
  snapshot gained the Template entity block when the migration was
  scaffolded (verified).

## Implementation Notes

- `Domain/Template.cs`, `Domain/DocumentKinds.cs` (shared),
  `Persistence/Configurations/TemplateConfiguration.cs`,
  `Persistence/Migrations/20260703123408_AddTemplates.cs` (+ seed),
  `Controllers/TemplatesController.cs`, `Models/TemplateListItemDto.cs`,
  `Contracts/CreateTemplateRequest.cs` / `UpdateTemplateRequest.cs`.
- Tests: `TemplatesControllerTests` (shared fixture, read-only on seeds) +
  `TemplatesSeedMutationTests` (own factory for the delete-a-seed case).

## References

- docs/defects/log.md — D-011
- docs/adr/frontend/0004 — templates side panel
