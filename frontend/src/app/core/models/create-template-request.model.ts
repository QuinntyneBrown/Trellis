import { DocumentKind } from './document-kind.model';

/** The request body for the create-template endpoint. */
export interface CreateTemplateRequest {
  name: string;
  content: string;
  kind: DocumentKind;
}
