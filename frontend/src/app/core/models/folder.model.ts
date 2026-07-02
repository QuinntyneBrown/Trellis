/**
 * A virtual folder used to organize saved documents, as returned by the
 * folders API. Folders are database rows, not disk directories; the tree
 * shape is reconstructed client-side from this flat list's parent links.
 */
export interface Folder {
  id: string;
  name: string;
  /** The containing folder's id, or null when this folder sits at the root. */
  parentFolderId: string | null;
}
