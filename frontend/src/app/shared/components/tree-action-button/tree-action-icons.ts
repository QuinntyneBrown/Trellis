/**
 * Icon glyphs for the compact tree-row action buttons, drawn in the same
 * hand-authored convention as rail-icons.ts: arrays of SVG path `d` strings
 * on a 24x24 viewBox, outline style (fill: none, stroke: currentColor), so a
 * button renders one `<path>` per entry.
 *
 * Kept as its own map (not merged into RAIL_ICON_PATHS) so the two closed
 * unions stay independently owned by their consuming button components --
 * the 40px activity-bar rail button and this dense in-row action button have
 * different size/tooltip mechanics and should not share a growing icon union.
 */
export type TreeActionIconName = 'open' | 'rename' | 'delete' | 'new-file' | 'new-folder' | 'move' | 'update';

export const TREE_ACTION_ICON_PATHS: Record<TreeActionIconName, string[]> = {
  // Arrow escaping a box, pointing up-right: "open this in the editor".
  open: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M15 3h6v6M21 3l-11 11',
  ],
  // Pencil.
  rename: ['M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z'],
  // Trash can with lid and two inner slats.
  delete: [
    'M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M10 11v6M14 11v6',
  ],
  // Page with a plus -- same drawing as the rail's `new` glyph (copied, not
  // imported, so the two icon unions stay independent).
  'new-file': ['M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM13 2v5h5', 'M12 14v6M9 17h6'],
  // Folder with a plus.
  'new-folder': [
    'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
    'M12 10.5v5M9.5 13h5',
  ],
  // Folder with a right-pointing arrow: "move into a folder".
  move: [
    'M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z',
    'M9 13h5.5M12 10.5 14.5 13 12 15.5',
  ],
  // Arrow entering a box (the inverse of `open`): "update this from the editor".
  update: [
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
    'M21 3l-8 8M13 5v6h6',
  ],
};
