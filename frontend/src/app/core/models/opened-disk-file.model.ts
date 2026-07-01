/**
 * Event payload ExplorerPanelComponent emits (via `fileOpened`) up to
 * EditorPageComponent when the user clicks a file row in the tree.
 */
export interface OpenedDiskFile {
  handle: FileSystemFileHandle;
  name: string;
  content: string;
}
