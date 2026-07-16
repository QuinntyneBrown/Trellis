import { DocumentKind } from './document-kind.model';

export interface Document {
  id: string;
  name: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  /** The containing virtual folder's id, or null when the document sits at the root. */
  folderId: string | null;
  /** What the content is -- decides the render pipeline and editor language. */
  kind: DocumentKind;
  /** Whether folder markdown exports omit this document (unless overridden). */
  excludedFromExport: boolean;
}
