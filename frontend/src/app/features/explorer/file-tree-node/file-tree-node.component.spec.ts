import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { FileTreeNodeComponent } from './file-tree-node.component';

function fakeNode(overrides: Partial<ExplorerTreeNode> = {}): ExplorerTreeNode {
  return {
    name: 'src',
    kind: 'directory',
    handle: {} as unknown as FileSystemHandle,
    children: undefined,
    loadState: 'unloaded',
    expanded: false,
    ...overrides,
  };
}

describe('FileTreeNodeComponent', () => {
  let fixture: ComponentFixture<FileTreeNodeComponent>;
  let component: FileTreeNodeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FileTreeNodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(FileTreeNodeComponent);
    component = fixture.componentInstance;
  });

  function row(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="file-tree-node"]');
  }

  it('renders the node name', () => {
    component.node = fakeNode({ name: 'diagrams' });
    fixture.detectChanges();

    expect(row().textContent).toContain('diagrams');
  });

  it('applies left padding proportional to depth', () => {
    component.node = fakeNode();
    component.depth = 2;
    fixture.detectChanges();

    const paddingAtDepth2 = (row().style as CSSStyleDeclaration).paddingLeft;

    component.depth = 0;
    fixture.detectChanges();
    const paddingAtDepth0 = (row().style as CSSStyleDeclaration).paddingLeft;

    expect(parseFloat(paddingAtDepth2)).toBeGreaterThan(parseFloat(paddingAtDepth0));
  });

  it('shows a chevron for a directory node', () => {
    component.node = fakeNode({ kind: 'directory' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-chevron"]')).toBeTruthy();
  });

  it('does not show a chevron for a file node', () => {
    component.node = fakeNode({ kind: 'file', name: 'diagram.puml' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-chevron"]')).toBeNull();
  });

  it('rotates the chevron via a modifier class when expanded', () => {
    component.node = fakeNode({ kind: 'directory', expanded: true });
    fixture.detectChanges();

    const chevron = fixture.nativeElement.querySelector('[data-testid="file-tree-node-chevron"]') as HTMLElement;
    expect(chevron.classList).toContain('file-tree-node__chevron--expanded');
  });

  it('shows a loading spinner glyph only while loadState is loading', () => {
    component.node = fakeNode({ loadState: 'loading' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-spinner"]')).toBeTruthy();

    component.node = fakeNode({ loadState: 'loaded' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-spinner"]')).toBeNull();
  });

  it('emits toggleExpand with the node when a directory row is clicked', () => {
    const node = fakeNode({ kind: 'directory' });
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.toggleExpand.subscribe(spy);
    const fileSpy = jest.fn();
    component.fileClicked.subscribe(fileSpy);

    row().click();

    expect(spy).toHaveBeenCalledWith(node);
    expect(fileSpy).not.toHaveBeenCalled();
  });

  it('emits fileClicked with the node when a file row is clicked', () => {
    const node = fakeNode({ kind: 'file', name: 'diagram.puml' });
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.fileClicked.subscribe(spy);
    const toggleSpy = jest.fn();
    component.toggleExpand.subscribe(toggleSpy);

    row().click();

    expect(spy).toHaveBeenCalledWith(node);
    expect(toggleSpy).not.toHaveBeenCalled();
  });

  it('does not render children when the directory is collapsed', () => {
    component.node = fakeNode({
      expanded: false,
      children: [fakeNode({ name: 'child.puml', kind: 'file' })],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]').length).toBe(1);
  });

  it('does not render children when expanded but children are still undefined (not yet loaded)', () => {
    component.node = fakeNode({ expanded: true, children: undefined });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]').length).toBe(1);
  });

  it('recursively renders one nested app-file-tree-node per child, one level deeper, when expanded with loaded children', () => {
    const child = fakeNode({ name: 'a.puml', kind: 'file' });
    const child2 = fakeNode({ name: 'b.puml', kind: 'file' });
    component.node = fakeNode({ expanded: true, children: [child, child2] });
    component.depth = 0;
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]');
    expect(rows.length).toBe(3);
    expect(rows[1].getAttribute('data-name')).toBe('a.puml');
    expect(rows[2].getAttribute('data-name')).toBe('b.puml');
  });

  it('bubbles a nested child toggleExpand/fileClicked event up through its own outputs untouched', () => {
    const grandchildFile = fakeNode({ name: 'deep.puml', kind: 'file' });
    component.node = fakeNode({ expanded: true, children: [grandchildFile] });
    fixture.detectChanges();

    const spy = jest.fn();
    component.fileClicked.subscribe(spy);

    const childRow = fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]')[1] as HTMLElement;
    childRow.click();

    expect(spy).toHaveBeenCalledWith(grandchildFile);
  });

  describe('per-row New File/New Folder/Delete action buttons', () => {
    function newFileButton(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="file-tree-node-new-file"]');
    }
    function newFolderButton(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="file-tree-node-new-folder"]');
    }
    function deleteButton(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="file-tree-node-delete"]');
    }

    it('shows New File/New Folder for a directory node', () => {
      component.node = fakeNode({ kind: 'directory' });
      fixture.detectChanges();

      expect(newFileButton()).toBeTruthy();
      expect(newFolderButton()).toBeTruthy();
    });

    it('hides New File/New Folder for a file node', () => {
      component.node = fakeNode({ kind: 'file', name: 'diagram.puml' });
      fixture.detectChanges();

      expect(newFileButton()).toBeNull();
      expect(newFolderButton()).toBeNull();
    });

    it('hides the Delete button when parentNode is null (the true root)', () => {
      component.node = fakeNode();
      component.parentNode = null;
      fixture.detectChanges();

      expect(deleteButton()).toBeNull();
    });

    it('shows the Delete button when parentNode is set', () => {
      component.node = fakeNode();
      component.parentNode = fakeNode({ name: 'parent-dir' });
      fixture.detectChanges();

      expect(deleteButton()).toBeTruthy();
    });

    it('clicking New File prompts and emits createFile with the trimmed name, without also emitting toggleExpand', () => {
      const node = fakeNode({ kind: 'directory' });
      component.node = node;
      fixture.detectChanges();
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('  new-file.puml  ');
      const createFileSpy = jest.fn();
      component.createFile.subscribe(createFileSpy);
      const toggleSpy = jest.fn();
      component.toggleExpand.subscribe(toggleSpy);

      newFileButton()!.click();

      expect(promptSpy).toHaveBeenCalledWith('New file name');
      expect(createFileSpy).toHaveBeenCalledWith({ parent: node, name: 'new-file.puml' });
      expect(toggleSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('does not emit createFile when the New File prompt is cancelled (null)', () => {
      component.node = fakeNode({ kind: 'directory' });
      fixture.detectChanges();
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
      const createFileSpy = jest.fn();
      component.createFile.subscribe(createFileSpy);

      newFileButton()!.click();

      expect(createFileSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('does not emit createFile when the New File prompt result is blank', () => {
      component.node = fakeNode({ kind: 'directory' });
      fixture.detectChanges();
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('   ');
      const createFileSpy = jest.fn();
      component.createFile.subscribe(createFileSpy);

      newFileButton()!.click();

      expect(createFileSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('clicking New Folder prompts and emits createFolder with the trimmed name, without also emitting toggleExpand', () => {
      const node = fakeNode({ kind: 'directory' });
      component.node = node;
      fixture.detectChanges();
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('new-folder');
      const createFolderSpy = jest.fn();
      component.createFolder.subscribe(createFolderSpy);
      const toggleSpy = jest.fn();
      component.toggleExpand.subscribe(toggleSpy);

      newFolderButton()!.click();

      expect(promptSpy).toHaveBeenCalledWith('New folder name');
      expect(createFolderSpy).toHaveBeenCalledWith({ parent: node, name: 'new-folder' });
      expect(toggleSpy).not.toHaveBeenCalled();
      promptSpy.mockRestore();
    });

    it('clicking Delete on a directory confirms with the directory phrasing and emits deleteEntry on accept', () => {
      const node = fakeNode({ kind: 'directory', name: 'subdir' });
      const parentNode = fakeNode({ name: 'root' });
      component.node = node;
      component.parentNode = parentNode;
      fixture.detectChanges();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteSpy = jest.fn();
      component.deleteEntry.subscribe(deleteSpy);
      const toggleSpy = jest.fn();
      component.toggleExpand.subscribe(toggleSpy);

      deleteButton()!.click();

      expect(confirmSpy).toHaveBeenCalledWith('Delete "subdir" and everything inside it? This cannot be undone.');
      expect(deleteSpy).toHaveBeenCalledWith({ node, parentNode });
      expect(toggleSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('clicking Delete on a file confirms with the file phrasing and emits deleteEntry on accept, without also emitting fileClicked', () => {
      const node = fakeNode({ kind: 'file', name: 'diagram.puml' });
      const parentNode = fakeNode({ name: 'root' });
      component.node = node;
      component.parentNode = parentNode;
      fixture.detectChanges();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const deleteSpy = jest.fn();
      component.deleteEntry.subscribe(deleteSpy);
      const fileClickedSpy = jest.fn();
      component.fileClicked.subscribe(fileClickedSpy);

      deleteButton()!.click();

      expect(confirmSpy).toHaveBeenCalledWith('Delete "diagram.puml"? This cannot be undone.');
      expect(deleteSpy).toHaveBeenCalledWith({ node, parentNode });
      expect(fileClickedSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('does not emit deleteEntry when the confirm dialog is declined', () => {
      component.node = fakeNode();
      component.parentNode = fakeNode({ name: 'root' });
      fixture.detectChanges();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      const deleteSpy = jest.fn();
      component.deleteEntry.subscribe(deleteSpy);

      deleteButton()!.click();

      expect(deleteSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });
  });

  describe('bubbling createFile/createFolder/deleteEntry through one level of recursion', () => {
    it('re-emits a nested child createFile/createFolder/deleteEntry event through its own outputs untouched', () => {
      const grandchildFile = fakeNode({ name: 'deep.puml', kind: 'file' });
      component.node = fakeNode({ name: 'root', expanded: true, children: [grandchildFile] });
      fixture.detectChanges();

      const createFileSpy = jest.fn();
      const createFolderSpy = jest.fn();
      const deleteEntrySpy = jest.fn();
      component.createFile.subscribe(createFileSpy);
      component.createFolder.subscribe(createFolderSpy);
      component.deleteEntry.subscribe(deleteEntrySpy);

      const childRow = fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]')[1] as HTMLElement;
      const childDeleteButton = childRow.querySelector('[data-testid="file-tree-node-delete"]') as HTMLElement;

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      childDeleteButton.click();
      confirmSpy.mockRestore();

      expect(deleteEntrySpy).toHaveBeenCalledWith({ node: grandchildFile, parentNode: component.node });
    });
  });
});
