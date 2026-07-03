import { DocumentKind } from './document-kind.model';

/** The full template shape, including content -- fetched by id on demand. */
export interface Template {
  id: string;
  name: string;
  content: string;
  /** What the content is -- decides the render pipeline and editor language on apply. */
  kind: DocumentKind;
  createdAt: string;
  updatedAt: string | null;
}
