import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Folder } from '../../../core/models/folder.model';
import { SaveDialogComponent } from './save-dialog.component';

describe('SaveDialogComponent', () => {
  let fixture: ComponentFixture<SaveDialogComponent>;
  let component: SaveDialogComponent;

  const folders: Folder[] = [
    { id: 'a', name: 'architecture', parentFolderId: null },
    { id: 'a-c4', name: 'c4', parentFolderId: 'a' },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SaveDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SaveDialogComponent);
    component = fixture.componentInstance;
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function show(): void {
    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();
  }

  it('renders nothing when not visible', () => {
    component.visible = false;
    fixture.detectChanges();

    expect(byTestId('save-dialog')).toBeNull();
  });

  it('pre-fills the name field with initialName when it becomes visible', async () => {
    component.initialName = 'My Diagram';
    show();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(byTestId('save-dialog')).toBeTruthy();
    expect((byTestId('save-dialog-name') as HTMLInputElement).value).toBe('My Diagram');
  });

  it('emits confirm with the trimmed name and a null folder by default', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    component.initialName = '';
    show();

    const input = byTestId('save-dialog-name') as HTMLInputElement;
    input.value = '  New Name  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (byTestId('save-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ name: 'New Name', folderId: null });
  });

  it('does not emit confirm for a blank name', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    show();

    (byTestId('save-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits cancel when Cancel is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    show();

    (byTestId('save-dialog-cancel') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not render the folder select for existing-document saves (folder selection disabled)', () => {
    component.folders = folders;
    component.folderSelectionEnabled = false;
    component.ngOnChanges({ folders: { currentValue: folders } as never });
    show();

    expect(byTestId('save-dialog')).toBeTruthy();
    expect(byTestId('save-dialog-folder')).toBeNull();
  });

  describe('destination folder select', () => {
    beforeEach(() => {
      component.folders = folders;
      component.folderSelectionEnabled = true;
      component.ngOnChanges({ folders: { currentValue: folders } as never });
    });

    it('lists "(No folder)" first, then the folders depth-first with indentation', () => {
      show();

      const select = byTestId('save-dialog-folder') as HTMLSelectElement;
      const labels = Array.from(select.options).map((option) => option.textContent?.trim());
      expect(labels?.[0]).toBe('(No folder)');
      expect(labels?.[1]).toBe('architecture');
      // The nested folder is indented with non-breaking spaces (trimmed away above).
      expect(labels?.[2]).toBe('c4');
      expect(select.options[2].value).toBe('a-c4');
      expect(select.value).toBe('');
    });

    it('emits the selected folder id on confirm', () => {
      const spy = jest.fn();
      component.confirm.subscribe(spy);
      component.initialName = 'Doc';
      show();

      const select = byTestId('save-dialog-folder') as HTMLSelectElement;
      select.value = 'a';
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();

      (byTestId('save-dialog-confirm') as HTMLButtonElement).click();

      expect(spy).toHaveBeenCalledWith({ name: 'Doc', folderId: 'a' });
    });

    it('resets the selection to "(No folder)" every time the dialog reopens', () => {
      show();
      component.onFolderChange('a');
      expect(component.selectedFolderId()).toBe('a');

      component.ngOnChanges({ visible: { currentValue: true } as never });

      expect(component.selectedFolderId()).toBeNull();
    });
  });
});
