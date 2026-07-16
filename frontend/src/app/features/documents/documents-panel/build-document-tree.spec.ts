import { DocumentSummary } from '../../../core/models/document-summary.model';
import { Folder } from '../../../core/models/folder.model';
import { buildDocumentTree } from './build-document-tree';

describe('buildDocumentTree', () => {
  const folder = (id: string, name: string, parentFolderId: string | null = null): Folder => ({
    id,
    name,
    parentFolderId,
  });

  const doc = (id: string, name: string, folderId: string | null = null): DocumentSummary => ({
    id,
    name,
    updatedAt: '2026-01-01T00:00:00Z',
    folderId,
    kind: 'plantuml',
    excludedFromExport: false,
  });

  it('returns an empty tree for empty inputs', () => {
    expect(buildDocumentTree([], [], new Set())).toEqual([]);
  });

  it('nests folders under their parents and documents under their folders', () => {
    const tree = buildDocumentTree(
      [folder('outer', 'outer'), folder('inner', 'inner', 'outer')],
      [doc('d1', 'in outer', 'outer'), doc('d2', 'in inner', 'inner'), doc('d3', 'at root')],
      new Set(),
    );

    expect(tree.map((n) => n.name)).toEqual(['outer', 'at root']);

    const outer = tree[0];
    expect(outer.kind).toBe('folder');
    expect(outer.children!.map((n) => n.name)).toEqual(['inner', 'in outer']);

    const inner = outer.children![0];
    expect(inner.children!.map((n) => n.name)).toEqual(['in inner']);
  });

  it('sorts each level folders-first, then case-insensitively by name', () => {
    const tree = buildDocumentTree(
      [folder('f1', 'zebra'), folder('f2', 'Apple')],
      [doc('d1', 'banana'), doc('d2', 'Aardvark')],
      new Set(),
    );

    expect(tree.map((n) => n.name)).toEqual(['Apple', 'zebra', 'Aardvark', 'banana']);
  });

  it('nests correctly regardless of folder declaration order', () => {
    const tree = buildDocumentTree([folder('child', 'child', 'parent'), folder('parent', 'parent')], [], new Set());

    expect(tree.map((n) => n.name)).toEqual(['parent']);
    expect(tree[0].children!.map((n) => n.name)).toEqual(['child']);
  });

  it('marks folders expanded from the given id set', () => {
    const tree = buildDocumentTree([folder('f1', 'open'), folder('f2', 'closed')], [], new Set(['f1']));

    expect(tree.find((n) => n.name === 'open')!.expanded).toBe(true);
    expect(tree.find((n) => n.name === 'closed')!.expanded).toBe(false);
  });

  it('attaches nodes with unknown parents to the root instead of dropping them', () => {
    const tree = buildDocumentTree(
      [folder('orphan', 'orphan folder', 'missing')],
      [doc('d1', 'orphan doc', 'also-missing')],
      new Set(),
    );

    expect(tree.map((n) => n.name)).toEqual(['orphan folder', 'orphan doc']);
  });

  it('carries the original document summary on document nodes', () => {
    const summary = doc('d1', 'mine');
    const tree = buildDocumentTree([], [summary], new Set());

    expect(tree[0].document).toBe(summary);
    expect(tree[0].id).toBe('d1');
  });
});
