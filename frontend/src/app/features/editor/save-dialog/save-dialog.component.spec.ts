import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SaveDialogComponent } from './save-dialog.component';

describe('SaveDialogComponent', () => {
  let fixture: ComponentFixture<SaveDialogComponent>;
  let component: SaveDialogComponent;

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

  it('renders nothing when not visible', () => {
    component.visible = false;
    fixture.detectChanges();

    expect(byTestId('save-dialog')).toBeNull();
  });

  it('pre-fills the name field with initialName when it becomes visible', async () => {
    component.initialName = 'My Diagram';
    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(byTestId('save-dialog')).toBeTruthy();
    expect((byTestId('save-dialog-name') as HTMLInputElement).value).toBe('My Diagram');
  });

  it('emits confirm with the trimmed name when Save is clicked', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    component.initialName = '';
    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();

    const input = byTestId('save-dialog-name') as HTMLInputElement;
    input.value = '  New Name  ';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (byTestId('save-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith('New Name');
  });

  it('does not emit confirm for a blank name', () => {
    const spy = jest.fn();
    component.confirm.subscribe(spy);

    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();

    (byTestId('save-dialog-confirm') as HTMLButtonElement).click();

    expect(spy).not.toHaveBeenCalled();
  });

  it('emits cancel when Cancel is clicked', () => {
    const spy = jest.fn();
    component.cancel.subscribe(spy);

    component.visible = true;
    component.ngOnChanges({ visible: { currentValue: true } as never });
    fixture.detectChanges();

    (byTestId('save-dialog-cancel') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
