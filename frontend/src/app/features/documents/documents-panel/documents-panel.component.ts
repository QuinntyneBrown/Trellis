import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { Folder } from '../../../core/models/folder.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { FoldersService } from '../../../core/services/folders.service';
import { buildDocumentTree } from './build-document-tree';
import {
  CreateFolderEvent,
  DOCUMENT_DRAG_TYPE,
  DocumentTreeNodeComponent,
  MoveDocumentEvent,
  RenameNodeEvent,
} from '../document-tree-node/document-tree-node.component';
import {
  MoveDocumentDialogComponent,
  MoveDocumentDialogResult,
} from '../move-document-dialog/move-document-dialog.component';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';

/**
 * Slide-out panel for browsing saved documents from within the editor,
 * without leaving the editor route. This is the app's one and only
 * saved-documents surface, shown as a virtual folder tree (folders are
 * database rows, not disk directories).
 *
 * The container/presentational split mirrors the Explorer exactly: this
 * panel owns every folders/documents API call and the tree state, while the
 * recursive DocumentTreeNodeComponent rows are dumb and only bubble events
 * up. The tree is rebuilt from the two cached flat lists after every
 * mutation; which folders are expanded survives those rebuilds via
 * expandedFolderIds (keyed by folder id, so renames keep folders open, and
 * pruned on refresh so deleted folders don't linger in the set).
 */
@Component({
  selector: 'app-documents-panel',
  standalone: true,
  imports: [DocumentTreeNodeComponent, MoveDocumentDialogComponent, TreeActionButtonComponent],
  templateUrl: './documents-panel.component.html',
  styleUrl: './documents-panel.component.scss',
})
export class DocumentsPanelComponent implements OnChanges {
  @Input() open = false;

  @Output() readonly documentOpened = new EventEmitter<DocumentSummary>();

  private readonly documentsService = inject(DocumentsService);
  private readonly foldersService = inject(FoldersService);

  /** The two flat lists as last fetched -- the single source the tree is rebuilt from. */
  private folders: Folder[] = [];
  private documents: DocumentSummary[] = [];
  private readonly expandedFolderIds = new Set<string>();
  /** Monotonically increasing token so a slow earlier refresh can never clobber a newer one's state. */
  private refreshSequence = 0;

  readonly tree = signal<DocumentTreeNode[]>([]);
  /** The flat folder list exposed for the move dialog's destination select. */
  readonly folderList = signal<Folder[]>([]);
  /** The document node whose "Move to Folder…" dialog is open, or null when it's closed. */
  readonly movingDocument = signal<DocumentTreeNode | null>(null);

  /** True while a document drag hovers the tree's root space (not a folder row) -- drives the root drop-zone highlight. */
  isRootDragOver = false;
  /** Same child-element enter/leave counting the tree rows use -- see DocumentTreeNodeComponent.dragEnterCount. */
  private rootDragEnterCount = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.refresh();
    }
  }

  refresh(): void {
    const refreshToken = ++this.refreshSequence;

    forkJoin([this.foldersService.list(), this.documentsService.list()]).subscribe(([folders, documents]) => {
      if (refreshToken !== this.refreshSequence) {
        return;
      }

      this.folders = folders;
      this.documents = documents;
      this.folderList.set(folders);

      // Prune ids of folders that no longer exist (deleted here or elsewhere)
      // so the set can't grow stale entries forever.
      const folderIds = new Set(folders.map((folder) => folder.id));
      for (const id of [...this.expandedFolderIds]) {
        if (!folderIds.has(id)) {
          this.expandedFolderIds.delete(id);
        }
      }

      this.rebuildTree();
    });
  }

  /** Expand/collapse is pure local state -- rebuilt from the cached lists, no HTTP. */
  onToggleExpand(node: DocumentTreeNode): void {
    if (this.expandedFolderIds.has(node.id)) {
      this.expandedFolderIds.delete(node.id);
    } else {
      this.expandedFolderIds.add(node.id);
    }
    this.rebuildTree();
  }

  onOpenDocument(document: DocumentSummary): void {
    this.documentOpened.emit(document);
  }

  /** The panel header's New Folder button creates at the root; per-row buttons create subfolders. */
  onHeaderNewFolderClicked(): void {
    const name = window.prompt('New folder name')?.trim();
    if (name) {
      this.createFolder(null, name);
    }
  }

  onCreateFolder(event: CreateFolderEvent): void {
    this.createFolder(event.parentId, event.name);
  }

  onRenameNode(event: RenameNodeEvent): void {
    // Typed as unknown: the two branches return different payloads
    // (Folder vs Document) and only the completion matters here.
    const rename$: Observable<unknown> =
      event.node.kind === 'folder'
        ? this.foldersService.rename(event.node.id, event.newName)
        : this.documentsService.rename(event.node.id, event.newName);

    rename$.subscribe(() => this.refresh());
  }

  onDeleteNode(node: DocumentTreeNode): void {
    const delete$ =
      node.kind === 'folder' ? this.foldersService.delete(node.id) : this.documentsService.delete(node.id);

    delete$.subscribe(() => this.refresh());
  }

  /**
   * The single move entry point every UI funnels into -- folder-row drops,
   * root-zone drops, and the move dialog alike. The same-folder no-op guard
   * lives here (not in the rows) because only the panel has the cached flat
   * documents list, and dataTransfer.getData is unreadable during dragover
   * anyway (DnD protected mode).
   */
  onMoveDocument(documentId: string, targetFolderId: string | null): void {
    const document = this.documents.find((d) => d.id === documentId);
    if (!document || (document.folderId ?? null) === targetFolderId) {
      return;
    }

    this.documentsService.move(documentId, targetFolderId).subscribe(() => {
      // Pre-expand the destination so the just-moved document is immediately
      // visible once the refresh lands (same idiom as createFolder).
      if (targetFolderId) {
        this.expandedFolderIds.add(targetFolderId);
      }
      this.refresh();
    });
  }

  onMoveDocumentDropped(event: MoveDocumentEvent): void {
    this.onMoveDocument(event.documentId, event.targetFolderId);
  }

  onMoveRequested(node: DocumentTreeNode): void {
    this.movingDocument.set(node);
  }

  onMoveDialogConfirm(result: MoveDocumentDialogResult): void {
    const node = this.movingDocument();
    if (node) {
      this.onMoveDocument(node.id, result.folderId);
    }
    this.movingDocument.set(null);
  }

  onMoveDialogCancel(): void {
    this.movingDocument.set(null);
  }

  /**
   * The tree container doubles as the "move to root" drop zone. Folder rows
   * stopPropagation on their own drag events, so these handlers only ever see
   * drags over non-folder space (below the last row, or over document rows).
   */
  onRootDragEnter(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    event.preventDefault();
    this.rootDragEnterCount++;
    this.isRootDragOver = true;
  }

  onRootDragOver(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
  }

  onRootDragLeave(): void {
    this.rootDragEnterCount = Math.max(0, this.rootDragEnterCount - 1);
    if (this.rootDragEnterCount === 0) {
      this.isRootDragOver = false;
    }
  }

  onRootDrop(event: DragEvent): void {
    if (!this.isDocumentDrag(event)) {
      return;
    }
    event.preventDefault();
    this.rootDragEnterCount = 0;
    this.isRootDragOver = false;

    const documentId = event.dataTransfer!.getData(DOCUMENT_DRAG_TYPE);
    if (documentId) {
      this.onMoveDocument(documentId, null);
    }
  }

  private isDocumentDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes(DOCUMENT_DRAG_TYPE) ?? false;
  }

  private createFolder(parentFolderId: string | null, name: string): void {
    this.foldersService.create({ name, parentFolderId }).subscribe(() => {
      // Pre-expand the parent so the just-created subfolder is immediately
      // visible once the refresh lands.
      if (parentFolderId) {
        this.expandedFolderIds.add(parentFolderId);
      }
      this.refresh();
    });
  }

  private rebuildTree(): void {
    this.tree.set(buildDocumentTree(this.folders, this.documents, this.expandedFolderIds));
  }
}
