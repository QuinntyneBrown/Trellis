/**
 * Icon names available to `<app-rail-button>`. Each maps to one or two SVG
 * path `d` strings on a shared 24x24 viewBox, drawn in an outline
 * (Heroicons/Feather-like) style: `fill="none" stroke="currentColor"`.
 */
export type RailIconName = 'new' | 'save' | 'upload' | 'templates' | 'documents' | 'explorer';

/**
 * Hand-authored outline icon paths -- no icon-library dependency. Kept
 * deliberately simple and visually distinct from one another (in
 * particular 'new' and 'documents' are two very different shapes, a page
 * with a plus badge vs. a folder, so they don't blur together sitting a
 * few pixels apart in a narrow 48px rail).
 */
export const RAIL_ICON_PATHS: Record<RailIconName, string[]> = {
  // A page with a folded top-right corner, plus a small "+" badge low on
  // the page to signal document creation.
  new: ['M6 2h7l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM13 2v5h5', 'M12 14v6M9 17h6'],

  // A floppy disk: outer body with a notched top-right corner, an inner
  // top "label" slot, and a lower rectangle standing in for the write
  // -protected label area.
  save: ['M5 3h11l3 3v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M8 3v5h7V3M7 13h10v8H7z'],

  // An upward arrow dropping into a horizontal tray/basket line.
  upload: ['M12 15V4M8 8l4-4 4 4', 'M4 17v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3'],

  // A 2x2 grid of small squares.
  templates: ['M4 4h6v6H4zM14 4h6v6H14zM4 14h6v6H4zM14 14h6v6H14z'],

  // A folder outline.
  documents: ['M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7z'],

  // Two overlapping, diagonally-offset rounded-rectangle page outlines --
  // visually distinct from both 'new' (a single page with a plus badge) and
  // 'documents' (a folder): this reads as "a stack of files/folders in a
  // tree", the VS Code Explorer activity-bar icon's own visual metaphor.
  explorer: [
    'M4 9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
    'M8 5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-1',
  ],
};
