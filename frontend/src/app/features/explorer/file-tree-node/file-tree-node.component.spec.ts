import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExplorerTreeNode } from '../../../core/models/explorer-tree-node.model';
import { FileTreeNodeComponent } from './file-tree-node.component';

function fakeNode(overrides: Partial<ExplorerTreeNode> = {}): ExplorerTreeNode {
  return {
    name: 'src',
    kind: 'directory',
    handle: {} as FileSystemHandle,
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
    await TestBed.configureTestingModule({ imports: [FileTreeNodeComponent] }).compileComponents();
    fixture = TestBed.createComponent(FileTreeNodeComponent);
    component = fixture.componentInstance;
  });

  function rows(): HTMLElement[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="file-tree-node"]'));
  }

  it('renders the node with depth indentation and accessible tree semantics', () => {
    component.node = fakeNode({ name: 'diagrams' });
    component.depth = 2;
    fixture.detectChanges();

    const row = rows()[0];
    expect(row.textContent).toContain('diagrams');
    expect(parseFloat(row.style.paddingLeft)).toBeGreaterThan(8);
    expect(row.getAttribute('role')).toBe('treeitem');
    expect(row.getAttribute('aria-haspopup')).toBe('menu');
    expect(row.tabIndex).toBe(0);
  });

  it('renders and rotates a directory chevron but omits it for files', () => {
    component.node = fakeNode({ expanded: true });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-chevron"]').classList).toContain(
      'file-tree-node__chevron--expanded',
    );

    component.node = fakeNode({ kind: 'file' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-chevron"]')).toBeNull();
  });

  it('shows the loading spinner only while a node is loading', () => {
    component.node = fakeNode({ loadState: 'loading' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-spinner"]')).toBeTruthy();
    component.node = fakeNode({ loadState: 'loaded' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="file-tree-node-spinner"]')).toBeNull();
  });

  it('clicking or pressing Enter performs the row primary action', () => {
    const node = fakeNode();
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.toggleExpand.subscribe(spy);

    rows()[0].click();
    rows()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(node);
  });

  it('emits fileClicked for a file row', () => {
    const node = fakeNode({ kind: 'file', name: 'diagram.puml' });
    component.node = node;
    fixture.detectChanges();
    const spy = jest.fn();
    component.fileClicked.subscribe(spy);
    rows()[0].click();
    expect(spy).toHaveBeenCalledWith(node);
  });

  it('recursively renders expanded children and bubbles their ordinary events', () => {
    const child = fakeNode({ kind: 'file', name: 'deep.puml' });
    component.node = fakeNode({ expanded: true, children: [child] });
    fixture.detectChanges();
    const spy = jest.fn();
    component.fileClicked.subscribe(spy);
    expect(rows()).toHaveLength(2);
    rows()[1].click();
    expect(spy).toHaveBeenCalledWith(child);
  });

  it('right-click emits its node, parent, coordinates, and trigger without opening the row', () => {
    const node = fakeNode({ kind: 'file' });
    const parentNode = fakeNode({ name: 'root' });
    component.node = node;
    component.parentNode = parentNode;
    fixture.detectChanges();
    const menuSpy = jest.fn();
    const openSpy = jest.fn();
    component.contextMenuRequested.subscribe(menuSpy);
    component.fileClicked.subscribe(openSpy);

    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 70, clientY: 80 });
    rows()[0].dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(menuSpy).toHaveBeenCalledWith({
      target: { node, parentNode },
      clientX: 70,
      clientY: 80,
      triggerElement: rows()[0],
    });
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('opens the same context request from Shift+F10 and bubbles nested requests', () => {
    const child = fakeNode({ kind: 'file', name: 'deep.puml' });
    const root = fakeNode({ expanded: true, children: [child] });
    component.node = root;
    fixture.detectChanges();
    const spy = jest.fn();
    component.contextMenuRequested.subscribe(spy);

    rows()[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }));

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ target: { node: child, parentNode: root }, triggerElement: rows()[1] }),
    );
  });

  it('marks the currently menu-targeted row', () => {
    const node = fakeNode();
    component.node = node;
    component.contextMenuTarget = node;
    fixture.detectChanges();
    expect(rows()[0].classList).toContain('file-tree-node__row--context-target');
  });
});
