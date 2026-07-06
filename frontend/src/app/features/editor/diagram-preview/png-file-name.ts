/**
 * Derives a safe `.png` file name from a document name: strips a known
 * source extension so "order-flow.puml" exports as "order-flow.png" (not
 * "order-flow.puml.png"), replaces Windows-invalid path characters, and
 * falls back to "diagram" when nothing usable remains.
 *
 * Its own file (rather than a helper tucked inside the preview component)
 * because it's a pure, trivially unit-testable function.
 */
export function toPngFileName(documentName: string): string {
  const base = documentName
    .trim()
    .replace(/\.(puml|plantuml|txt|md|markdown)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[. ]+$/, '');
  return `${base || 'diagram'}.png`;
}
