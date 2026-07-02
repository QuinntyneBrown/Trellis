/**
 * Shared bounds/default for the Explorer/Documents side panel's pixel width
 * (VS Code-typical sidebar width range/default). Kept as one shared module
 * rather than duplicated literals in the editor page component and its specs
 * -- mirrors editor-pane-ratio.constants.ts's role for the (ratio-based)
 * editor/preview divider.
 */
export const MIN_SIDE_PANEL_WIDTH_PX = 170;
export const MAX_SIDE_PANEL_WIDTH_PX = 500;
export const DEFAULT_SIDE_PANEL_WIDTH_PX = 260;
/** Pixels applied per arrow-key nudge of the side-panel divider. */
export const SIDE_PANEL_WIDTH_KEYBOARD_STEP_PX = 16;
