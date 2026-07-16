import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportFolderDialogComponent } from './export-folder-dialog.component';

describe('ExportFolderDialogComponent', () => {
  let fixture: ComponentFixture<ExportFolderDialogComponent>;
  let component: ExportFolderDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportFolderDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ExportFolderDialogComponent);
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

    expect(byTestId('export-folder-dialog')).toBeNull();
  });

  it('shows the folder name in the title', () => {
    component.folderName = 'architecture';
    show();

    expect(fixture.nativeElement.textContent).toContain('Export "architecture" as Markdown');
  });

  it('emits confirm with includeExcluded false by default', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    show();
    (byTestId('export-folder-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ includeExcluded: false });
  });

  it('emits confirm with includeExcluded true when the checkbox is ticked', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    show();
    (byTestId('export-folder-dialog-include-excluded') as HTMLInputElement).click();
    fixture.detectChanges();

    (byTestId('export-folder-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith({ includeExcluded: true });
  });

  it('emits cancel when Cancel is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    show();
    (byTestId('export-folder-dialog-cancel') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits cancel when the backdrop is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    show();
    (fixture.nativeElement.querySelector('.export-folder-dialog__backdrop') as HTMLElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('re-seeds the checkbox to unchecked on every open, discarding a prior choice', async () => {
    show();
    component.onIncludeExcludedChange(true);

    component.visible = false;
    fixture.detectChanges();
    show();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((byTestId('export-folder-dialog-include-excluded') as HTMLInputElement).checked).toBe(false);
  });
});
