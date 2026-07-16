import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';

import { DirectoryChildEntry } from '../../../core/models/directory-child-entry.model';
import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { OpenedDiskFile } from '../../../core/models/opened-disk-file.model';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { TreeContextMenuComponent } from '../../../shared/components/tree-context-menu/tree-context-menu.component';
import {
  TreeContextMenuItem,
  TreeContextMenuRequest,
} from '../../../shared/components/tree-context-menu/tree-context-menu.model';
import {
  CreateEntryEvent,
  DeleteEntryEvent,
  ExplorerContextTarget,
  FileTreeNodeComponent,
} from '../file-tree-node/file-tree-node.component';

/**
 * Case-insensitive but accent-SENSITIVE name equality for the
 * duplicate-name pre-check inside createEntry: "readme.md" duplicates
 * "README.md", but "resume.puml" is a legitimately different name from
 * "résumé.puml" (sensitivity 'base' would wrongly fold the accents away
 * and reject it).
 */
function sameNameCaseInsensitive(a: string, b: string): boolean {
  return a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;
}

/**
 * VS Code-style Explorer panel: opens a local folder via the File System
 * Access API, renders it as a lazily-loaded tree, and emits file contents
 * up to EditorPageComponent when a file row is clicked.
 *
 * Centralizes every File System Access call here -- FileTreeNodeComponent
 * (the recursive row renderer) is a purely presentational, I/O-free "dumb"
 * component that only bubbles toggleExpand/fileClicked/createFile/
 * createFolder/deleteEntry events back up.
 */
@Component({
  selector: 'app-explorer-panel',
  standalone: true,
  imports: [ErrorBannerComponent, LoadingSpinnerComponent, FileTreeNodeComponent, TreeContextMenuComponent],
  templateUrl: './explorer-panel.component.html',
  styleUrl: './explorer-panel.component.scss',
})
export class ExplorerPanelComponent implements OnInit {
  private readonly fileSystemAccessService = inject(FileSystemAccessService);

  @Output() readonly fileOpened = new EventEmitter<OpenedDiskFile>();
  /** Emitted only for a file delete (never a directory delete) so EditorPageComponent can reset an open, now-gone file. */
  @Output() readonly fileDeleted = new EventEmitter<FileSystemFileHandle>();

  /** Computed once -- the browser either has this API or it doesn't, for the whole session. */
  readonly isSupported = this.fileSystemAccessService.isSupported();

  // A plain mutable field, mutated in place: zone.js's default change
  // detection re-checks the tree bindings after every event anyway, so no
  // signal/immutable-update machinery is needed. NOTE: this couples the
  // tree to zone.js CD -- an OnPush/zoneless migration would need to
  // reintroduce signals or immutable updates here.
  rootNode: ExplorerTreeNode | null = null;
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** True when a previously-opened root was restored from IndexedDB but its permission has lapsed to 'prompt'. */
  readonly needsReconnect = signal(false);
  readonly contextMenuRequest = signal<TreeContextMenuRequest<ExplorerContextTarget> | null>(null);

  get contextMenuItems(): TreeContextMenuItem[] {
    const target = this.contextMenuRequest()?.target;
    if (!target) {
      return [];
    }
    if (target.node.kind === 'directory') {
      return [
        { id: 'new-file', label: 'New File' },
        { id: 'new-folder', label: 'New Folder' },
        ...(target.parentNode
          ? [{ id: 'delete', label: 'Delete', separatorBefore: true, danger: true } satisfies TreeContextMenuItem]
          : []),
      ];
    }
    return [
      { id: 'open', label: 'Open' },
      { id: 'delete', label: 'Delete', separatorBefore: true, danger: true },
    ];
  }

  ngOnInit(): void {
    if (!this.isSupported) {
      // Never call any File System Access method in an unsupported browser.
      return;
    }

    void this.initializeFromStoredHandle();
  }

  /**
   * Auto-reopen path: only ever triggered by a previously *saved* handle
   * (see FileSystemAccessService.saveRootHandle), never by calling
   * showDirectoryPicker() itself -- that only ever happens in direct
   * response to the explicit "Open Folder" button click below.
   */
  private async initializeFromStoredHandle(): Promise<void> {
    this.isLoading.set(true);
    try {
      const handle = await this.fileSystemAccessService.loadRootHandle();
      if (!handle) {
        return;
      }

      const permission = await this.fileSystemAccessService.queryPermission(handle, 'readwrite');
      if (permission === 'granted') {
        await this.populateRoot(handle);
        return;
      }

      // 'prompt' (or a lapsed/denied grant) -- show the folder's name
      // (readable without any permission) behind a Reconnect button rather
      // than silently calling requestPermission with no user gesture to
      // satisfy the browser, or silently falling back to the Open Folder
      // button and hiding that a previously chosen folder exists.
      this.rootNode = unloadedRootNode(handle);
      this.needsReconnect.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onOpenFolderClicked(): Promise<void> {
    this.errorMessage.set(null);
    const handle = await this.fileSystemAccessService.pickDirectory();
    if (!handle) {
      // User cancelled the native picker -- not an error.
      return;
    }

    this.isLoading.set(true);
    try {
      // Saved so it can be auto-reopened on a later visit -- see
      // initializeFromStoredHandle above.
      await this.fileSystemAccessService.saveRootHandle(handle);
      await this.populateRoot(handle);
    } finally {
      this.isLoading.set(false);
    }
  }

  async onReconnectClicked(): Promise<void> {
    const node = this.rootNode;
    if (!node) {
      return;
    }

    this.errorMessage.set(null);
    const handle = node.handle as FileSystemDirectoryHandle;
    // A real user gesture (this click) -- satisfies the browser's
    // requirement for requesting a permission upgrade.
    const permission = await this.fileSystemAccessService.requestPermission(handle, 'readwrite');
    if (permission !== 'granted') {
      return;
    }

    this.needsReconnect.set(false);
    this.isLoading.set(true);
    try {
      await this.populateRoot(handle);
    } finally {
      this.isLoading.set(false);
    }
  }

  onToggleExpand(node: ExplorerTreeNode): void {
    node.expanded = !node.expanded;

    if (node.expanded && node.children === undefined) {
      void this.loadChildren(node);
    }
  }

  onFileClicked(node: ExplorerTreeNode): void {
    void this.openFile(node);
  }

  onContextMenuRequested(request: TreeContextMenuRequest<ExplorerContextTarget>): void {
    this.contextMenuRequest.set(request);
  }

  onTreeContextMenu(event: MouseEvent): void {
    if (!this.rootNode || event.target !== event.currentTarget) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.contextMenuRequest.set({
      target: { node: this.rootNode, parentNode: null },
      clientX: event.clientX,
      clientY: event.clientY,
      triggerElement: event.currentTarget as HTMLElement,
    });
  }

  onTreeKeydown(event: KeyboardEvent): void {
    if (!this.rootNode || event.target !== event.currentTarget) {
      return;
    }
    if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
      event.preventDefault();
      const trigger = event.currentTarget as HTMLElement;
      const rect = trigger.getBoundingClientRect();
      this.contextMenuRequest.set({
        target: { node: this.rootNode, parentNode: null },
        clientX: rect.left + 24,
        clientY: rect.top + 24,
        triggerElement: trigger,
      });
    }
  }

  onContextMenuCommand(command: string): void {
    const request = this.contextMenuRequest();
    if (!request) {
      return;
    }
    const { node, parentNode } = request.target;
    // Commands either open a prompt, mutate the tree, or activate a file;
    // none should restore focus while the clicked menu item is being removed.
    // Escape is the explicit focus-restoration path.
    this.closeContextMenu(false);

    switch (command) {
      case 'open':
        this.onFileClicked(node);
        break;
      case 'new-file':
        this.promptForEntry(node, 'file');
        break;
      case 'new-folder':
        this.promptForEntry(node, 'directory');
        break;
      case 'delete':
        if (parentNode) {
          this.confirmDelete(node, parentNode);
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

  onCreateEntry(event: CreateEntryEvent): void {
    void this.createEntry(event.parent, event.name, event.kind);
  }

  onDeleteEntry(event: DeleteEntryEvent): void {
    void this.deleteEntry(event);
  }

  private promptForEntry(parent: ExplorerTreeNode, kind: 'file' | 'directory'): void {
    const name = window.prompt(kind === 'file' ? 'New file name' : 'New folder name')?.trim();
    if (name) {
      this.onCreateEntry({ parent, name, kind });
    }
  }

  private confirmDelete(node: ExplorerTreeNode, parentNode: ExplorerTreeNode): void {
    const message =
      node.kind === 'directory'
        ? `Delete "${node.name}" and everything inside it? This cannot be undone.`
        : `Delete "${node.name}"? This cannot be undone.`;
    if (window.confirm(message)) {
      this.onDeleteEntry({ node, parentNode });
    }
  }

  /** Fetches `handle`'s children and sets up the fully-loaded, expanded root node. */
  private async populateRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const children = await this.fileSystemAccessService.listChildren(handle);
      this.rootNode = {
        name: handle.name,
        kind: 'directory',
        handle,
        children: children.map(toUnloadedNode),
        loadState: 'loaded',
        expanded: true,
      };
    } catch {
      this.errorMessage.set(`Could not read the contents of "${handle.name}".`);
    }
  }

  private async loadChildren(node: ExplorerTreeNode): Promise<void> {
    node.loadState = 'loading';

    try {
      const children = await this.fileSystemAccessService.listChildren(node.handle as FileSystemDirectoryHandle);
      node.children = children.map(toUnloadedNode);
      node.loadState = 'loaded';
    } catch {
      node.loadState = 'error';
      this.errorMessage.set(`Could not read the contents of "${node.name}".`);
    }
  }

  /**
   * Shared by onCreateFile/onCreateFolder. Force-loads `parent`'s children
   * first when they've never been loaded (this both hydrates the data the
   * duplicate-name check below needs, and auto-expands the directory so the
   * user immediately sees where the new entry lands), then rejects a
   * case-insensitive duplicate name without ever calling the create API,
   * and otherwise creates the entry and reloads `parent`'s children so the
   * new, correctly-sorted entry shows up.
   */
  private async createEntry(parent: ExplorerTreeNode, name: string, kind: 'file' | 'directory'): Promise<void> {
    this.errorMessage.set(null);

    if (parent.children === undefined) {
      parent.expanded = true;
      await this.loadChildren(parent);
    }

    const isDuplicate = (parent.children ?? []).some((child) => sameNameCaseInsensitive(child.name, name));
    if (isDuplicate) {
      this.errorMessage.set(`"${name}" already exists in "${parent.name}".`);
      return;
    }

    try {
      const parentHandle = parent.handle as FileSystemDirectoryHandle;
      if (kind === 'file') {
        await this.fileSystemAccessService.createFile(parentHandle, name);
      } else {
        await this.fileSystemAccessService.createDirectory(parentHandle, name);
      }
      parent.expanded = true;
      await this.loadChildren(parent);
    } catch {
      this.errorMessage.set(`Could not create "${name}" in "${parent.name}".`);
    }
  }

  private async deleteEntry(event: DeleteEntryEvent): Promise<void> {
    this.errorMessage.set(null);
    try {
      await this.fileSystemAccessService.removeEntry(
        event.parentNode.handle as FileSystemDirectoryHandle,
        event.node.name,
        event.node.kind,
      );
      await this.loadChildren(event.parentNode);

      if (event.node.kind === 'file') {
        this.fileDeleted.emit(event.node.handle as FileSystemFileHandle);
      }
    } catch {
      this.errorMessage.set(`Could not delete "${event.node.name}".`);
    }
  }

  private async openFile(node: ExplorerTreeNode): Promise<void> {
    this.errorMessage.set(null);
    try {
      const handle = node.handle as FileSystemFileHandle;
      const content = await this.fileSystemAccessService.readTextFile(handle);
      this.fileOpened.emit({ handle, name: node.name, content });
    } catch {
      this.errorMessage.set(`Could not open "${node.name}".`);
    }
  }
}

function toUnloadedNode(entry: DirectoryChildEntry): ExplorerTreeNode {
  return {
    name: entry.name,
    kind: entry.kind,
    handle: entry.handle,
    children: undefined,
    loadState: 'unloaded',
    expanded: false,
  };
}

function unloadedRootNode(handle: FileSystemDirectoryHandle): ExplorerTreeNode {
  return {
    name: handle.name,
    kind: 'directory',
    handle,
    children: undefined,
    loadState: 'unloaded',
    expanded: false,
  };
}
