import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';

/** Emitted by FileTreeNodeComponent's New File/New Folder row buttons. */
export interface CreateEntryEvent {
  parent: ExplorerTreeNode;
  name: string;
}
