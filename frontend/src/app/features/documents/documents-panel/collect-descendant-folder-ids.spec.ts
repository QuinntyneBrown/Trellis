import { Folder } from '../../../core/models/folder.model';
import { collectDescendantFolderIds } from './collect-descendant-folder-ids';

describe('collectDescendantFolderIds', () => {
  const folder = (id: string, parentFolderId: string | null = null): Folder => ({
    id,
    name: id,
    parentFolderId,
  });

  it('always includes the root id itself', () => {
    expect(collectDescendantFolderIds([folder('a')], 'a')).toEqual(new Set(['a']));
  });

  it('collects direct children and deep descendants', () => {
    const folders = [folder('a'), folder('b', 'a'), folder('c', 'b'), folder('d', 'c')];

    expect(collectDescendantFolderIds(folders, 'a')).toEqual(new Set(['a', 'b', 'c', 'd']));
    expect(collectDescendantFolderIds(folders, 'b')).toEqual(new Set(['b', 'c', 'd']));
  });

  it('excludes siblings and ancestors of the root', () => {
    const folders = [folder('parent'), folder('scoped', 'parent'), folder('sibling', 'parent'), folder('other')];

    expect(collectDescendantFolderIds(folders, 'scoped')).toEqual(new Set(['scoped']));
  });

  it('returns just the root id when it is unknown to the list', () => {
    expect(collectDescendantFolderIds([folder('a')], 'missing')).toEqual(new Set(['missing']));
  });

  it('terminates on a parent-link cycle instead of looping forever', () => {
    // Corrupt data: a <-> b point at each other.
    const folders = [folder('a', 'b'), folder('b', 'a'), folder('c', 'b')];

    expect(collectDescendantFolderIds(folders, 'a')).toEqual(new Set(['a', 'b', 'c']));
  });
});
