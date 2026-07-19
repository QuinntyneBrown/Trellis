import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { ExplainPrompt } from '../../../core/models/explain-prompt.model';
import { Folder } from '../../../core/models/folder.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { EditorLayoutPreferencesService } from '../../../core/services/editor-layout-preferences.service';
import { ExplainService } from '../../../core/services/explain.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { FoldersService } from '../../../core/services/folders.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { buildDocumentTree } from './build-document-tree';
import { collectDescendantFolderIds } from './collect-descendant-folder-ids';
import {
  CreateFolderEvent,
  DOCUMENT_DRAG_TYPE,
  DocumentTreeNodeComponent,
  MoveDocumentEvent,
  RenameNodeEvent,
} from '../document-tree-node/document-tree-node.component';
import {
  ExportFolderDialogComponent,
  ExportFolderDialogResult,
} from '../export-folder-dialog/export-folder-dialog.component';
import {
  MoveDocumentDialogComponent,
  MoveDocumentDialogResult,
} from '../move-document-dialog/move-document-dialog.component';
import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';
import { TreeContextMenuComponent } from '../../../shared/components/tree-context-menu/tree-context-menu.component';
import {
  TreeContextMenuItem,
  TreeContextMenuRequest,
} from '../../../shared/components/tree-context-menu/tree-context-menu.model';

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
  imports: [
    DocumentTreeNodeComponent,
    ErrorBannerComponent,
    ExportFolderDialogComponent,
    MoveDocumentDialogComponent,
    TreeActionButtonComponent,
    TreeContextMenuComponent,
  ],
  templateUrl: './documents-panel.component.html',
  styleUrl: './documents-panel.component.scss',
})
export class DocumentsPanelComponent implements OnChanges {
  @Input() open = false;
  /** The id of the document currently open in the editor, or null -- highlights that row in the tree. */
  @Input() activeDocumentId: string | null = null;

  @Output() readonly documentOpened = new EventEmitter<DocumentSummary>();
  /** Fires when "Explain This" generated a prompt for a folder; the editor page loads it as an unsaved markdown document. */
  @Output() readonly promptGenerated = new EventEmitter<ExplainPrompt>();

  private readonly documentsService = inject(DocumentsService);
  private readonly foldersService = inject(FoldersService);
  private readonly layoutPreferences = inject(EditorLayoutPreferencesService);
  private readonly fileDownloadService = inject(FileDownloadService);
  private readonly explainService = inject(ExplainService);

  /** The two flat lists as last fetched -- the single source the tree is rebuilt from. */
  private folders: Folder[] = [];
  private documents: DocumentSummary[] = [];
  private readonly expandedFolderIds = new Set<string>();
  /** Monotonically increasing token so a slow earlier refresh can never clobber a newer one's state. */
  private refreshSequence = 0;
  /**
   * Set on every closed->open transition (including the persisted-open boot
   * after a browser refresh): the next refresh expands the active document's
   * ancestor folder chain so its highlighted row is actually visible -- the
   * VS Code reveal-active-file idiom. Reveal happens on open ONLY: a folder
   * the user deliberately collapsed must not be fought on every mutation
   * refresh while the panel stays open.
   */
  private revealActiveOnNextRefresh = false;
  /**
   * The folder currently scoping the tree (only its subtree is shown), or
   * null for the full tree. Seeded from the persisted preference at
   * construction so a scope survives reloads like the rest of the panel
   * state; a stale id (folder since deleted) is pruned on the next refresh.
   */
  private scopedFolderId: string | null = this.layoutPreferences.getDocumentsScopeFolderId();

  readonly tree = signal<DocumentTreeNode[]>([]);
  /**
   * The scoped folder's resolved row, or null when unscoped (or before the
   * first refresh lands) -- gives the scope bar its label and the up-handler
   * its parentFolderId. Re-resolved on every rebuild so a rename while
   * scoped updates the label through the ordinary rename->refresh path.
   */
  readonly scopedFolder = signal<Folder | null>(null);
  /** The flat folder list exposed for the move dialog's destination select. */
  readonly folderList = signal<Folder[]>([]);
  /** The document node whose "Move to Folder…" dialog is open, or null when it's closed. */
  readonly movingDocument = signal<DocumentTreeNode | null>(null);
  /** The folder node whose export dialog is open, or null when it's closed. */
  readonly exportingFolder = signal<DocumentTreeNode | null>(null);
  /** Surfaced through app-error-banner when a folder "Explain This" request fails (for example, an empty folder). */
  readonly explainError = signal<string | null>(null);
  readonly contextMenuRequest = signal<TreeContextMenuRequest<DocumentTreeNode | null> | null>(null);

  // A computed, not a getter: the menu's [items] binding needs a stable
  // array reference for the lifetime of one open. A getter would mint a new
  // array on every change-detection pass, which the menu's ngOnChanges sees
  // as a fresh change each tick -- the feedback loop that used to wedge the
  // tab (see TreeContextMenuComponent.ngOnChanges).
  readonly contextMenuItems = computed<TreeContextMenuItem[]>(() => {
    const request = this.contextMenuRequest();
    if (!request) {
      return [];
    }
    const node = request.target;
    if (!node) {
      return [{ id: 'new-folder', label: 'New Folder' }];
    }
    if (node.kind === 'folder') {
      return [
        { id: 'new-folder', label: 'New Folder' },
        { id: 'scope', label: 'Scope to This Folder', separatorBefore: true },
        { id: 'export', label: 'Export Folder as Markdown' },
        { id: 'explain', label: 'Explain This' },
        { id: 'rename', label: 'Rename', separatorBefore: true },
        { id: 'delete', label: 'Delete', danger: true },
      ];
    }
    return [
      { id: 'open', label: 'Open' },
      { id: 'move', label: 'Move to Folder…' },
      {
        id: 'toggle-export',
        label: node.document?.excludedFromExport ? 'Include in Export' : 'Exclude from Export',
        separatorBefore: true,
      },
      { id: 'rename', label: 'Rename', separatorBefore: true },
      { id: 'delete', label: 'Delete', danger: true },
    ];
  });

  /** True while a document drag hovers the tree's root space (not a folder row) -- drives the root drop-zone highlight. */
  isRootDragOver = false;
  /** Same child-element enter/leave counting the tree rows use -- see DocumentTreeNodeComponent.dragEnterCount. */
  private rootDragEnterCount = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue === true) {
      this.revealActiveOnNextRefresh = true;
      this.refresh();
    } else if (changes['open']?.currentValue === false) {
      this.closeContextMenu(false);
    }
  }

  refresh(): void {
    this.closeContextMenu(false);
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

      // The scoped folder can vanish too (deleted, or cascade-deleted with an
      // ancestor -- possibly from another tab): fall back to the full tree
      // rather than rendering a dead scope forever. Before the reveal step so
      // a reveal never runs against a scope that no longer exists.
      if (this.scopedFolderId !== null && !folderIds.has(this.scopedFolderId)) {
        this.scopedFolderId = null;
        this.layoutPreferences.setDocumentsScopeFolderId(null);
      }

      if (this.revealActiveOnNextRefresh) {
        this.revealActiveOnNextRefresh = false;
        this.expandActiveDocumentAncestors();
      }

      this.rebuildTree();
    });
  }

  /**
   * Expands every ancestor folder of the active document so its row is
   * visible. Walks the parentFolderId chain from the cached flat lists,
   * with a visited-set guard so corrupt data (a folder cycle) can't loop
   * forever. A no-op when nothing is active, the active document is
   * unknown, it already sits at the root, or a scope is active and the
   * document lives outside it -- there's no visible row to reveal then, and
   * the scope (an explicit user choice) must not be auto-cleared by a
   * reveal that runs on every persisted-open boot.
   */
  private expandActiveDocumentAncestors(): void {
    const activeId = this.activeDocumentId;
    if (!activeId) {
      return;
    }
    const document = this.documents.find((d) => d.id === activeId);
    if (!document) {
      return;
    }

    const foldersById = new Map(this.folders.map((folder) => [folder.id, folder]));
    const chain: string[] = [];
    let folderId: string | null = document.folderId;
    while (folderId && !chain.includes(folderId)) {
      chain.push(folderId);
      folderId = foldersById.get(folderId)?.parentFolderId ?? null;
    }

    if (this.scopedFolderId !== null && !chain.includes(this.scopedFolderId)) {
      return;
    }

    for (const id of chain) {
      this.expandedFolderIds.add(id);
    }
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

  onContextMenuRequested(request: TreeContextMenuRequest<DocumentTreeNode | null>): void {
    this.contextMenuRequest.set(request);
  }

  onTreeContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuRequest.set({
      target: null,
      clientX: event.clientX,
      clientY: event.clientY,
      triggerElement: event.currentTarget as HTMLElement,
    });
  }

  onTreeKeydown(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.contextMenuRequest.set({ target: null, clientX: rect.left + 24, clientY: rect.top + 24, triggerElement: trigger });
    }
  }

  onContextMenuCommand(command: string): void {
    const request = this.contextMenuRequest();
    if (!request) {
      return;
    }
    const node = request.target;
    // A selected command takes over focus itself (for example, the move
    // dialog or an opened document). Restoring focus while its menu button
    // is still handling the click can leave browser automation -- and some
    // assistive technology -- attached to a removed control. Escape remains
    // the path that deliberately returns focus to the originating row.
    this.closeContextMenu(false);

    switch (command) {
      case 'new-folder':
        this.promptForFolder(node?.kind === 'folder' ? node.id : this.scopedFolderId);
        break;
      case 'open':
        if (node?.kind === 'document') this.onOpenDocument(node.document!);
        break;
      case 'move':
        if (node?.kind === 'document') this.onMoveRequested(node);
        break;
      case 'toggle-export':
        if (node?.kind === 'document') this.onToggleExportExclusion(node);
        break;
      case 'scope':
        if (node?.kind === 'folder') this.onScopeToFolder(node);
        break;
      case 'export':
        if (node?.kind === 'folder') this.onExportFolder(node);
        break;
      case 'explain':
        if (node?.kind === 'folder') this.onExplainFolder(node);
        break;
      case 'rename':
        if (node) {
          this.promptForRename(node);
        }
        break;
      case 'delete':
        if (node) {
          this.confirmDelete(node);
        }
        break;
    }
  }

  closeContextMenu(restoreFocus: boolean): void {
    const trigger = this.contextMenuRequest()?.triggerElement;
    this.contextMenuRequest.set(null);
    if (restoreFocus) {
      trigger?.focus();
    }
  }

  /**
   * The panel header's New Folder button creates at the visible root -- the
   * true root normally, the scoped folder while a scope is active (creating
   * at the true root then would make an invisible folder); per-row buttons
   * create subfolders.
   */
  onHeaderNewFolderClicked(): void {
    this.promptForFolder(this.scopedFolderId);
  }

  /** A folder row's "Scope to this folder" button: that folder becomes the tree's temporary root. */
  onScopeToFolder(node: DocumentTreeNode): void {
    this.setScope(node.id);
  }

  /** The scope bar's Up button: re-scope to the parent, or clear entirely when the scope sits at the root. */
  onScopeUp(): void {
    this.setScope(this.scopedFolder()?.parentFolderId ?? null);
  }

  /** The scope bar's "Show all documents" button. */
  onScopeClear(): void {
    this.setScope(null);
  }

  /** A folder row's "Export folder as Markdown" button opens the export dialog. */
  onExportFolder(node: DocumentTreeNode): void {
    this.exportingFolder.set(node);
  }

  /**
   * The export dialog's Export button: fetches the subtree aggregated
   * server-side (with or without excluded documents, per the dialog's
   * checkbox) and hands it to the browser as a "&lt;folder-name&gt;.md" download.
   */
  onExportDialogConfirm(result: ExportFolderDialogResult): void {
    const node = this.exportingFolder();
    if (node) {
      this.foldersService.exportFolder(node.id, result.includeExcluded).subscribe((markdown) => {
        this.fileDownloadService.downloadTextFile(`${node.name}.md`, markdown);
      });
    }
    this.exportingFolder.set(null);
  }

  onExportDialogCancel(): void {
    this.exportingFolder.set(null);
  }

  /**
   * A folder row's "Explain This" command: aggregates every document in the
   * folder and its subfolders server-side into an LLM "Explain This" prompt,
   * then downloads the source attachment the prompt references and hands the
   * prompt itself up to the editor page (which loads it as an unsaved markdown
   * document) -- the same two-part result as the Explain This panel, but
   * sourced from a saved folder instead of a picked file/folder or URL.
   */
  onExplainFolder(node: DocumentTreeNode): void {
    this.explainError.set(null);
    this.explainService.aggregateFolder(node.id).subscribe({
      next: (prompt) => {
        this.fileDownloadService.downloadTextFile(prompt.attachmentFileName, prompt.attachmentContent);
        this.promptGenerated.emit(prompt);
      },
      error: (error: unknown) => this.explainError.set(explainErrorMessage(error)),
    });
  }

  /** A document row's export-exclusion toggle: flip the flag, then refresh so the badge and future exports agree. */
  onToggleExportExclusion(node: DocumentTreeNode): void {
    const excluded = node.document?.excludedFromExport ?? false;
    this.documentsService.setExportExclusion(node.id, !excluded).subscribe(() => this.refresh());
  }

  /**
   * Scope changes are pure local state over the cached lists -- rebuilt, not
   * refetched, exactly like expand/collapse. The folder just left behind is
   * pre-expanded so scoping up/out keeps the subtree you were working in
   * visible instead of collapsing it back to a closed row.
   */
  private setScope(folderId: string | null): void {
    const previousScopeId = this.scopedFolderId;
    this.scopedFolderId = folderId;
    this.layoutPreferences.setDocumentsScopeFolderId(folderId);
    if (previousScopeId !== null) {
      this.expandedFolderIds.add(previousScopeId);
    }
    this.rebuildTree();
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

  private promptForFolder(parentFolderId: string | null): void {
    const name = window.prompt('New folder name')?.trim();
    if (name) {
      this.createFolder(parentFolderId, name);
    }
  }

  private promptForRename(node: DocumentTreeNode): void {
    const label = node.kind === 'folder' ? 'Rename folder' : 'Rename document';
    const newName = window.prompt(label, node.name)?.trim();
    if (newName && newName !== node.name) {
      this.onRenameNode({ node, newName });
    }
  }

  private confirmDelete(node: DocumentTreeNode): void {
    const message =
      node.kind === 'folder'
        ? `Delete "${node.name}" and everything inside it? This cannot be undone.`
        : `Delete "${node.name}"? This cannot be undone.`;
    if (window.confirm(message)) {
      this.onDeleteNode(node);
    }
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
   * The tree container doubles as the "move to root" drop zone (root of the
   * scope while one is active). Folder rows stopPropagation on their own drag
   * events, so these handlers only ever see drags over non-folder space
   * (below the last row, or over document rows).
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
      // While scoped, "root" means the visible root -- the scoped folder --
      // so a drop into empty space never makes the document vanish from view.
      this.onMoveDocument(documentId, this.scopedFolderId);
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

  /**
   * Rebuilds the tree signal from the cached flat lists. While scoped, both
   * lists are pre-filtered to the scope's subtree with the scoped folder
   * itself EXCLUDED from the folders list: buildDocumentTree attaches any
   * node whose parent is missing from that list to the root, so the scope's
   * direct children are promoted to visible roots for free -- the builder
   * stays untouched. scopedFolder is re-resolved here, the single choke
   * point, so refreshes (including renames) and local scope changes all
   * update the scope bar.
   */
  private rebuildTree(): void {
    const scopeId = this.scopedFolderId;
    if (scopeId === null) {
      this.scopedFolder.set(null);
      this.tree.set(buildDocumentTree(this.folders, this.documents, this.expandedFolderIds));
      return;
    }

    const scopedIds = collectDescendantFolderIds(this.folders, scopeId);
    const folders = this.folders.filter((folder) => scopedIds.has(folder.id) && folder.id !== scopeId);
    const documents = this.documents.filter(
      (document) => document.folderId !== null && scopedIds.has(document.folderId),
    );

    this.scopedFolder.set(this.folders.find((folder) => folder.id === scopeId) ?? null);
    this.tree.set(buildDocumentTree(folders, documents, this.expandedFolderIds));
  }
}

/**
 * Prefers the ProblemDetails title the backend puts on a 400 (an empty folder
 * has no documents to explain), falling back to a generic message.
 */
function explainErrorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const problem = error.error as { title?: unknown } | null;
    if (problem && typeof problem.title === 'string' && problem.title.trim() !== '') {
      return problem.title;
    }
    return 'Generating the prompt failed. Check the server is running and try again.';
  }
  return 'Something went wrong generating the prompt.';
}
