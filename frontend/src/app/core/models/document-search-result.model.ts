import { DocumentSummary } from './document-summary.model';

/**
 * One hit from the documents full-text search endpoint. It is a
 * {@link DocumentSummary} -- so a result row renders exactly like a list row --
 * plus a `snippet`: a short excerpt of the content around the first place the
 * query matched, or null when the query matched only the name.
 */
export interface DocumentSearchResult extends DocumentSummary {
  snippet: string | null;
}
