import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DirectoryChildEntry } from '../../../core/models/directory-child-entry.model';
import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { CreateEntryEvent, DeleteEntryEvent } from '../file-tree-node/file-tree-node.component';
import { ExplorerPanelComponent } from './explorer-panel.component';

function fakeDirHandle(name: string): FileSystemDirectoryHandle {
  return { name, kind: 'directory' } as unknown as FileSystemDirectoryHandle;
}

function fakeFileHandle(name: string): FileSystemFileHandle {
  return { name, kind: 'file' } as unknown as FileSystemFileHandle;
}

describe('ExplorerPanelComponent', () => {
  let fixture: ComponentFixture<ExplorerPanelComponent>;
  let component: ExplorerPanelComponent;
  let fileSystemAccessServiceMock: {
    isSupported: jest.Mock;
    pickDirectory: jest.Mock;
    listChildren: jest.Mock;
    readTextFile: jest.Mock;
    writeTextFile: jest.Mock;
    createFile: jest.Mock;
    createDirectory: jest.Mock;
    removeEntry: jest.Mock;
    queryPermission: jest.Mock;
    requestPermission: jest.Mock;
    saveRootHandle: jest.Mock;
    loadRootHandle: jest.Mock;
  };

  beforeEach(async () => {
    fileSystemAccessServiceMock = {
      isSupported: jest.fn().mockReturnValue(true),
      pickDirectory: jest.fn(),
      listChildren: jest.fn().mockResolvedValue([]),
      readTextFile: jest.fn(),
      writeTextFile: jest.fn(),
      createFile: jest.fn(),
      createDirectory: jest.fn(),
      removeEntry: jest.fn(),
      queryPermission: jest.fn(),
      requestPermission: jest.fn(),
      saveRootHandle: jest.fn().mockResolvedValue(undefined),
      loadRootHandle: jest.fn().mockResolvedValue(null),
    };

    await TestBed.configureTestingModule({
      imports: [ExplorerPanelComponent],
      providers: [{ provide: FileSystemAccessService, useValue: fileSystemAccessServiceMock }],
    }).compileComponents();

    // Component creation is deliberately deferred to createFixture() (called
    // explicitly by each test, rather than here) because `isSupported` is
    // computed once, synchronously, at construction time -- tests that need
    // it false must configure the mock *before* the component is
    // constructed.
  });

  function createFixture(): void {
    fixture = TestBed.createComponent(ExplorerPanelComponent);
    component = fixture.componentInstance;
  }

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  async function flush(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }

  describe('unsupported browser', () => {
    it('renders nothing and never calls any File System Access method', async () => {
      fileSystemAccessServiceMock.isSupported.mockReturnValue(false);
      createFixture();
      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      expect(byTestId('explorer-panel')).toBeNull();
      expect(fileSystemAccessServiceMock.loadRootHandle).not.toHaveBeenCalled();
      expect(fileSystemAccessServiceMock.pickDirectory).not.toHaveBeenCalled();
    });
  });

  describe('no stored root handle', () => {
    it('shows the Open Folder button', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      expect(byTestId('explorer-open-folder')).toBeTruthy();
      expect(byTestId('explorer-reconnect')).toBeNull();
    });

    it('clicking Open Folder and cancelling the picker (null) leaves the button showing', async () => {
      fileSystemAccessServiceMock.pickDirectory.mockResolvedValue(null);
      createFixture();
      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      await component.onOpenFolderClicked();
      fixture.detectChanges();

      expect(fileSystemAccessServiceMock.saveRootHandle).not.toHaveBeenCalled();
      expect(byTestId('explorer-open-folder')).toBeTruthy();
    });

    it('clicking Open Folder with a real handle saves it and populates the tree', async () => {
      const handle = fakeDirHandle('my-project');
      fileSystemAccessServiceMock.pickDirectory.mockResolvedValue(handle);
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'a.puml', kind: 'file', handle: fakeFileHandle('a.puml') },
      ] as DirectoryChildEntry[]);
      createFixture();
      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      await component.onOpenFolderClicked();
      fixture.detectChanges();

      expect(fileSystemAccessServiceMock.saveRootHandle).toHaveBeenCalledWith(handle);
      expect(component.rootNode?.name).toBe('my-project');
      expect(component.rootNode?.expanded).toBe(true);
      expect(component.rootNode?.children?.length).toBe(1);
      expect(byTestId('explorer-open-folder')).toBeNull();
      // One root <app-file-tree-node> plus one for its single a.puml child.
      expect(fixture.nativeElement.querySelectorAll('app-file-tree-node').length).toBe(2);
    });

    it('surfaces an error banner when listing the newly picked folder fails', async () => {
      const handle = fakeDirHandle('broken');
      fileSystemAccessServiceMock.pickDirectory.mockResolvedValue(handle);
      fileSystemAccessServiceMock.listChildren.mockRejectedValue(new Error('boom'));
      createFixture();
      fixture.detectChanges();
      await flush();

      await component.onOpenFolderClicked();
      fixture.detectChanges();

      expect(byTestId('explorer-panel')?.querySelector('[role="alert"]')).toBeTruthy();
    });
  });

  describe('auto-reopen from a stored root handle', () => {
    it('populates the tree directly when permission is already granted', async () => {
      const handle = fakeDirHandle('restored-project');
      fileSystemAccessServiceMock.loadRootHandle.mockResolvedValue(handle);
      fileSystemAccessServiceMock.queryPermission.mockResolvedValue('granted');
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([]);
      createFixture();

      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      expect(fileSystemAccessServiceMock.queryPermission).toHaveBeenCalledWith(handle, 'readwrite');
      expect(fileSystemAccessServiceMock.pickDirectory).not.toHaveBeenCalled();
      expect(component.rootNode?.name).toBe('restored-project');
      expect(component.needsReconnect()).toBe(false);
      expect(byTestId('explorer-reconnect')).toBeNull();
    });

    it('shows a Reconnect button (not the tree, not the native picker) when permission is only "prompt"', async () => {
      const handle = fakeDirHandle('needs-permission');
      fileSystemAccessServiceMock.loadRootHandle.mockResolvedValue(handle);
      fileSystemAccessServiceMock.queryPermission.mockResolvedValue('prompt');
      createFixture();

      fixture.detectChanges();
      await flush();
      fixture.detectChanges();

      expect(fileSystemAccessServiceMock.pickDirectory).not.toHaveBeenCalled();
      expect(component.needsReconnect()).toBe(true);
      const reconnectButton = byTestId('explorer-reconnect');
      expect(reconnectButton).toBeTruthy();
      expect(reconnectButton?.textContent).toContain('needs-permission');
    });

    it('clicking Reconnect requests permission and populates the tree on success', async () => {
      const handle = fakeDirHandle('needs-permission');
      fileSystemAccessServiceMock.loadRootHandle.mockResolvedValue(handle);
      fileSystemAccessServiceMock.queryPermission.mockResolvedValue('prompt');
      fileSystemAccessServiceMock.requestPermission.mockResolvedValue('granted');
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([]);
      createFixture();

      fixture.detectChanges();
      await flush();

      await component.onReconnectClicked();
      fixture.detectChanges();

      expect(fileSystemAccessServiceMock.requestPermission).toHaveBeenCalledWith(handle, 'readwrite');
      expect(component.needsReconnect()).toBe(false);
      expect(byTestId('explorer-reconnect')).toBeNull();
    });

    it('clicking Reconnect leaves the Reconnect button showing when permission is denied', async () => {
      const handle = fakeDirHandle('needs-permission');
      fileSystemAccessServiceMock.loadRootHandle.mockResolvedValue(handle);
      fileSystemAccessServiceMock.queryPermission.mockResolvedValue('prompt');
      fileSystemAccessServiceMock.requestPermission.mockResolvedValue('denied');
      createFixture();

      fixture.detectChanges();
      await flush();

      await component.onReconnectClicked();
      fixture.detectChanges();

      expect(component.needsReconnect()).toBe(true);
      expect(byTestId('explorer-reconnect')).toBeTruthy();
    });
  });

  describe('context menus', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    function showTree(): ExplorerTreeNode {
      const root: ExplorerTreeNode = {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [
          {
            name: 'diagram.puml',
            kind: 'file',
            handle: fakeFileHandle('diagram.puml'),
            children: undefined,
            loadState: 'loaded',
            expanded: false,
          },
        ],
        loadState: 'loaded',
        expanded: true,
      };
      component.rootNode = root;
      fixture.detectChanges();
      return root;
    }

    function openMenu(target: HTMLElement): HTMLElement {
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 20, clientY: 30 }));
      fixture.detectChanges();
      return byTestId('tree-context-menu')!;
    }

    it('offers root creation on the row and blank tree surface without a root delete command', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      showTree();

      const menu = openMenu(byTestId('explorer-tree')!);
      expect(menu.querySelector('[data-command="new-file"]')).toBeTruthy();
      expect(menu.querySelector('[data-command="new-folder"]')).toBeTruthy();
      expect(menu.querySelector('[data-command="delete"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-new-file"]')).toBeNull();
    });

    // Regression pin for the change-detection loop: the menu's [items]
    // binding must see a stable array reference across reads while a
    // request is open (a fresh-array-per-read getter wedged the tab).
    it('returns the same items array across reads while a menu is open', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      showTree();

      openMenu(byTestId('explorer-tree')!);

      expect(component.contextMenuItems()).toBe(component.contextMenuItems());
    });

    it('offers Open and Delete for a file and runs Open through the existing file handler', async () => {
      fileSystemAccessServiceMock.readTextFile.mockResolvedValue('@startuml');
      createFixture();
      fixture.detectChanges();
      await flush();
      showTree();
      const openedSpy = jest.fn();
      component.fileOpened.subscribe(openedSpy);
      const fileRow = fixture.nativeElement.querySelector('[data-name="diagram.puml"]') as HTMLElement;

      const menu = openMenu(fileRow);
      expect(menu.querySelector('[data-command="open"]')).toBeTruthy();
      expect(menu.querySelector('[data-command="delete"]')).toBeTruthy();
      (menu.querySelector('[data-command="open"]') as HTMLButtonElement).click();
      jest.runOnlyPendingTimers();
      await flush();

      expect(fileSystemAccessServiceMock.readTextFile).toHaveBeenCalled();
      expect(openedSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'diagram.puml', content: '@startuml' }));
    });

    it('creates from a context command using the existing prompt and filesystem flow', async () => {
      jest.spyOn(window, 'prompt').mockReturnValue('new.puml');
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([]);
      createFixture();
      fixture.detectChanges();
      await flush();
      showTree();

      const menu = openMenu(byTestId('explorer-tree')!);
      (menu.querySelector('[data-command="new-file"]') as HTMLButtonElement).click();
      jest.runOnlyPendingTimers();
      await flush();

      expect(window.prompt).toHaveBeenCalledWith('New file name');
      expect(fileSystemAccessServiceMock.createFile).toHaveBeenCalledWith(component.rootNode!.handle, 'new.puml');
    });
  });

  describe('expand/collapse lazy loading', () => {
    function loadedRoot(): ExplorerTreeNode {
      return {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [
          {
            name: 'subdir',
            kind: 'directory',
            handle: fakeDirHandle('subdir'),
            children: undefined,
            loadState: 'unloaded',
            expanded: false,
          },
        ],
        loadState: 'loaded',
        expanded: true,
      };
    }

    it('fetches children (once) the first time a directory is expanded, then caches them', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      component.rootNode = loadedRoot();
      fixture.detectChanges();

      const subdirNode = component.rootNode!.children![0];
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'nested.puml', kind: 'file', handle: fakeFileHandle('nested.puml') },
      ] as DirectoryChildEntry[]);

      component.onToggleExpand(subdirNode);
      expect(subdirNode.loadState).toBe('loading');
      await flush();

      expect(fileSystemAccessServiceMock.listChildren).toHaveBeenCalledWith(subdirNode.handle);
      expect(subdirNode.loadState).toBe('loaded');
      expect(subdirNode.children?.length).toBe(1);

      // Collapse then re-expand: children are already loaded, so no second
      // disk read should occur.
      fileSystemAccessServiceMock.listChildren.mockClear();
      component.onToggleExpand(subdirNode);
      expect(subdirNode.expanded).toBe(false);
      component.onToggleExpand(subdirNode);
      expect(subdirNode.expanded).toBe(true);

      expect(fileSystemAccessServiceMock.listChildren).not.toHaveBeenCalled();
    });

    it('sets loadState to error and surfaces an error banner when expanding fails', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      component.rootNode = loadedRoot();
      const subdirNode = component.rootNode!.children![0];
      fileSystemAccessServiceMock.listChildren.mockRejectedValue(new Error('permission revoked'));

      component.onToggleExpand(subdirNode);
      await flush();
      fixture.detectChanges();

      expect(subdirNode.loadState).toBe('error');
      expect(component.errorMessage()).toBeTruthy();
    });
  });

  describe('opening a file', () => {
    it('reads the file and emits fileOpened with handle/name/content', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const fileHandle = fakeFileHandle('diagram.puml');
      const fileNode: ExplorerTreeNode = {
        name: 'diagram.puml',
        kind: 'file',
        handle: fileHandle,
        children: undefined,
        loadState: 'unloaded',
        expanded: false,
      };
      fileSystemAccessServiceMock.readTextFile.mockResolvedValue('@startuml\n@enduml');

      const spy = jest.fn();
      component.fileOpened.subscribe(spy);

      component.onFileClicked(fileNode);
      await flush();

      expect(fileSystemAccessServiceMock.readTextFile).toHaveBeenCalledWith(fileHandle);
      expect(spy).toHaveBeenCalledWith({ handle: fileHandle, name: 'diagram.puml', content: '@startuml\n@enduml' });
    });

    it('surfaces an error banner when reading the file fails', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const fileNode: ExplorerTreeNode = {
        name: 'diagram.puml',
        kind: 'file',
        handle: fakeFileHandle('diagram.puml'),
        children: undefined,
        loadState: 'unloaded',
        expanded: false,
      };
      fileSystemAccessServiceMock.readTextFile.mockRejectedValue(new Error('gone'));
      const spy = jest.fn();
      component.fileOpened.subscribe(spy);

      component.onFileClicked(fileNode);
      await flush();
      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBeTruthy();
    });
  });

  describe('creating a new file/folder', () => {
    function loadedRootWithChildren(): ExplorerTreeNode {
      return {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [
          { name: 'existing.puml', kind: 'file', handle: fakeFileHandle('existing.puml'), loadState: 'unloaded', expanded: false, children: undefined },
        ],
        loadState: 'loaded',
        expanded: true,
      };
    }

    it('onCreateFile calls createFile with the parent handle/name, then reloads the parent children', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithChildren();
      component.rootNode = root;
      fileSystemAccessServiceMock.createFile.mockResolvedValue(fakeFileHandle('new.puml'));
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'existing.puml', kind: 'file', handle: fakeFileHandle('existing.puml') },
        { name: 'new.puml', kind: 'file', handle: fakeFileHandle('new.puml') },
      ] as DirectoryChildEntry[]);

      const event: CreateEntryEvent = { parent: root, name: 'new.puml', kind: 'file' };
      component.onCreateEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.createFile).toHaveBeenCalledWith(root.handle, 'new.puml');
      expect(root.children?.map((c) => c.name)).toEqual(['existing.puml', 'new.puml']);
      expect(root.expanded).toBe(true);
    });

    it('onCreateFolder calls createDirectory with the parent handle/name, then reloads the parent children', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithChildren();
      component.rootNode = root;
      fileSystemAccessServiceMock.createDirectory.mockResolvedValue(fakeDirHandle('new-folder'));
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'new-folder', kind: 'directory', handle: fakeDirHandle('new-folder') },
        { name: 'existing.puml', kind: 'file', handle: fakeFileHandle('existing.puml') },
      ] as DirectoryChildEntry[]);

      const event: CreateEntryEvent = { parent: root, name: 'new-folder', kind: 'directory' };
      component.onCreateEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.createDirectory).toHaveBeenCalledWith(root.handle, 'new-folder');
      expect(root.children?.map((c) => c.name)).toEqual(['new-folder', 'existing.puml']);
    });

    it('blocks the create call entirely and sets errorMessage on a case-insensitive duplicate name', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithChildren();
      component.rootNode = root;

      const event: CreateEntryEvent = { parent: root, name: 'EXISTING.puml', kind: 'file' };
      component.onCreateEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.createFile).not.toHaveBeenCalled();
      expect(fileSystemAccessServiceMock.createDirectory).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBe('"EXISTING.puml" already exists in "root".');
    });

    it('treats an accented name as distinct from its unaccented lookalike (case-insensitive, accent-sensitive)', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root: ExplorerTreeNode = {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [
          { name: 'résumé.puml', kind: 'file', handle: fakeFileHandle('résumé.puml'), loadState: 'unloaded', expanded: false, children: undefined },
        ],
        loadState: 'loaded',
        expanded: true,
      };
      component.rootNode = root;
      fileSystemAccessServiceMock.createFile.mockResolvedValue(fakeFileHandle('resume.puml'));
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([] as DirectoryChildEntry[]);

      component.onCreateEntry({ parent: root, name: 'resume.puml', kind: 'file' });
      await flush();

      expect(component.errorMessage()).toBeNull();
      expect(fileSystemAccessServiceMock.createFile).toHaveBeenCalledWith(root.handle, 'resume.puml');
    });

    it('force-loads children first (calling listChildren) when creating inside a directory whose children are undefined', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const unloadedDir: ExplorerTreeNode = {
        name: 'unloaded-dir',
        kind: 'directory',
        handle: fakeDirHandle('unloaded-dir'),
        children: undefined,
        loadState: 'unloaded',
        expanded: false,
      };
      component.rootNode = {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [unloadedDir],
        loadState: 'loaded',
        expanded: true,
      };

      fileSystemAccessServiceMock.listChildren
        .mockResolvedValueOnce([] as DirectoryChildEntry[])
        .mockResolvedValueOnce([
          { name: 'new.puml', kind: 'file', handle: fakeFileHandle('new.puml') },
        ] as DirectoryChildEntry[]);
      fileSystemAccessServiceMock.createFile.mockResolvedValue(fakeFileHandle('new.puml'));

      const event: CreateEntryEvent = { parent: unloadedDir, name: 'new.puml', kind: 'file' };
      component.onCreateEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.listChildren).toHaveBeenCalledWith(unloadedDir.handle);
      expect(unloadedDir.expanded).toBe(true);
      expect(fileSystemAccessServiceMock.createFile).toHaveBeenCalledWith(unloadedDir.handle, 'new.puml');
      expect(unloadedDir.children?.map((c) => c.name)).toEqual(['new.puml']);
    });

    it('surfaces a thrown creation error via errorMessage rather than throwing out of the component', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithChildren();
      component.rootNode = root;
      fileSystemAccessServiceMock.createFile.mockRejectedValue(new Error('boom'));

      const event: CreateEntryEvent = { parent: root, name: 'new.puml', kind: 'file' };
      expect(() => component.onCreateEntry(event)).not.toThrow();
      await flush();

      expect(component.errorMessage()).toBe('Could not create "new.puml" in "root".');
    });
  });

  describe('deleting an entry', () => {
    function loadedRootWithFileAndDir(): ExplorerTreeNode {
      return {
        name: 'root',
        kind: 'directory',
        handle: fakeDirHandle('root'),
        children: [
          { name: 'subdir', kind: 'directory', handle: fakeDirHandle('subdir'), loadState: 'unloaded', expanded: false, children: undefined },
          { name: 'diagram.puml', kind: 'file', handle: fakeFileHandle('diagram.puml'), loadState: 'unloaded', expanded: false, children: undefined },
        ],
        loadState: 'loaded',
        expanded: true,
      };
    }

    it('calls removeEntry with the parent handle/name/kind, then refreshes the parent children, and emits fileDeleted for a file', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithFileAndDir();
      component.rootNode = root;
      const fileNode = root.children!.find((c) => c.name === 'diagram.puml')!;
      fileSystemAccessServiceMock.removeEntry.mockResolvedValue(undefined);
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'subdir', kind: 'directory', handle: fakeDirHandle('subdir') },
      ] as DirectoryChildEntry[]);
      const fileDeletedSpy = jest.fn();
      component.fileDeleted.subscribe(fileDeletedSpy);

      const event: DeleteEntryEvent = { node: fileNode, parentNode: root };
      component.onDeleteEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.removeEntry).toHaveBeenCalledWith(root.handle, 'diagram.puml', 'file');
      expect(root.children?.map((c) => c.name)).toEqual(['subdir']);
      expect(fileDeletedSpy).toHaveBeenCalledWith(fileNode.handle);
    });

    it('does not emit fileDeleted when the deleted entry is a directory', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithFileAndDir();
      component.rootNode = root;
      const dirNode = root.children!.find((c) => c.name === 'subdir')!;
      fileSystemAccessServiceMock.removeEntry.mockResolvedValue(undefined);
      fileSystemAccessServiceMock.listChildren.mockResolvedValue([
        { name: 'diagram.puml', kind: 'file', handle: fakeFileHandle('diagram.puml') },
      ] as DirectoryChildEntry[]);
      const fileDeletedSpy = jest.fn();
      component.fileDeleted.subscribe(fileDeletedSpy);

      const event: DeleteEntryEvent = { node: dirNode, parentNode: root };
      component.onDeleteEntry(event);
      await flush();

      expect(fileSystemAccessServiceMock.removeEntry).toHaveBeenCalledWith(root.handle, 'subdir', 'directory');
      expect(fileDeletedSpy).not.toHaveBeenCalled();
    });

    it('surfaces a thrown delete error via errorMessage rather than throwing out of the component', async () => {
      createFixture();
      fixture.detectChanges();
      await flush();
      const root = loadedRootWithFileAndDir();
      component.rootNode = root;
      const fileNode = root.children!.find((c) => c.name === 'diagram.puml')!;
      fileSystemAccessServiceMock.removeEntry.mockRejectedValue(new Error('boom'));
      const fileDeletedSpy = jest.fn();
      component.fileDeleted.subscribe(fileDeletedSpy);

      const event: DeleteEntryEvent = { node: fileNode, parentNode: root };
      component.onDeleteEntry(event);
      await flush();

      expect(component.errorMessage()).toBeTruthy();
      expect(fileDeletedSpy).not.toHaveBeenCalled();
    });
  });
});
