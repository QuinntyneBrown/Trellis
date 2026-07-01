/**
 * One node of the Explorer panel's lazily-loaded directory tree.
 *
 * `children` being `undefined` specifically means "never loaded from disk"
 * -- as opposed to `[]`, which means "loaded, and the directory is empty".
 * This is what enables lazy loading: a directory's contents are only read
 * from disk (via FileSystemAccessService.listChildren()) the first time it
 * is expanded, and are then cached here so collapsing/re-expanding never
 * re-reads disk until an explicit refresh clears `children` back to
 * `undefined` for currently-expanded directories.
 *
 * No synthetic path/id field is needed -- a filesystem cannot have two
 * same-named entries in one directory, so `@for`'s `track` can safely use
 * `child.name` within a single node's `children` array.
 */
export interface ExplorerTreeNode {
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly handle: FileSystemHandle;
  children?: ExplorerTreeNode[];
  loadState: 'unloaded' | 'loading' | 'loaded' | 'error';
  expanded: boolean;
}
