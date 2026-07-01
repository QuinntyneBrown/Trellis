/**
 * One entry in a single-level directory listing, as returned by
 * FileSystemAccessService.listChildren(). Deliberately flat (no `children`,
 * no lazy-load bookkeeping) -- that structure belongs to ExplorerTreeNode,
 * which wraps entries like this one into the recursive tree the Explorer
 * panel actually renders.
 */
export interface DirectoryChildEntry {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemHandle;
}
