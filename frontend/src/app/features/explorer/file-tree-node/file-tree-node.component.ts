import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';

/** Fixed per-level indent, in px, applied via [style.padding-left.px]. */
const INDENT_STEP_PX = 16;
/** Base left padding (depth 0), in px, so even root rows aren't flush against the panel edge. */
const BASE_PADDING_PX = 8;

/**
 * Recursive, deliberately "dumb" tree row.
 *
 * Renders exactly one ExplorerTreeNode plus -- when it's an expanded
 * directory with already-loaded children -- one nested `<app-file-tree-node>`
 * per child, by importing itself (Angular standalone components support
 * self-import for exactly this recursive-tree case).
 *
 * Never performs any disk I/O itself and never injects
 * FileSystemAccessService: every toggleExpand/fileClicked event is simply
 * bubbled up (directly, or re-emitted from a nested child instance) to
 * ExplorerPanelComponent, which centralizes all File System Access calls and
 * owns the tree's actual node state.
 */
@Component({
  selector: 'app-file-tree-node',
  standalone: true,
  imports: [FileTreeNodeComponent],
  templateUrl: './file-tree-node.component.html',
  styleUrl: './file-tree-node.component.scss',
})
export class FileTreeNodeComponent {
  @Input({ required: true }) node!: ExplorerTreeNode;
  @Input() depth = 0;

  /** Fires for this row (directory) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly toggleExpand = new EventEmitter<ExplorerTreeNode>();
  /** Fires for this row (file) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly fileClicked = new EventEmitter<ExplorerTreeNode>();

  get indentPx(): number {
    return BASE_PADDING_PX + this.depth * INDENT_STEP_PX;
  }

  onRowClick(): void {
    if (this.node.kind === 'directory') {
      this.toggleExpand.emit(this.node);
    } else {
      this.fileClicked.emit(this.node);
    }
  }
}
