/**
 * The request body for the update-document endpoint. Deliberately has no
 * folder field -- documents cannot be moved between folders, so updates can
 * never change placement (see CreateDocumentRequest).
 */
export interface UpdateDocumentRequest {
  name: string;
  content: string;
}
