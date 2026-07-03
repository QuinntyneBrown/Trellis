import { DocumentKind } from './document-kind.model';

/**
 * The request body for the create-document endpoint. Unlike
 * UpdateDocumentRequest it carries the destination folder and the kind --
 * creation is the only point at which either is chosen (folders can change
 * later via the dedicated move endpoint; the kind never does).
 */
export interface CreateDocumentRequest {
  name: string;
  content: string;
  /** The destination folder's id, or null for the root. */
  folderId: string | null;
  /** The document kind; omitted/undefined defaults to plantuml server-side. */
  kind?: DocumentKind;
}
