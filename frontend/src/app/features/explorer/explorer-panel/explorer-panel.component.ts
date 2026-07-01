import { Component, EventEmitter, OnInit, Output, inject, signal } from '@angular/core';

import { DirectoryChildEntry } from '../../../core/models/directory-child-entry.model';
import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { OpenedDiskFile } from '../../../core/models/opened-disk-file.model';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { ErrorBannerComponent } from '../../../shared/components/error-banner/error-banner.component';
import { LoadingSpinnerComponent } from '../../../shared/components/loading-spinner/loading-spinner.component';
import { FileTreeNodeComponent } from '../file-tree-node/file-tree-node.component';

/**
 * VS Code-style Explorer panel: opens a local folder via the File System
 * Access API, renders it as a lazily-loaded tree, and emits file contents
 * up to EditorPageComponent when a file row is clicked.
 *
 * Centralizes every File System Access call here -- FileTreeNodeComponent
 * (the recursive row renderer) is a purely presentational, I/O-free "dumb"
 * component that only bubbles toggleExpand/fileClicked events back up.
 */
@Component({
  selector: 'app-explorer-panel',
  standalone: true,
  imports: [ErrorBannerComponent, LoadingSpinnerComponent, FileTreeNodeComponent],
  templateUrl: './explorer-panel.component.html',
  styleUrl: './explorer-panel.component.scss',
})
export class ExplorerPanelComponent implements OnInit {
  private readonly fileSystemAccessService = inject(FileSystemAccessService);

  @Output() readonly fileOpened = new EventEmitter<OpenedDiskFile>();

  /** Computed once -- the browser either has this API or it doesn't, for the whole session. */
  readonly isSupported = this.fileSystemAccessService.isSupported();

  // Custom equal:()=>false so re-.set()-ing the SAME mutated-in-place root
  // object reference still notifies subscribers -- toggling expand/loading
  // state mutates node objects in place, then re-sets the same root
  // reference, avoiding deep-copy gymnastics for a recursive tree structure.
  readonly rootNode = signal<ExplorerTreeNode | null>(null, { equal: () => false });
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  /** True when a previously-opened root was restored from IndexedDB but its permission has lapsed to 'prompt'. */
  readonly needsReconnect = signal(false);

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
      this.rootNode.set(unloadedRootNode(handle));
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
    const node = this.rootNode();
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
      return;
    }

    this.rootNode.set(this.rootNode());
  }

  onFileClicked(node: ExplorerTreeNode): void {
    void this.openFile(node);
  }

  /** Fetches `handle`'s children and sets up the fully-loaded, expanded root node. */
  private async populateRoot(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const children = await this.fileSystemAccessService.listChildren(handle);
      this.rootNode.set({
        name: handle.name,
        kind: 'directory',
        handle,
        children: children.map(toUnloadedNode),
        loadState: 'loaded',
        expanded: true,
      });
    } catch {
      this.errorMessage.set(`Could not read the contents of "${handle.name}".`);
    }
  }

  private async loadChildren(node: ExplorerTreeNode): Promise<void> {
    node.loadState = 'loading';
    this.rootNode.set(this.rootNode());

    try {
      const children = await this.fileSystemAccessService.listChildren(node.handle as FileSystemDirectoryHandle);
      node.children = children.map(toUnloadedNode);
      node.loadState = 'loaded';
    } catch {
      node.loadState = 'error';
      this.errorMessage.set(`Could not read the contents of "${node.name}".`);
    }

    this.rootNode.set(this.rootNode());
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
