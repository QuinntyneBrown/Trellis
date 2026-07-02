import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { DocumentTreeNodeComponent } from './document-tree-node.component';

function folderNode(overrides: Partial<DocumentTreeNode> = {}): DocumentTreeNode {
  return {
    id: 'folder-1',
    name: 'diagrams',
    kind: 'folder',
    children: [],
    expanded: false,
    ...overrides,
  };
}

function documentNode(overrides: Partial<DocumentTreeNode> = {}): DocumentTreeNode {
  const summary: DocumentSummary = {
    id: 'doc-1',
    name: 'My Diagram',
    updatedAt: '2026-01-01T00:00:00Z',
    folderId: null,
  };
  return {
    id: summary.id,
    name: summary.name,
    kind: 'document',
    document: summary,
    ...overrides,
  };
}

describe('DocumentTreeNodeComponent', () => {
  let fixture: ComponentFixture<DocumentTreeNodeComponent>;
  let component: DocumentTreeNodeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentTreeNodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentTreeNodeComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  describe('folder rows', () => {
    it('renders a folder row with the folder testids and name attribute', () => {
      component.node = folderNode({ name: 'architecture' });
      fixture.detectChanges();

      const row = byTestId('document-folder')!;
      expect(row).toBeTruthy();
      expect(row.getAttribute('data-folder-name')).toBe('architecture');
      expect(row.textContent).toContain('architecture');
      expect(byTestId('document-folder-chevron')).toBeTruthy();
      expect(byTestId('document-item')).toBeNull();
    });

    it('rotates the chevron via a modifier class when expanded', () => {
      component.node = folderNode({ expanded: true });
      fixture.detectChanges();

      expect(byTestId('document-folder-chevron')!.classList).toContain('document-tree-node__chevron--expanded');
    });

    it('emits toggleExpand with the node when the row is clicked', () => {
      const node = folderNode();
      component.node = node;
      fixture.detectChanges();
      const spy = jest.fn();
      component.toggleExpand.subscribe(spy);

      byTestId('document-folder')!.click();

      expect(spy).toHaveBeenCalledWith(node);
    });

    it('emits createFolder with this folder as parent after a prompt, without toggling the row', () => {
      jest.spyOn(window, 'prompt').mockReturnValue('  sub folder  ');
      component.node = folderNode({ id: 'parent-9' });
      fixture.detectChanges();
      const createSpy = jest.fn();
      component.createFolder.subscribe(createSpy);
      const toggleSpy = jest.fn();
      component.toggleExpand.subscribe(toggleSpy);

      byTestId('document-folder-new-folder')!.click();

      expect(window.prompt).toHaveBeenCalledWith('New folder name');
      expect(createSpy).toHaveBeenCalledWith({ parentId: 'parent-9', name: 'sub folder' });
      expect(toggleSpy).not.toHaveBeenCalled();
    });

    it('does not emit createFolder when the prompt is cancelled', () => {
      jest.spyOn(window, 'prompt').mockReturnValue(null);
      component.node = folderNode();
      fixture.detectChanges();
      const spy = jest.fn();
      component.createFolder.subscribe(spy);

      byTestId('document-folder-new-folder')!.click();

      expect(spy).not.toHaveBeenCalled();
    });

    it('confirms a folder delete with the cascade wording before emitting deleteNode', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
      const node = folderNode({ name: 'doomed' });
      component.node = node;
      fixture.detectChanges();
      const spy = jest.fn();
      component.deleteNode.subscribe(spy);

      byTestId('document-folder-delete')!.click();

      expect(confirmSpy).toHaveBeenCalledWith('Delete "doomed" and everything inside it? This cannot be undone.');
      expect(spy).toHaveBeenCalledWith(node);
    });

    it('renders children only while expanded, indented one level deeper', () => {
      const child = documentNode();
      component.node = folderNode({ expanded: false, children: [child] });
      fixture.detectChanges();
      expect(byTestId('document-item')).toBeNull();

      component.node = folderNode({ expanded: true, children: [child] });
      fixture.detectChanges();

      const childRow = byTestId('document-item')!;
      expect(childRow).toBeTruthy();
      const parentPadding = parseFloat(byTestId('document-folder')!.style.paddingLeft);
      const childPadding = parseFloat(childRow.style.paddingLeft);
      expect(childPadding).toBeGreaterThan(parentPadding);
    });

    it('re-emits events from nested children untouched', () => {
      const grandchild = documentNode({ id: 'deep-doc', name: 'deep' });
      const child = folderNode({ id: 'child', name: 'child', expanded: true, children: [grandchild] });
      component.node = folderNode({ id: 'root', name: 'root', expanded: true, children: [child] });
      fixture.detectChanges();
      const spy = jest.fn();
      component.openDocument.subscribe(spy);

      byTestId('document-item')!.click();

      expect(spy).toHaveBeenCalledWith(grandchild.document);
    });
  });

  describe('document rows', () => {
    it('keeps the flat list testid contract and carries the updatedAt tooltip', () => {
      component.node = documentNode();
      fixture.detectChanges();

      const row = byTestId('document-item')!;
      expect(row.getAttribute('data-document-name')).toBe('My Diagram');
      expect(row.getAttribute('title')).toBe('Updated 2026-01-01T00:00:00Z');
      expect(byTestId('document-item-open')).toBeTruthy();
      expect(byTestId('document-item-rename')).toBeTruthy();
      expect(byTestId('document-item-delete')).toBeTruthy();
      expect(byTestId('document-folder')).toBeNull();
    });

    it('emits openDocument with the summary when the row is clicked', () => {
      const node = documentNode();
      component.node = node;
      fixture.detectChanges();
      const spy = jest.fn();
      component.openDocument.subscribe(spy);

      byTestId('document-item')!.click();

      expect(spy).toHaveBeenCalledWith(node.document);
    });

    it('emits openDocument from the Open button without double-firing via the row click', () => {
      const node = documentNode();
      component.node = node;
      fixture.detectChanges();
      const spy = jest.fn();
      component.openDocument.subscribe(spy);

      byTestId('document-item-open')!.click();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(node.document);
    });

    it('emits renameNode with the trimmed new name from a seeded prompt', () => {
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('  Renamed Diagram  ');
      const node = documentNode();
      component.node = node;
      fixture.detectChanges();
      const spy = jest.fn();
      component.renameNode.subscribe(spy);

      byTestId('document-item-rename')!.click();

      expect(promptSpy).toHaveBeenCalledWith('Rename document', 'My Diagram');
      expect(spy).toHaveBeenCalledWith({ node, newName: 'Renamed Diagram' });
    });

    it('does not emit renameNode when the prompt is cancelled or the name is unchanged', () => {
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
      component.node = documentNode();
      fixture.detectChanges();
      const spy = jest.fn();
      component.renameNode.subscribe(spy);

      byTestId('document-item-rename')!.click();
      expect(spy).not.toHaveBeenCalled();

      promptSpy.mockReturnValue('My Diagram');
      byTestId('document-item-rename')!.click();
      expect(spy).not.toHaveBeenCalled();
    });

    it('confirms a document delete with the plain wording and does not emit when declined', () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      component.node = documentNode();
      fixture.detectChanges();
      const spy = jest.fn();
      component.deleteNode.subscribe(spy);

      byTestId('document-item-delete')!.click();

      expect(confirmSpy).toHaveBeenCalledWith('Delete "My Diagram"? This cannot be undone.');
      expect(spy).not.toHaveBeenCalled();
    });

    it('uses the folder prompt label when renaming a folder', () => {
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('renamed');
      component.node = folderNode({ name: 'old folder' });
      fixture.detectChanges();
      const spy = jest.fn();
      component.renameNode.subscribe(spy);

      byTestId('document-folder-rename')!.click();

      expect(promptSpy).toHaveBeenCalledWith('Rename folder', 'old folder');
      expect(spy).toHaveBeenCalled();
    });
  });
});
