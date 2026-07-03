import { Folder } from '../core/models/folder.model';

/** One entry of a destination-folder select (save dialog, move dialog). */
export interface FolderOption {
  id: string;
  /** The folder name, nbsp-indented four spaces per nesting level. */
  label: string;
}

/** Four non-breaking spaces per depth level -- ordinary spaces collapse inside <option> text. */
const INDENT = '    ';

/**
 * Flattens the folder tree into depth-first <option> entries, siblings sorted
 * case-insensitively like the Documents panel tree, with nesting shown by
 * nbsp indentation (native <option>s cannot be styled with padding reliably).
 *
 * A folder whose parentFolderId is missing from the list is treated as a
 * root -- the same defensive normalization buildDocumentTree() applies.
 */
export function flattenFolderOptions(folders: Folder[]): FolderOption[] {
  const folderIds = new Set(folders.map((folder) => folder.id));
  const childrenByParentId = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const parentId = folder.parentFolderId !== null && folderIds.has(folder.parentFolderId) ? folder.parentFolderId : null;
    const siblings = childrenByParentId.get(parentId) ?? [];
    siblings.push(folder);
    childrenByParentId.set(parentId, siblings);
  }

  const options: FolderOption[] = [];
  const visit = (parentId: string | null, depth: number): void => {
    const siblings = (childrenByParentId.get(parentId) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
    for (const folder of siblings) {
      options.push({ id: folder.id, label: INDENT.repeat(depth) + folder.name });
      visit(folder.id, depth + 1);
    }
  };
  visit(null, 0);

  return options;
}
