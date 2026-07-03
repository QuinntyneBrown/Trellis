# ADR-0002: Shared TreeActionButtonComponent for Tree Row Actions

**Date:** 2026-07-02
**Category:** frontend
**Status:** Accepted
**Deciders:** Quinntyne Brown, Claude

## Context

Defects D-002 and D-003: the per-row actions in both tree panels (Documents: New Folder / Open /
Rename / Delete; Files explorer: New File / New Folder / Delete) rendered as labeled text buttons,
making rows feel cramped and cluttered. Both trees already share their row visuals through the
`tree-row($block)` Sass mixin in `frontend/src/app/shared/styles/_tree-row.scss`, and the app has
an established hand-authored inline-SVG icon convention in `rail-icons.ts` (24×24 viewBox path
arrays, `stroke: currentColor`) — but no icon library and no compact icon-button primitive.

## Decision

Introduce `frontend/src/app/shared/components/tree-action-button/` — a compact (~1.4rem) icon-only
standalone button component used by both tree-node components and the Documents panel header —
plus its own `TREE_ACTION_ICON_PATHS` map following the rail-icons drawing convention.

Design points:
- `label` is the single source for both the native `title` tooltip and `aria-label`, so they can
  never drift (the same idea as rail-button's `tooltipText`). Native `title` is used instead of
  rail-button's positioned tooltip span because these buttons repeat in every row inside an
  `overflow-y: auto` panel, where positioned spans would clip.
- `testId` passes through to the inner `<button>` via `[attr.data-testid]`, so every existing
  unit-spec and e2e selector keeps resolving to a real clickable button.
- `clicked` re-emits the original `MouseEvent`; emission is synchronous during native propagation,
  so the parents' established `event.stopPropagation()`-first handlers work unchanged.
- `:host { display: contents }` keeps the inner button a direct flex item of the row's
  `__actions` group (the rail-button idiom).
- The icon map is separate from `RAIL_ICON_PATHS` (copied glyph paths where shared, e.g.
  `new-file`) so the two closed unions stay independently owned by their consuming components.
- The mixin's old `__action` text-button rules were deleted; the `__actions` group now only lays
  out the icon buttons, keeping the one-style-source-for-both-trees property.

## Options Considered

### Option 1: Shared TreeActionButtonComponent + own icon map (chosen)
- **Pros:** One implementation for four templates (~10 buttons); testid/a11y/stopPropagation
  handled once; both trees restyled by construction.
- **Cons:** One more shared component to maintain.

### Option 2: Inline SVGs in each template, styling in the shared mixin
- **Pros:** No new component.
- **Cons:** ~10 duplicated SVG blocks across two features with drift risk; per-template
  aria-label/title wiring.

### Option 3: Extend rail-button / RAIL_ICON_PATHS
- **Pros:** Reuses an existing component.
- **Cons:** rail-button is a 40×40 activity-bar button with slide-out tooltip mechanics that are
  wrong for dense rows; growing its closed icon union couples two unrelated surfaces.

### Option 4: Adopt an icon library (e.g. Material icons)
- **Pros:** Large glyph choice.
- **Cons:** New dependency and font/asset pipeline for six small glyphs; breaks the codebase's
  deliberate hand-authored-SVG convention.

## Consequences

### Positive
- Both trees and the Documents header read as one compact family; rows align because all actions
  are fixed-size squares regardless of label length (D-002, D-003 resolved together).
- Keyboard/AT users keep full parity (`aria-label`, focus-visible styling).

### Negative
- Icon-only actions rely on tooltips for discoverability — mitigated by native `title` on every
  button.

### Risks
- None significant; all existing data-testids were preserved and verified by the untouched
  unit and e2e suites.

## Implementation Notes

- New: `tree-action-icons.ts`, `tree-action-button.component.{ts,html,scss,spec.ts}`.
- Modified: `_tree-row.scss` (action rules removed), `document-tree-node.component.{html,ts}`,
  `file-tree-node.component.{html,ts}`, `documents-panel.component.{html,scss,ts}`.

## References

- docs/defects/log.md — D-002, D-003
- frontend/src/app/shared/components/rail-button/ — the pattern this mirrors
