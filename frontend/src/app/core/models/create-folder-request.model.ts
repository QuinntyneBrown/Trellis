/** The request body for creating a virtual folder. */
export interface CreateFolderRequest {
  name: string;
  /** The parent folder's id, or null to create the folder at the root. */
  parentFolderId: string | null;
}
