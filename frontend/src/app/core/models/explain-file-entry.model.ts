/**
 * One file of a local "Explain This" selection: read client-side via the
 * File System Access API and posted to the backend, which owns the single
 * implementation of the aggregation/stripping rules.
 */
export interface ExplainFileEntry {
  /** Selection-relative path, using forward slashes. */
  path: string;
  /** Full text content of the file. */
  content: string;
}
