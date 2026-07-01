/**
 * Shared bounds/default for the editor-vs-preview pane split ratio (the
 * editor pane's share of `.editor-page__body`'s width). Kept as one shared
 * module rather than duplicated literals in the divider component, the
 * editor page component, and their specs.
 */
export const MIN_EDITOR_PANE_RATIO = 0.2;
export const MAX_EDITOR_PANE_RATIO = 0.8;
export const DEFAULT_EDITOR_PANE_RATIO = 0.5;
