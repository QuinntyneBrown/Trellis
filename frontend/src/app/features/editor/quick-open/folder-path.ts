import { Folder } from '../../../core/models/folder.model';

/**
 * Renders a document's virtual-folder location as a breadcrumb ("Designs /
 * C4") for a Quick Open result row. Root documents (folderId null) get ''.
 *
 * Walks parentFolderId up a prebuilt Map -- built once per result batch by
 * the caller, not per row. Defensive on bad data, like the documents panel's
 * ancestor walk: an unknown id ends the walk quietly, and a visited set
 * guards against a parent cycle (nothing prevents one arriving from a
 * hand-edited database, and a hang would take the whole tab with it).
 */
export function buildFolderPath(folderId: string | null, foldersById: ReadonlyMap<string, Folder>): string {
  const names: string[] = [];
  const visited = new Set<string>();
  let currentId = folderId;

  while (currentId !== null && !visited.has(currentId)) {
    visited.add(currentId);
    const folder = foldersById.get(currentId);
    if (!folder) {
      break;
    }
    names.unshift(folder.name);
    currentId = folder.parentFolderId;
  }
  return names.join(' / ');
}
