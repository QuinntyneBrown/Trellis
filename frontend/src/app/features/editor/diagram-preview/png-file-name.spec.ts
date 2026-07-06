import { toPngFileName } from './png-file-name';

describe('toPngFileName', () => {
  it('replaces a known source extension with .png', () => {
    expect(toPngFileName('order-flow.puml')).toBe('order-flow.png');
    expect(toPngFileName('order-flow.plantuml')).toBe('order-flow.png');
    expect(toPngFileName('notes.md')).toBe('notes.png');
  });

  it('appends .png to a name without a known extension', () => {
    expect(toPngFileName('Untitled diagram')).toBe('Untitled diagram.png');
  });

  it('replaces Windows-invalid path characters', () => {
    expect(toPngFileName('a/b\\c:d*e?f"g<h>i|j')).toBe('a-b-c-d-e-f-g-h-i-j.png');
  });

  it('strips trailing dots and spaces left after sanitizing', () => {
    expect(toPngFileName('diagram v2. ')).toBe('diagram v2.png');
  });

  it('falls back to "diagram" for empty or whitespace-only names', () => {
    expect(toPngFileName('')).toBe('diagram.png');
    expect(toPngFileName('   ')).toBe('diagram.png');
    expect(toPngFileName('.puml')).toBe('diagram.png');
  });
});
