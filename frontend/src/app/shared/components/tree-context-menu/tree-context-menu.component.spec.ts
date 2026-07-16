import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';

import { TreeContextMenuComponent } from './tree-context-menu.component';

describe('TreeContextMenuComponent', () => {
  let fixture: ComponentFixture<TreeContextMenuComponent>;
  let component: TreeContextMenuComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TreeContextMenuComponent] }).compileComponents();
    fixture = TestBed.createComponent(TreeContextMenuComponent);
    component = fixture.componentInstance;
    component.items = [
      { id: 'open', label: 'Open' },
      { id: 'disabled', label: 'Unavailable', disabled: true },
      { id: 'delete', label: 'Delete', separatorBefore: true, danger: true },
    ];
    component.clientX = 100;
    component.clientY = 120;
    fixture.detectChanges();
  });

  function item(command: string): HTMLButtonElement {
    return fixture.nativeElement.querySelector(`[data-command="${command}"]`);
  }

  it('renders text commands, separators, disabled state, and danger state', () => {
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(item('open').textContent).toContain('Open');
    expect(item('disabled').disabled).toBe(true);
    expect(item('delete').classList).toContain('tree-context-menu__item--danger');
    expect(fixture.nativeElement.querySelector('[role="separator"]')).toBeTruthy();
  });

  it('emits a stable command id when an enabled item is selected', async () => {
    const spy = jest.fn();
    component.commandSelected.subscribe(spy);
    item('open').click();
    item('disabled').click();
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith('open');
  });

  it('supports arrow, Home/End, Enter, and Escape keyboard behavior', async () => {
    const commandSpy = jest.fn();
    const closeSpy = jest.fn();
    component.commandSelected.subscribe(commandSpy);
    component.menuClosed.subscribe(closeSpy);

    item('open').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(item('delete'));
    item('delete').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, 120));
    expect(commandSpy).toHaveBeenCalledWith('delete');
    item('delete').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(item('open'));
    item('open').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(closeSpy).toHaveBeenCalledWith({ restoreFocus: true });
  });

  it('closes without stealing focus for outside pointer and Tab', () => {
    const spy = jest.fn();
    component.menuClosed.subscribe(spy);
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    item('open').dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith({ restoreFocus: false });
  });

  it('clamps its coordinates to the viewport', fakeAsync(() => {
    component.clientX = window.innerWidth + 500;
    component.clientY = window.innerHeight + 500;
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('[data-testid="tree-context-menu"]') as HTMLElement;
    expect(parseFloat(menu.style.left)).toBeLessThanOrEqual(window.innerWidth - 4);
    expect(parseFloat(menu.style.top)).toBeLessThanOrEqual(window.innerHeight - 4);
  }));
});
