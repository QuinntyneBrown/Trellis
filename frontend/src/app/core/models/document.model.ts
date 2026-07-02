export interface Document {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  /** The containing virtual folder's id, or null when the document sits at the root. */
  folderId: string | null;
}
