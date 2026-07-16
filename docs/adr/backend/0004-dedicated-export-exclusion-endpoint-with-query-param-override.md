# ADR-0004: Dedicated Export-Exclusion Endpoint with Query-Param Export Override

**Date:** 2026-07-08
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

The folder markdown export (`GET /api/folders/{id}/export`) aggregates every
document in a folder subtree. Users keep drafts and scratch documents inside
exported folders and need to (a) mark individual documents as excluded from
exports, and (b) occasionally export everything anyway, overriding those
per-document marks for a single export.

Two API surface questions follow:

1. How does a client change a document's excluded state? The document update
   endpoint (`PUT /api/documents/{id}`) is deliberately Name/Content-only, and
   ADR-0001 already established the precedent of a dedicated endpoint
   (`PUT /api/documents/{id}/folder`) for organizational mutations that must
   not bump the recency timestamp.
2. How does a client request the "export everything" override? The export is
   a GET returning raw `text/markdown`, so the override has to travel with
   the request, and it is a per-export choice — never persisted state.

## Decision

- Persist a `ExcludedFromExport` boolean on the `Documents` table
  (default `false`, backfilling existing rows as included).
- Change it only via a new dedicated endpoint,
  `PUT /api/documents/{id}/export-exclusion` with body
  `{ "excludedFromExport": bool }`, which — like the move endpoint — does
  NOT touch `UpdatedAt`.
- Filter excluded documents inside the export's document query, and accept
  `GET /api/folders/{id}/export?includeExcluded=true` as the one-shot
  override. The aggregation/rendering code (`BuildExportMarkdown`) stays
  untouched; an all-excluded subtree naturally renders the existing
  "no documents" note.

## Options Considered

### Option 1: Dedicated `PUT /api/documents/{id}/export-exclusion` endpoint (chosen)
- **Pros:** Mirrors ADR-0001 exactly — toggling export visibility is
  re-organization, not editing, so it must not reshuffle the recency-ordered
  document list. Keeps `UpdateDocumentRequest` structurally free of the flag,
  so a stale editor save can never silently flip it.
- **Cons:** One more endpoint and request contract to maintain.

### Option 2: Add the flag to `UpdateDocumentRequest`
- **Pros:** No new endpoint.
- **Cons:** Every update would have to echo the current value or risk
  resetting it; the update endpoint bumps `UpdatedAt`, wrongly reshuffling
  the list on a pure organizational toggle; contradicts the ADR-0001 shape.

### Option 3: Persist the override (e.g. a per-folder "export all" setting) instead of a query param
- **Pros:** Override survives across exports.
- **Cons:** The requirement is a one-shot escape hatch, not a mode; persisted
  override state invites confusion about which setting wins. A query param
  keeps the server stateless about the choice and the UI (a dialog checkbox
  re-seeded unchecked per export) honest.

## Consequences

### Positive
- Excluding a document never changes its position in the recency-ordered
  list view.
- The export endpoint's markdown format contract is unchanged; exclusion is
  purely a membership filter at the query.
- The list projection (`DocumentListItemDto`) carries the flag, so the tree
  can badge excluded documents without extra requests.

### Negative
- Clients must know about two mutation endpoints for a document's
  organizational state (folder and export-exclusion) plus the general update.

### Risks
- If future export surfaces are added (e.g. exporting a single document or
  the whole library), each must remember to honor the flag; it is only
  enforced in the folder export query today.

## Implementation Notes

- Migration `20260709013739_AddDocumentExportExclusion` adds the column with
  `defaultValue: false` (SQLite requires a default when adding NOT NULL
  columns to populated tables).
- Frontend: `DocumentsService.setExportExclusion()` mirrors `move()`;
  `FoldersService.exportFolder(id, includeExcluded)` appends the query param
  only when true. The export UI is a confirmation dialog whose
  "Include documents excluded from export" checkbox re-seeds unchecked on
  every open.

## References

- ADR-0001: Dedicated move endpoint for document folder assignment (the
  pattern this decision follows)
- `backend/src/Trellis.Api/Controllers/DocumentsController.cs` (`SetExportExclusion`)
- `backend/src/Trellis.Api/Controllers/FoldersController.cs` (`Export`)
