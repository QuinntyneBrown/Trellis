import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';

/** Emitted by FileTreeNodeComponent's Delete row button. */
export interface DeleteEntryEvent {
  node: ExplorerTreeNode;
  parentNode: ExplorerTreeNode;
}
