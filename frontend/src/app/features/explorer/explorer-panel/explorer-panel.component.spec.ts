import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DirectoryChildEntry } from '../../../core/models/directory-child-entry.model';
import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
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
    queryPermission: jest.Mock;
    requestPermission: jest.Mock;
    saveRootHandle: jest.Mock;
    loadRootHandle: jest.Mock;
    clearRootHandle: jest.Mock;
  };

  beforeEach(async () => {
    fileSystemAccessServiceMock = {
      isSupported: jest.fn().mockReturnValue(true),
      pickDirectory: jest.fn(),
      listChildren: jest.fn().mockResolvedValue([]),
      readTextFile: jest.fn(),
      writeTextFile: jest.fn(),
      queryPermission: jest.fn(),
      requestPermission: jest.fn(),
      saveRootHandle: jest.fn().mockResolvedValue(undefined),
      loadRootHandle: jest.fn().mockResolvedValue(null),
      clearRootHandle: jest.fn().mockResolvedValue(undefined),
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
      expect(component.rootNode()?.name).toBe('my-project');
      expect(component.rootNode()?.expanded).toBe(true);
      expect(component.rootNode()?.children?.length).toBe(1);
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
      expect(component.rootNode()?.name).toBe('restored-project');
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
      component.rootNode.set(loadedRoot());
      fixture.detectChanges();

      const subdirNode = component.rootNode()!.children![0];
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
      component.rootNode.set(loadedRoot());
      const subdirNode = component.rootNode()!.children![0];
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
});
