import { Folder } from '../../../core/models/folder.model';

/**
 * Collects the ids of `rootFolderId` and every folder beneath it, walking
 * the flat list's parentFolderId links downward (breadth-first).
 *
 * The root's own id is deliberately included: the Documents panel's scope
 * filter tests documents with `scopedIds.has(document.folderId)`, and
 * documents sitting directly in the scoped folder must pass.
 *
 * The result set doubles as the visited guard, so a parent-link cycle in
 * corrupt data terminates instead of looping -- the same defensive posture
 * as DocumentsPanelComponent.expandActiveDocumentAncestors(), which walks
 * the identical chain upward.
 */
export function collectDescendantFolderIds(folders: Folder[], rootFolderId: string): Set<string> {
  const childIdsByParentId = new Map<string, string[]>();
  for (const folder of folders) {
    if (folder.parentFolderId !== null) {
      const siblings = childIdsByParentId.get(folder.parentFolderId) ?? [];
      siblings.push(folder.id);
      childIdsByParentId.set(folder.parentFolderId, siblings);
    }
  }

  const collected = new Set<string>([rootFolderId]);
  const queue = [rootFolderId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const childId of childIdsByParentId.get(parentId) ?? []) {
      if (!collected.has(childId)) {
        collected.add(childId);
        queue.push(childId);
      }
    }
  }

  return collected;
}
