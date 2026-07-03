/**
 * The kind of content a document holds. Matches the backend's DocumentKinds
 * wire values exactly; the kind decides the render pipeline (PlantUML ->
 * SVG, markdown -> sanitized HTML) and the Monaco language.
 */
export type DocumentKind = 'plantuml' | 'markdown';

const MARKDOWN_EXTENSIONS = ['.md', '.markdown'];

/**
 * Infers a document kind from a file name -- the rule used for disk files
 * opened via the Explorer (the backend applies the same rule to uploads).
 */
export function inferDocumentKindFromFileName(fileName: string): DocumentKind {
  const lower = fileName.toLowerCase();
  return MARKDOWN_EXTENSIONS.some((extension) => lower.endsWith(extension)) ? 'markdown' : 'plantuml';
}
