import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Folder } from '../../../core/models/folder.model';
import { MoveDocumentDialogComponent } from './move-document-dialog.component';

const NBSP_INDENT = '    ';

describe('MoveDocumentDialogComponent', () => {
  let fixture: ComponentFixture<MoveDocumentDialogComponent>;
  let component: MoveDocumentDialogComponent;

  const folders: Folder[] = [
    { id: 'a', name: 'architecture', parentFolderId: null },
    { id: 'a-c4', name: 'c4', parentFolderId: 'a' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoveDocumentDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MoveDocumentDialogComponent);
    component = fixture.componentInstance;
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function show(currentFolderId: string | null = null): void {
    component.folders = folders;
    component.ngOnChanges({ folders: { currentValue: folders } as never });
    component.visible = true;
    component.currentFolderId = currentFolderId;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();
  }

  it('renders nothing when not visible', () => {
    component.visible = false;
    fixture.detectChanges();

    expect(byTestId('move-document-dialog')).toBeNull();
  });

  it('shows the document name in the title', () => {
    component.documentName = 'sequence-diagram';
    show();

    expect(fixture.nativeElement.textContent).toContain('Move "sequence-diagram"');
  });

  it('offers a root option plus every folder, nested folders nbsp-indented', () => {
    show();

    const options = Array.from(
      (byTestId('move-document-dialog-folder') as HTMLSelectElement).options,
    ).map((option) => option.textContent);
    expect(options).toEqual(['(No folder)', 'architecture', `${NBSP_INDENT}c4`]);
  });

  it('preselects the document\'s current folder on open', async () => {
    show('a-c4');
    await fixture.whenStable();
    fixture.detectChanges();

    expect((byTestId('move-document-dialog-folder') as HTMLSelectElement).value).toBe('a-c4');
  });

  it('emits confirm with the selected folder id', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    show();
    const select = byTestId('move-document-dialog-folder') as HTMLSelectElement;
    select.value = 'a';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (byTestId('move-document-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ folderId: 'a' });
  });

  it('emits confirm with null when "(No folder)" is chosen', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    show('a');
    const select = byTestId('move-document-dialog-folder') as HTMLSelectElement;
    select.value = '';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (byTestId('move-document-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ folderId: null });
  });

  it('emits cancel when Cancel is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    show();
    (byTestId('move-document-dialog-cancel') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits cancel when the backdrop is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    show();
    (fixture.nativeElement.querySelector('.move-document-dialog__backdrop') as HTMLElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-seeds the selection from currentFolderId on every open, discarding a prior choice', async () => {
    show('a');
    component.onFolderChange('a-c4');

    component.visible = false;
    fixture.detectChanges();
    show('a');
    await fixture.whenStable();
    fixture.detectChanges();

    expect((byTestId('move-document-dialog-folder') as HTMLSelectElement).value).toBe('a');
  });
});
