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
  DocumentTreeNodeComponent,
  RenameNodeEvent,
} from '../document-tree-node/document-tree-node.component';

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
  imports: [DocumentTreeNodeComponent],
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
