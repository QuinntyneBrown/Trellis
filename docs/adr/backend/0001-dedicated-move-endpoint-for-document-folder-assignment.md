# ADR-0001: Dedicated Move Endpoint for Document Folder Assignment

**Date:** 2026-07-02
**Category:** backend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

Documents originally received their folder at creation only: `UpdateDocumentRequest` deliberately
had no folder field, `DocumentsController.Update` never touched `FolderId`, and the integration
test `Update_DoesNotChangeFolder` encoded that contract. Defect D-001 requires moving documents
between folders (drag-and-drop plus a dialog fallback), so the API needed a mutation path.

The obvious-looking option — adding `Guid? FolderId` to `UpdateDocumentRequest` — has a structural
flaw: System.Text.Json binds an absent property and an explicit JSON `null` to the same `null`
value, so "move to root" and "leave the folder unchanged" become indistinguishable. Worse,
`DocumentsService.rename()` round-trips `{ name, content }` through the update endpoint; with a
folder field aboard, every rename would silently move the document to the root.

## Decision

Add a dedicated sub-resource endpoint:

```
PUT /api/documents/{id}/folder
Body: { "folderId": "<guid>" | null }   // null (or absent) = move to root
```

- The body's entire purpose is the destination, so there is no "leave unchanged" case and the
  null-vs-absent ambiguity is harmless: both mean root.
- The destination folder's existence is validated the same way `Create` validates it (404 rather
  than an SQLite FK violation surfacing as a 500).
- Moving does **not** touch `UpdatedAt`: the list view is ordered by recency, and re-organizing
  documents should not reshuffle it the way editing content does.
- The existing PUT contract stays frozen; `Update_DoesNotChangeFolder` remains valid unchanged as
  the proof that the update endpoint is folder-inert.

## Options Considered

### Option 1: Dedicated `PUT /api/documents/{id}/folder` endpoint (chosen)
- **Pros:** No null-vs-absent ambiguity; existing update contract (and its tests) untouched;
  `rename()` cannot accidentally move documents; idempotent PUT semantics fit "set the folder".
- **Cons:** One more endpoint and request DTO; two round trips if a client ever wants to rename
  and move atomically (no current caller does).

### Option 2: Add `Guid? FolderId` to `UpdateDocumentRequest`
- **Pros:** No new endpoint; single request updates everything.
- **Cons:** `null` cannot distinguish "move to root" from "don't change"; `rename()` would move
  every renamed document to root unless it first fetched and echoed the current folder id —
  turning a latent ambiguity into a standing bug-shaped trap for every future caller.

### Option 3: `PATCH /api/documents/{id}` with JSON merge-patch semantics
- **Pros:** Standards-shaped partial update.
- **Cons:** Requires distinguishing absent from null, which System.Text.Json model binding does
  not do out of the box; disproportionate machinery for a single mutable field.

## Consequences

### Positive
- Moving is now supported end-to-end with unambiguous semantics.
- The update endpoint's behavior (and its regression test) did not change.

### Negative
- Doc comments in `UpdateDocumentRequest`, `DocumentsController.Update`, and
  `PlantUmlDocument.FolderId` had to be reworded — they previously asserted moving was impossible.

### Risks
- None significant; the endpoint mirrors existing validation and persistence patterns.

## Implementation Notes

- `backend/src/Trellis.Api/Contracts/MoveDocumentRequest.cs` — the request DTO.
- `backend/src/Trellis.Api/Controllers/DocumentsController.cs` — the `Move` action.
- `frontend/src/app/core/services/documents.service.ts` — `move(id, folderId)`.
- Integration tests: `Move_ToAnotherFolder_UpdatesFolderId`, `Move_ToRoot_WithNullFolderId`,
  `Move_ToRoot_WithAbsentFolderId`, `Move_ReturnsNotFound_ForUnknownFolder_AndLeavesDocumentUnmoved`,
  `Move_ReturnsNotFound_ForUnknownDocument`, `Move_DoesNotChangeNameContentOrUpdatedAt`.

## References

- docs/defects/log.md — D-001
- ADR-0001 (frontend): Native HTML5 Drag-and-Drop for Document Moves
