import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';

/** Fixed per-level indent, in px, applied via [style.padding-left.px]. */
const INDENT_STEP_PX = 16;
/** Base left padding (depth 0), in px, so even root rows aren't flush against the panel edge. */
const BASE_PADDING_PX = 8;

/** Emitted by DocumentTreeNodeComponent's New Folder row button. */
export interface CreateFolderEvent {
  /** The parent folder's id -- always this row's own id (root creation lives on the panel header). */
  parentId: string;
  name: string;
}

/** Emitted by DocumentTreeNodeComponent's Rename row button, for folders and documents alike. */
export interface RenameNodeEvent {
  node: DocumentTreeNode;
  newName: string;
}

/**
 * Recursive, deliberately "dumb" tree row for the Documents panel's virtual
 * folder tree -- the Documents-panel sibling of the Explorer's
 * FileTreeNodeComponent, mirroring its shape exactly: renders one
 * DocumentTreeNode plus (when it's an expanded folder) one nested
 * `<app-document-tree-node>` per child via standalone self-import.
 *
 * Never performs any HTTP itself and never injects a service: every
 * toggleExpand/openDocument/createFolder/renameNode/deleteNode event is
 * simply bubbled up (directly, or re-emitted from a nested child instance)
 * to DocumentsPanelComponent, which centralizes all folder/document API
 * calls and owns the tree state. Row actions use native
 * window.prompt()/window.confirm() -- the app-wide convention.
 *
 * Document rows keep the flat list's data-testid contract (`document-item`,
 * `data-document-name`, `document-item-open/rename/delete`) so the existing
 * e2e suite keeps passing; folder rows introduce the `document-folder`
 * testids.
 */
@Component({
  selector: 'app-document-tree-node',
  standalone: true,
  imports: [DocumentTreeNodeComponent],
  templateUrl: './document-tree-node.component.html',
  styleUrl: './document-tree-node.component.scss',
})
export class DocumentTreeNodeComponent {
  @Input({ required: true }) node!: DocumentTreeNode;
  @Input() depth = 0;

  /** Fires for this row (folder) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly toggleExpand = new EventEmitter<DocumentTreeNode>();
  /** Fires for this row (document) or is re-emitted, untouched, from a descendant row. */
  @Output() readonly openDocument = new EventEmitter<DocumentSummary>();
  /** Fires when this row's "New Folder" button is used, or is re-emitted, untouched, from a descendant row. */
  @Output() readonly createFolder = new EventEmitter<CreateFolderEvent>();
  /** Fires when this row's "Rename" button is used, or is re-emitted, untouched, from a descendant row. */
  @Output() readonly renameNode = new EventEmitter<RenameNodeEvent>();
  /** Fires when this row's "Delete" button is used, or is re-emitted, untouched, from a descendant row. */
  @Output() readonly deleteNode = new EventEmitter<DocumentTreeNode>();

  get indentPx(): number {
    return BASE_PADDING_PX + this.depth * INDENT_STEP_PX;
  }

  onRowClick(): void {
    if (this.node.kind === 'folder') {
      this.toggleExpand.emit(this.node);
    } else {
      this.openDocument.emit(this.node.document!);
    }
  }

  /** event.stopPropagation() runs first so the button click never also triggers the row's own (click). */
  onOpenClicked(event: MouseEvent): void {
    event.stopPropagation();
    this.openDocument.emit(this.node.document!);
  }

  /** Prompts for a subfolder name via the native window.prompt -- the app-wide convention. */
  onNewFolderClicked(event: MouseEvent): void {
    event.stopPropagation();
    const name = window.prompt('New folder name')?.trim();
    if (name) {
      this.createFolder.emit({ parentId: this.node.id, name });
    }
  }

  /** Seeds the prompt with the current name; a blank or unchanged answer is a no-op. */
  onRenameClicked(event: MouseEvent): void {
    event.stopPropagation();
    const label = this.node.kind === 'folder' ? 'Rename folder' : 'Rename document';
    const newName = window.prompt(label, this.node.name)?.trim();
    if (newName && newName !== this.node.name) {
      this.renameNode.emit({ node: this.node, newName });
    }
  }

  /** Deleting a folder warns about the cascade -- everything inside goes with it. */
  onDeleteClicked(event: MouseEvent): void {
    event.stopPropagation();

    const message =
      this.node.kind === 'folder'
        ? `Delete "${this.node.name}" and everything inside it? This cannot be undone.`
        : `Delete "${this.node.name}"? This cannot be undone.`;

    if (window.confirm(message)) {
      this.deleteNode.emit(this.node);
    }
  }
}
