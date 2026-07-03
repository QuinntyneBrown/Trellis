import { DocumentKind } from './document-kind.model';

/**
 * The request body for the update-template endpoint: a full replace of name,
 * content AND kind. Unlike documents, a template's kind is updatable --
 * "Update from editor" replaces the content wholesale and may legitimately
 * change what the template is.
 */
export interface UpdateTemplateRequest {
  name: string;
  content: string;
  kind: DocumentKind;
}
