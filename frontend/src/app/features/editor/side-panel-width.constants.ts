/**
 * Shared bounds/default for the Explorer/Documents side panel's pixel width
 * (VS Code-typical sidebar width range/default). Kept as one shared module
 * rather than duplicated literals in the pixel divider component, the editor
 * page component, and their specs -- mirrors editor-pane-ratio.constants.ts's
 * role for the (ratio-based) editor/preview divider.
 */
export const MIN_SIDE_PANEL_WIDTH_PX = 170;
export const MAX_SIDE_PANEL_WIDTH_PX = 500;
export const DEFAULT_SIDE_PANEL_WIDTH_PX = 260;
