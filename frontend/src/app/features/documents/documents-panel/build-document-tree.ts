import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { Folder } from '../../../core/models/folder.model';

/**
 * Assembles the Documents panel's virtual folder tree from the two flat
 * lists the API returns.
 *
 * Each level is sorted folders-before-documents, then alphabetically via
 * localeCompare(..., { sensitivity: 'base' }) within each group -- the same
 * ordering FileSystemAccessService.listChildren() applies to the Explorer's
 * disk tree, so both panels read identically.
 *
 * A folder whose parentFolderId (or a document whose folderId) points at a
 * folder missing from the list is attached to the root rather than dropped --
 * defensive only; the backend's foreign keys make this unreachable in
 * practice.
 */
export function buildDocumentTree(
  folders: Folder[],
  documents: DocumentSummary[],
  expandedFolderIds: ReadonlySet<string>,
): DocumentTreeNode[] {
  const childrenByFolderId = new Map<string, DocumentTreeNode[]>(folders.map((folder) => [folder.id, []]));
  const roots: DocumentTreeNode[] = [];

  const attach = (parentId: string | null, node: DocumentTreeNode): void => {
    const siblings = (parentId !== null && childrenByFolderId.get(parentId)) || roots;
    siblings.push(node);
  };

  for (const folder of folders) {
    attach(folder.parentFolderId, {
      id: folder.id,
      name: folder.name,
      kind: 'folder',
      children: childrenByFolderId.get(folder.id),
      expanded: expandedFolderIds.has(folder.id),
    });
  }

  for (const document of documents) {
    attach(document.folderId, {
      id: document.id,
      name: document.name,
      kind: 'document',
      document,
    });
  }

  for (const siblings of [roots, ...childrenByFolderId.values()]) {
    siblings.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'folder' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  return roots;
}
