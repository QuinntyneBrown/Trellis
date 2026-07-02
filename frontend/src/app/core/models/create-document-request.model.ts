/**
 * The request body for the create-document endpoint. Unlike
 * UpdateDocumentRequest it carries the destination folder -- creation is the
 * only point at which a document's folder is chosen (moving is unsupported).
 */
export interface CreateDocumentRequest {
  name: string;
  content: string;
  /** The destination folder's id, or null for the root. */
  folderId: string | null;
}
