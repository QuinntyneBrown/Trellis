import { DocumentKind } from './document-kind.model';

/** The lightweight list shape of a template -- content is only fetched on demand. */
export interface TemplateSummary {
  id: string;
  name: string;
  /** What the template's content is -- surfaces as the panel's MD badge. */
  kind: DocumentKind;
  updatedAt: string;
}
