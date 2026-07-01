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
});
