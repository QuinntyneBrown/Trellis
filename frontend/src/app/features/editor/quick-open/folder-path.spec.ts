import { Folder } from '../../../core/models/folder.model';
import { buildFolderPath } from './folder-path';

describe('buildFolderPath', () => {
  function byId(folders: Folder[]): Map<string, Folder> {
    return new Map(folders.map((folder) => [folder.id, folder]));
  }

  it('returns an empty path for a root document', () => {
    expect(buildFolderPath(null, byId([]))).toBe('');
  });

  it('returns an empty path for an unknown folder id', () => {
    expect(buildFolderPath('ghost', byId([]))).toBe('');
  });

  it('names a single folder', () => {
    expect(buildFolderPath('a', byId([{ id: 'a', name: 'Designs', parentFolderId: null }]))).toBe('Designs');
  });

  it('walks a nested chain root-first', () => {
    const folders = byId([
      { id: 'a', name: 'Designs', parentFolderId: null },
      { id: 'b', name: 'C4', parentFolderId: 'a' },
      { id: 'c', name: 'Payments', parentFolderId: 'b' },
    ]);

    expect(buildFolderPath('c', folders)).toBe('Designs / C4 / Payments');
  });

  it('stops quietly at a missing parent instead of failing the row', () => {
    const folders = byId([{ id: 'b', name: 'C4', parentFolderId: 'gone' }]);

    expect(buildFolderPath('b', folders)).toBe('C4');
  });

  it('terminates on a parent cycle rather than hanging the tab', () => {
    const folders = byId([
      { id: 'a', name: 'A', parentFolderId: 'b' },
      { id: 'b', name: 'B', parentFolderId: 'a' },
    ]);

    expect(buildFolderPath('a', folders)).toBe('B / A');
  });
});
