import { DocumentKind } from './document-kind.model';

export interface DocumentSummary {
  id: string;
  name: string;
  updatedAt: string;
  /** The containing virtual folder's id, or null when the document sits at the root. */
  folderId: string | null;
  /** What the content is -- surfaces as the tree's MD badge. */
  kind: DocumentKind;
}
