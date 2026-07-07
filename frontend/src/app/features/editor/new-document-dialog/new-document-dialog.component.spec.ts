import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Folder } from '../../../core/models/folder.model';
import { NewDocumentDialogComponent } from './new-document-dialog.component';

describe('NewDocumentDialogComponent', () => {
  let fixture: ComponentFixture<NewDocumentDialogComponent>;
  let component: NewDocumentDialogComponent;

  const folders: Folder[] = [
    { id: 'a', name: 'architecture', parentFolderId: null },
    { id: 'a-c4', name: 'c4', parentFolderId: 'a' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewDocumentDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(NewDocumentDialogComponent);
    component = fixture.componentInstance;
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function show(): void {
    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true, isFirstChange: () => false } as never });
    fixture.detectChanges();
  }

  it('renders nothing when not visible', () => {
    component.visible = false;
    fixture.detectChanges();

    expect(byTestId('new-document-dialog')).toBeNull();
  });

  it('always shows the Type and Folder selects (unlike the Save dialog, this is always a create)', () => {
    show();

    expect(byTestId('new-document-dialog-kind')).toBeTruthy();
    expect(byTestId('new-document-dialog-folder')).toBeTruthy();
  });

  it('starts blank with defaults on every open', async () => {
    show();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((byTestId('new-document-dialog-name') as HTMLInputElement).value).toBe('');
    expect((byTestId('new-document-dialog-kind') as HTMLSelectElement).value).toBe('plantuml');
    expect((byTestId('new-document-dialog-folder') as HTMLSelectElement).value).toBe('');
    expect((byTestId('new-document-dialog-create-another') as HTMLInputElement).checked).toBe(false);
  });

  it('emits create with the trimmed name, folder, kind and createAnother flag', () => {
    const spy = jest.fn();
    component.create.subscribe(spy);
    component.folders = folders;
    component.ngOnChanges({ folders: { currentValue: folders, isFirstChange: () => false } as never });
    show();

    const nameInput = byTestId('new-document-dialog-name') as HTMLInputElement;
    nameInput.value = '  New Diagram  ';
    nameInput.dispatchEvent(new Event('input'));

    const kindSelect = byTestId('new-document-dialog-kind') as HTMLSelectElement;
    kindSelect.value = 'markdown';
    kindSelect.dispatchEvent(new Event('change'));

    const folderSelect = byTestId('new-document-dialog-folder') as HTMLSelectElement;
    folderSelect.value = 'a';
    folderSelect.dispatchEvent(new Event('change'));

    const createAnotherCheckbox = byTestId('new-document-dialog-create-another') as HTMLInputElement;
    createAnotherCheckbox.checked = true;
    createAnotherCheckbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    (byTestId('new-document-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ name: 'New Diagram', folderId: 'a', kind: 'markdown', createAnother: true });
  });

  it('does not emit create for a blank name', () => {
    const spy = jest.fn();
    component.create.subscribe(spy);

    show();

    (byTestId('new-document-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits close when Close is clicked', () => {
    const spy = jest.fn();
    component.close.subscribe(spy);

    show();

    (byTestId('new-document-dialog-close') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits close on backdrop click', () => {
    const spy = jest.fn();
    component.close.subscribe(spy);

    show();

    (fixture.nativeElement.querySelector('.new-document-dialog__backdrop') as HTMLElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('lists "(No folder)" first, then the folders depth-first with indentation', () => {
    component.folders = folders;
    component.ngOnChanges({ folders: { currentValue: folders, isFirstChange: () => false } as never });
    show();

    const select = byTestId('new-document-dialog-folder') as HTMLSelectElement;
    const labels = Array.from(select.options).map((option) => option.textContent?.trim());
    expect(labels?.[0]).toBe('(No folder)');
    expect(labels?.[1]).toBe('architecture');
    expect(labels?.[2]).toBe('c4');
    expect(select.options[2].value).toBe('a-c4');
  });

  describe('clearNameToken', () => {
    it('clears only the name field, preserving the folder and type choices', () => {
      show();
      component.onNameInput('Some Name');
      component.onFolderChange('a');
      component.onKindChange('markdown');
      component.onCreateAnotherChange(true);

      component.clearNameToken = 1;
      component.ngOnChanges({ clearNameToken: { currentValue: 1, isFirstChange: () => false } as never });

      expect(component.name()).toBe('');
      expect(component.selectedFolderId()).toBe('a');
      expect(component.selectedKind()).toBe('markdown');
      expect(component.createAnother()).toBe(true);
    });

    it('does not clear the name on the initial change (dialog first constructed)', () => {
      component.onNameInput('Untouched');
      component.ngOnChanges({ clearNameToken: { currentValue: 0, isFirstChange: () => true } as never });

      expect(component.name()).toBe('Untouched');
    });
  });

  it('resets everything (including createAnother) every time the dialog reopens', () => {
    show();
    component.onNameInput('Draft');
    component.onFolderChange('a');
    component.onKindChange('markdown');
    component.onCreateAnotherChange(true);

    component.ngOnChanges({ visible: { currentValue: true, isFirstChange: () => false } as never });

    expect(component.name()).toBe('');
    expect(component.selectedFolderId()).toBeNull();
    expect(component.selectedKind()).toBe('plantuml');
    expect(component.createAnother()).toBe(false);
  });
});
