import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { DOCUMENT_DRAG_TYPE, DocumentTreeNodeComponent } from './document-tree-node.component';

/**
 * jsdom implements neither DataTransfer nor DragEvent constructors, so drag
 * handlers are exercised by calling them directly with hand-built stubs
 * rather than dispatching real events.
 */
function dragEventStub(types: string[] = [DOCUMENT_DRAG_TYPE], data: Record<string, string> = {}): DragEvent {
  return {
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    dataTransfer: {
      types,
      setData: jest.fn(),
      getData: jest.fn((type: string) => data[type] ?? ''),
      dropEffect: 'none',
      effectAllowed: 'none',
    },
  } as unknown as DragEvent;
}

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
    kind: 'plantuml',
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

    it('emits scopeRequested with the node from the scope button, without toggling the row', () => {
      const node = folderNode({ id: 'scope-me' });
      component.node = node;
      fixture.detectChanges();
      const scopeSpy = jest.fn();
      component.scopeRequested.subscribe(scopeSpy);
      const toggleSpy = jest.fn();
      component.toggleExpand.subscribe(toggleSpy);

      byTestId('document-folder-scope')!.click();

      expect(scopeSpy).toHaveBeenCalledWith(node);
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

    it('shows the MD badge only for markdown documents', () => {
      component.node = documentNode();
      fixture.detectChanges();
      expect(byTestId('document-kind-badge')).toBeNull();

      const summary = { ...documentNode().document!, kind: 'markdown' as const };
      component.node = { ...documentNode(), document: summary };
      fixture.detectChanges();

      expect(byTestId('document-kind-badge')).toBeTruthy();
      expect(byTestId('document-kind-badge')!.textContent).toBe('MD');
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

  describe('active document highlight', () => {
    it('marks the row active (class + aria-current) only when its id matches activeDocumentId', () => {
      component.node = documentNode({ id: 'doc-1' });
      component.activeDocumentId = 'doc-1';
      fixture.detectChanges();

      const row = byTestId('document-item')!;
      expect(row.classList).toContain('document-tree-node__row--active');
      expect(row.getAttribute('aria-current')).toBe('true');
    });

    it('does not mark a non-matching document row or any folder row active', () => {
      component.node = documentNode({ id: 'doc-1' });
      component.activeDocumentId = 'other-doc';
      fixture.detectChanges();
      expect(byTestId('document-item')!.classList).not.toContain('document-tree-node__row--active');
      expect(byTestId('document-item')!.getAttribute('aria-current')).toBeNull();

      // A folder sharing the active id must never highlight -- only documents can be open in the editor.
      component.node = folderNode({ id: 'other-doc' });
      fixture.detectChanges();
      expect(byTestId('document-folder')!.classList).not.toContain('document-tree-node__row--active');
    });

    it('passes activeDocumentId down to nested children', () => {
      const child = documentNode({ id: 'nested-active', name: 'nested' });
      component.node = folderNode({ expanded: true, children: [child] });
      component.activeDocumentId = 'nested-active';
      fixture.detectChanges();

      expect(byTestId('document-item')!.classList).toContain('document-tree-node__row--active');
    });
  });

  describe('drag and drop', () => {
    it('marks document rows draggable and folder rows not', () => {
      component.node = documentNode();
      fixture.detectChanges();
      expect(byTestId('document-item')!.getAttribute('draggable')).toBe('true');

      component.node = folderNode();
      fixture.detectChanges();
      expect(byTestId('document-folder')!.getAttribute('draggable')).toBeNull();
    });

    it('stamps the drag with the custom type carrying the id, plus a text/plain name', () => {
      component.node = documentNode({ id: 'doc-42', name: 'draggable doc' });
      fixture.detectChanges();
      const event = dragEventStub();

      component.onDragStart(event);

      expect(event.dataTransfer!.setData).toHaveBeenCalledWith(DOCUMENT_DRAG_TYPE, 'doc-42');
      expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', 'draggable doc');
      expect(event.dataTransfer!.effectAllowed).toBe('move');
    });

    it('highlights a folder row on dragenter and clears only after every child element is left', () => {
      component.node = folderNode();
      fixture.detectChanges();

      component.onDragEnter(dragEventStub());
      component.onDragEnter(dragEventStub()); // crossing into a child element
      fixture.detectChanges();
      expect(byTestId('document-folder')!.classList).toContain('document-tree-node__row--drop-target');

      component.onDragLeave(dragEventStub()); // leaving the child, still inside the row
      fixture.detectChanges();
      expect(byTestId('document-folder')!.classList).toContain('document-tree-node__row--drop-target');

      component.onDragLeave(dragEventStub());
      fixture.detectChanges();
      expect(byTestId('document-folder')!.classList).not.toContain('document-tree-node__row--drop-target');
    });

    it('ignores drags without the custom document type', () => {
      component.node = folderNode();
      fixture.detectChanges();
      const event = dragEventStub(['Files']);

      component.onDragEnter(event);
      component.onDragOver(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(component.isDragOver).toBe(false);
    });

    it('prevents default and stops propagation on dragover so drop can fire without reaching the root zone', () => {
      component.node = folderNode();
      fixture.detectChanges();
      const event = dragEventStub();

      component.onDragOver(event);

      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.dataTransfer!.dropEffect).toBe('move');
    });

    it('emits moveDocument with the dragged id and this folder as target on drop', () => {
      component.node = folderNode({ id: 'target-folder' });
      fixture.detectChanges();
      const spy = jest.fn();
      component.moveDocument.subscribe(spy);

      component.onDrop(dragEventStub([DOCUMENT_DRAG_TYPE], { [DOCUMENT_DRAG_TYPE]: 'doc-7' }));

      expect(spy).toHaveBeenCalledWith({ documentId: 'doc-7', targetFolderId: 'target-folder' });
      expect(component.isDragOver).toBe(false);
    });

    it('does not emit moveDocument when the drop carries no document id', () => {
      component.node = folderNode();
      fixture.detectChanges();
      const spy = jest.fn();
      component.moveDocument.subscribe(spy);

      component.onDrop(dragEventStub([DOCUMENT_DRAG_TYPE], {}));

      expect(spy).not.toHaveBeenCalled();
    });

    it('emits moveRequested from the Move button without triggering the row click', () => {
      const node = documentNode();
      component.node = node;
      fixture.detectChanges();
      const moveSpy = jest.fn();
      component.moveRequested.subscribe(moveSpy);
      const openSpy = jest.fn();
      component.openDocument.subscribe(openSpy);

      byTestId('document-item-move')!.click();

      expect(moveSpy).toHaveBeenCalledWith(node);
      expect(openSpy).not.toHaveBeenCalled();
    });

    it('re-emits moveDocument and moveRequested from nested children untouched', () => {
      const childDoc = documentNode({ id: 'nested-doc', name: 'nested' });
      component.node = folderNode({ id: 'root', expanded: true, children: [childDoc] });
      fixture.detectChanges();
      const spy = jest.fn();
      component.moveRequested.subscribe(spy);

      byTestId('document-item-move')!.click();

      expect(spy).toHaveBeenCalledWith(childDoc);
    });
  });
});
