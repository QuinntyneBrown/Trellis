# Trellis design system

Static HTML documentation of the complete Trellis design system — the
dark-theme visual contract for the Angular frontend, heavily inspired by the
VS Code design system. The Trellis design system is a product of its own:
these pages are the authoritative reference for its tokens, components, and
patterns.

Open [`index.html`](index.html) in a browser; no build step or server is
required. Pages work over `file://` and use only system fonts — there are no
external dependencies of any kind.

## Contents

| Area | Pages |
|---|---|
| Foundations | color, typography, spacing, elevation, iconography, motion |
| Components | buttons, form-controls, dialogs, trees, panels, menus, toolbars, indicators |
| Patterns | shell, editor, preview, feedback |

## Shared assets

- `assets/tokens.css` — the authoritative design tokens (color, typography,
  spacing, shape, elevation, motion, z-index). The Angular theme consumes
  these values.
- `assets/components.css` — reference implementation of every reusable
  element (`.tds-*` classes), each block annotated with the Angular source
  it derives from.
- `assets/docs.css` — documentation-site chrome only (`.ds-*` classes); not
  part of the product design system.
- `assets/docs.js` — injects the SVG icon sprite (transcribed from
  `rail-icons.ts` / `tree-action-icons.ts`) and renders the shared nav. No
  external dependencies.

## Conventions

- **Derived, not invented.** Every component section cites the Angular
  source it documents (paths relative to `frontend/src/app`). Structure,
  metrics, and interaction states are carried over verbatim from the
  implementation; only colors move to the dark tokens.
- **Dark is the target theme.** The app currently ships light; this system
  defines the dark theme it converges on. The light-value → dark-token
  mapping is recorded in `tokens.css` so the migration is auditable.
- **One accent.** Trellis blue is reserved for interaction — active rail
  item, open document, focus rings, primary actions, drop targets. Status
  colors (ok / warn / error) are reserved for connection and operation
  outcome semantics.
- **Contrast:** text tokens hold ≥ 4.5:1 on every surface they may occupy
  (disabled ink is intentionally exempt); the contrast table lives in
  [foundations/color.html](foundations/color.html).
- **All code, identifiers, and diagram text** render in the mono stack
  (Consolas / Cascadia Mono).

## Publishing

The site deploys to an Azure Static Web App on every push to `main` that
touches `docs/mocks/design-system/**`
([`.github/workflows/deploy-design-system.yml`](../../../.github/workflows/deploy-design-system.yml)).
There is no build: the folder is uploaded verbatim, honoring
[`staticwebapp.config.json`](staticwebapp.config.json).

One-time setup:

1. Provision the Static Web App with
   [`infra/design-system.bicep`](../../../infra/design-system.bicep)
   (instructions in the file header).
2. Copy the app's deployment token into the repository secret
   `AZURE_STATIC_WEB_APPS_API_TOKEN`.

## Relationship to docs/mocks

The screen mocks one level up ([`docs/mocks`](../README.md)) capture the
app *as it is today* (light theme, pixel-equivalent to the Angular DOM).
This folder documents the *system* — the reusable language those screens
converge on, in its target dark expression. When the app and the system
disagree, the design system is the intent; the mocks are the inventory.
