import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentTreeNode } from '../../../core/models/document-tree-node.model';
import { DOCUMENT_DRAG_TYPE, DocumentTreeNodeComponent } from './document-tree-node.component';

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
  return { id: 'folder-1', name: 'diagrams', kind: 'folder', children: [], expanded: false, ...overrides };
}

function documentNode(overrides: Partial<DocumentTreeNode> = {}): DocumentTreeNode {
  const document: DocumentSummary = {
    id: 'doc-1',
    name: 'My Diagram',
    updatedAt: '2026-01-01T00:00:00Z',
    folderId: null,
    kind: 'plantuml',
    excludedFromExport: false,
  };
  return { id: document.id, name: document.name, kind: 'document', document, ...overrides };
}

describe('DocumentTreeNodeComponent', () => {
  let fixture: ComponentFixture<DocumentTreeNodeComponent>;
  let component: DocumentTreeNodeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DocumentTreeNodeComponent] }).compileComponents();
    fixture = TestBed.createComponent(DocumentTreeNodeComponent);
    component = fixture.componentInstance;
  });

  function row(): HTMLElement {
    return fixture.nativeElement.querySelector('[data-testid="document-folder"], [data-testid="document-item"]');
  }

  it('renders an accessible folder row and toggles it by click or Enter', () => {
    const node = folderNode({ name: 'architecture' });
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.toggleExpand.subscribe(spy);

    expect(row().getAttribute('data-folder-name')).toBe('architecture');
    expect(row().getAttribute('role')).toBe('treeitem');
    expect(row().getAttribute('aria-haspopup')).toBe('menu');
    row().click();
    row().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('renders a document row with active, kind, and export-exclusion state', () => {
    const summary = { ...documentNode().document!, kind: 'markdown' as const, excludedFromExport: true };
    const node = documentNode({ document: summary });
    component.node = node;
    component.activeDocumentId = node.id;
    fixture.detectChanges();

    expect(row().getAttribute('data-document-name')).toBe('My Diagram');
    expect(row().classList).toContain('document-tree-node__row--active');
    expect(row().classList).toContain('document-tree-node__row--excluded');
    expect(fixture.nativeElement.querySelector('[data-testid="document-kind-badge"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="document-excluded-badge"]')).toBeTruthy();
  });

  it('opens a document by ordinary row click', () => {
    const node = documentNode();
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.openDocument.subscribe(spy);
    row().click();
    expect(spy).toHaveBeenCalledWith(node.document);
  });

  it('right-click emits the node, coordinates, and trigger without activating the row', () => {
    const node = documentNode();
    component.node = node;
    fixture.detectChanges();
    const menuSpy = jest.fn();
    const openSpy = jest.fn();
    component.contextMenuRequested.subscribe(menuSpy);
    component.openDocument.subscribe(openSpy);
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 30, clientY: 50 });

    row().dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(menuSpy).toHaveBeenCalledWith({ target: node, clientX: 30, clientY: 50, triggerElement: row() });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the context menu from the keyboard and bubbles nested requests', () => {
    const child = documentNode({ id: 'nested', name: 'Nested' });
    component.node = folderNode({ expanded: true, children: [child] });
    fixture.detectChanges();
    const spy = jest.fn();
    component.contextMenuRequested.subscribe(spy);
    const childRow = fixture.nativeElement.querySelector('[data-testid="document-item"]') as HTMLElement;

    childRow.dispatchEvent(new KeyboardEvent('keydown', { key: 'ContextMenu', bubbles: true, cancelable: true }));

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ target: child, triggerElement: childRow }));
  });

  it('marks the active context-menu target', () => {
    const node = folderNode();
    component.node = node;
    component.contextMenuTarget = node;
    fixture.detectChanges();
    expect(row().classList).toContain('document-tree-node__row--context-target');
  });

  it('recursively renders expanded folder children', () => {
    component.node = folderNode({ expanded: true, children: [documentNode(), folderNode({ id: 'nested-folder' })] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('[role="treeitem"]')).toHaveLength(3);
  });

  it('starts document drags with Trellis and plain-text transfer data', () => {
    component.node = documentNode();
    fixture.detectChanges();
    const event = dragEventStub();
    component.onDragStart(event);
    expect(event.dataTransfer!.setData).toHaveBeenCalledWith(DOCUMENT_DRAG_TYPE, 'doc-1');
    expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', 'My Diagram');
    expect(event.dataTransfer!.effectAllowed).toBe('move');
  });

  it('accepts Trellis document drags and emits a move on drop', () => {
    component.node = folderNode({ id: 'target-folder' });
    fixture.detectChanges();
    const spy = jest.fn();
    component.moveDocument.subscribe(spy);
    const enter = dragEventStub();
    component.onDragEnter(enter);
    component.onDragOver(enter);
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(enter.stopPropagation).toHaveBeenCalled();
    expect(component.isDragOver).toBe(true);

    component.onDrop(dragEventStub([DOCUMENT_DRAG_TYPE], { [DOCUMENT_DRAG_TYPE]: 'doc-7' }));
    expect(spy).toHaveBeenCalledWith({ documentId: 'doc-7', targetFolderId: 'target-folder' });
    expect(component.isDragOver).toBe(false);
  });

  it('ignores unrelated drags and balances nested dragenter/dragleave events', () => {
    component.node = folderNode();
    fixture.detectChanges();
    const unrelated = dragEventStub(['Files']);
    component.onDragEnter(unrelated);
    expect(unrelated.preventDefault).not.toHaveBeenCalled();

    component.onDragEnter(dragEventStub());
    component.onDragEnter(dragEventStub());
    component.onDragLeave(dragEventStub());
    expect(component.isDragOver).toBe(true);
    component.onDragLeave(dragEventStub());
    expect(component.isDragOver).toBe(false);
  });
});
