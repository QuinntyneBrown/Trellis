import { Component, EventEmitter, Input, Output } from '@angular/core';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';

/** Fixed per-level indent, in px, applied via [style.padding-left.px]. */
const INDENT_STEP_PX = 16;
/** Base left padding (depth 0), in px, so even root rows aren't flush against the panel edge. */
const BASE_PADDING_PX = 8;

/**
 * The custom dataTransfer type identifying a document-row drag, carrying the
 * document's id. A custom MIME type (not just text/plain) so folder rows and
 * the panel's root drop zone only light up for our own drags -- during
 * dragover only dataTransfer.types is readable (DnD protected mode), so the
 * type IS the identification.
 */
export const DOCUMENT_DRAG_TYPE = 'application/x-trellis-document-id';

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
 * Emitted when a document row is dropped onto a folder row. The target is
 * always a concrete folder id -- moves to the root go through the panel's
 * own root drop zone instead, which never involves a folder row.
 */
export interface MoveDocumentEvent {
  documentId: string;
  targetFolderId: string;
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
  imports: [DocumentTreeNodeComponent, TreeActionButtonComponent],
  templateUrl: './document-tree-node.component.html',
  styleUrl: './document-tree-node.component.scss',
})
export class DocumentTreeNodeComponent {
  @Input({ required: true }) node!: DocumentTreeNode;
  @Input() depth = 0;
  /** The id of the document currently open in the editor, or null -- this row highlights itself when it matches. */
  @Input() activeDocumentId: string | null = null;

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
  /** Fires when a document row is dropped onto this folder row, or is re-emitted, untouched, from a descendant row. */
  @Output() readonly moveDocument = new EventEmitter<MoveDocumentEvent>();
  /** Fires when this document row's "Move to Folder…" button is used (the panel owns the dialog), or is re-emitted from a descendant row. */
  @Output() readonly moveRequested = new EventEmitter<DocumentTreeNode>();
  /** Fires when this folder row's "Scope to this folder" button is used (the panel owns the scope state), or is re-emitted from a descendant row. */
  @Output() readonly scopeRequested = new EventEmitter<DocumentTreeNode>();
  /** Fires when this folder row's "Export folder as Markdown" button is used (the panel owns the fetch + download), or is re-emitted from a descendant row. */
  @Output() readonly exportRequested = new EventEmitter<DocumentTreeNode>();

  /** True while a document drag hovers this folder row -- drives the drop-target highlight. */
  isDragOver = false;
  /**
   * dragenter/dragleave fire per descendant element (chevron, name, buttons),
   * so a plain boolean would flicker off while crossing children. The counter
   * only clears the highlight once every entered element has been left.
   */
  private dragEnterCount = 0;

  get indentPx(): number {
    return BASE_PADDING_PX + this.depth * INDENT_STEP_PX;
  }

  /** True when this document row is the one currently open in the editor. */
  get isActive(): boolean {
    return this.node.kind === 'document' && this.activeDocumentId !== null && this.node.id === this.activeDocumentId;
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

  /** Opens the panel-owned "Move to Folder…" dialog -- the keyboard-accessible fallback to drag-and-drop. */
  onMoveClicked(event: MouseEvent): void {
    event.stopPropagation();
    this.moveRequested.emit(this.node);
  }

  /** Asks the panel to make this folder the tree's temporary root. */
  onScopeClicked(event: MouseEvent): void {
    event.stopPropagation();
    this.scopeRequested.emit(this.node);
  }

  /** Asks the panel to export this folder's subtree as one downloaded markdown file. */
  onExportClicked(event: MouseEvent): void {
    event.stopPropagation();
    this.exportRequested.emit(this.node);
  }

  /** Document rows are drag sources: the custom type carries the id, text/plain carries a human-readable name. */
  onDragStart(event: DragEvent): void {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.setData(DOCUMENT_DRAG_TYPE, this.node.id);
    event.dataTransfer.setData('text/plain', this.node.name);
    event.dataTransfer.effectAllowed = 'move';
  }

  onDragEnter(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    // preventDefault marks the row as a valid drop target; stopPropagation
    // keeps the panel's enclosing root drop zone from co-highlighting.
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCount++;
    this.isDragOver = true;
  }

  onDragOver(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    // Without preventDefault here the browser never fires drop at all.
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = 'move';
  }

  onDragLeave(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    event.stopPropagation();
    this.dragEnterCount = Math.max(0, this.dragEnterCount - 1);
    if (this.dragEnterCount === 0) {
      this.isDragOver = false;
    }
  }

  onDrop(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.dragEnterCount = 0;
    this.isDragOver = false;

    const documentId = event.dataTransfer!.getData(DOCUMENT_DRAG_TYPE);
    if (documentId) {
      this.moveDocument.emit({ documentId, targetFolderId: this.node.id });
    }
  }

  /**
   * Only dataTransfer.types is readable while a drag is in flight (protected
   * mode) -- the presence of our custom type is what identifies the drag as
   * one of our document rows rather than, say, a file from the OS.
   */
  private isDocumentDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes(DOCUMENT_DRAG_TYPE) ?? false;
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
