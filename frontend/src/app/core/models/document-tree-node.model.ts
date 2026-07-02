import { DocumentSummary } from './document-summary.model';

/**
 * One node of the Documents panel's virtual folder tree, built client-side
 * from the two flat lists the API returns (folders + document summaries) by
 * buildDocumentTree().
 *
 * Unlike ExplorerTreeNode there is no loadState/lazy-children convention:
 * both lists are always fully loaded, so a folder's `children` is always an
 * array (possibly empty) and never undefined. Ids are backend GUIDs, so
 * `@for`'s `track` uses `node.id`.
 */
export interface DocumentTreeNode {
  readonly id: string;
  readonly name: string;
  readonly kind: 'folder' | 'document';
  /** The original list item -- present only on document nodes, for open/rename plumbing. */
  readonly document?: DocumentSummary;
  /** Sorted child nodes -- present only on folder nodes. */
  readonly children?: DocumentTreeNode[];
  /** Present only on folder nodes. */
  readonly expanded?: boolean;
}
