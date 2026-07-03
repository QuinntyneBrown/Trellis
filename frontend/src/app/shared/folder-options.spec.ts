import { Folder } from '../core/models/folder.model';
import { flattenFolderOptions } from './folder-options';

const NBSP_INDENT = '    ';

describe('flattenFolderOptions', () => {
  const folder = (id: string, name: string, parentFolderId: string | null = null): Folder => ({
    id,
    name,
    parentFolderId,
  });

  it('returns no options for no folders', () => {
    expect(flattenFolderOptions([])).toEqual([]);
  });

  it('lists nested folders depth-first with nbsp indentation', () => {
    const options = flattenFolderOptions([
      folder('a', 'architecture'),
      folder('a-c4', 'c4', 'a'),
      folder('s', 'sequences'),
    ]);

    expect(options).toEqual([
      { id: 'a', label: 'architecture' },
      { id: 'a-c4', label: `${NBSP_INDENT}c4` },
      { id: 's', label: 'sequences' },
    ]);
  });

  it('sorts siblings case-insensitively', () => {
    const options = flattenFolderOptions([folder('z', 'zebra'), folder('a', 'Apple')]);

    expect(options.map((o) => o.label)).toEqual(['Apple', 'zebra']);
  });

  it('treats folders with unknown parents as roots instead of dropping them', () => {
    const options = flattenFolderOptions([folder('orphan', 'orphan', 'missing-parent')]);

    expect(options).toEqual([{ id: 'orphan', label: 'orphan' }]);
  });
});
