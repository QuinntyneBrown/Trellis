import { Component, EventEmitter, Input, Output } from '@angular/core';

import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';

/** Fixed per-level indent, in px, applied via [style.padding-left.px]. */
const INDENT_STEP_PX = 16;
/** Base left padding (depth 0), in px, so even root rows aren't flush against the panel edge. */
const BASE_PADDING_PX = 8;

/** Emitted by FileTreeNodeComponent's New File/New Folder row buttons. */
export interface CreateEntryEvent {
  parent: ExplorerTreeNode;
  name: string;
  kind: 'file' | 'directory';
}

/** Emitted by FileTreeNodeComponent's Delete row button. */
export interface DeleteEntryEvent {
  node: ExplorerTreeNode;
  parentNode: ExplorerTreeNode;
}

/**
 * Recursive, deliberately "dumb" tree row.
 *
 * Renders exactly one ExplorerTreeNode plus -- when it's an expanded
 * directory with already-loaded children -- one nested `<app-file-tree-node>`
 * per child, by importing itself (Angular standalone components support
 * self-import for exactly this recursive-tree case).
 *
 * Never performs any disk I/O itself and never injects
 * FileSystemAccessService: every toggleExpand/fileClicked/createFile/
 * createFolder/deleteEntry event is simply bubbled up (directly, or
 * re-emitted from a nested child instance) to ExplorerPanelComponent, which
 * centralizes all File System Access calls and owns the tree's actual node
 * state. The New File/New Folder/Delete row buttons use native
 * window.prompt()/window.confirm() for naming/confirmation -- the app-wide
 * convention, shared with DocumentTreeNodeComponent -- rather than an inline
 * editable tree row.
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
  /** The actual parent ExplorerTreeNode, or null when this row is the tree's true root (which has no deletable parent). */
  @Input() parentNode: ExplorerTreeNode | null = null;

  /** Fires for this row (directory) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly toggleExpand = new EventEmitter<ExplorerTreeNode>();
  /** Fires for this row (file) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly fileClicked = new EventEmitter<ExplorerTreeNode>();
  /** Fires when this row's "New File"/"New Folder" button is used (the event's `kind` discriminates), or is re-emitted, untouched, from a descendant row. */
  @Output() readonly createEntry = new EventEmitter<CreateEntryEvent>();
  /** Fires when this row's "Delete" button is used, or is re-emitted, untouched, from a descendant row. */
  @Output() readonly deleteEntry = new EventEmitter<DeleteEntryEvent>();

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

  /**
   * Prompts for a new file name via the native window.prompt -- the app-wide
   * convention, rather than an inline editable tree row.
   * event.stopPropagation() runs first so this button click never also
   * triggers the row's own (click), which would otherwise
   * toggle-expand/open this directory/file.
   */
  onNewFileClicked(event: MouseEvent): void {
    event.stopPropagation();
    const name = window.prompt('New file name')?.trim();
    if (name) {
      this.createEntry.emit({ parent: this.node, name, kind: 'file' });
    }
  }

  /** Identical shape to onNewFileClicked, for a new subdirectory instead. */
  onNewFolderClicked(event: MouseEvent): void {
    event.stopPropagation();
    const name = window.prompt('New folder name')?.trim();
    if (name) {
      this.createEntry.emit({ parent: this.node, name, kind: 'directory' });
    }
  }

  /**
   * Confirms via the native window.confirm -- the app-wide convention.
   * No-ops when parentNode is null: shouldn't be reachable since the
   * Delete button itself is never rendered at the true root, but this
   * guards defensively against a stray call.
   */
  onDeleteClicked(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.parentNode) {
      return;
    }

    const message =
      this.node.kind === 'directory'
        ? `Delete "${this.node.name}" and everything inside it? This cannot be undone.`
        : `Delete "${this.node.name}"? This cannot be undone.`;

    if (window.confirm(message)) {
      this.deleteEntry.emit({ node: this.node, parentNode: this.parentNode });
    }
  }
}
