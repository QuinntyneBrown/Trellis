import { ComponentFixture, TestBed } from '@angular/core/testing';

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

  // setInput (not property assignment) so ngOnChanges genuinely fires --
  // that's the code path the reposition scheduling lives on. The reposition
  // runs in a real microtask (zone's fakeAsync does not capture
  // queueMicrotask here), so queue one behind it and await that instead.
  it('clamps its coordinates to the viewport when repositioned', async () => {
    fixture.componentRef.setInput('clientX', window.innerWidth + 500);
    fixture.componentRef.setInput('clientY', window.innerHeight + 500);
    fixture.detectChanges();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    fixture.detectChanges();
    const menu = fixture.nativeElement.querySelector('[data-testid="tree-context-menu"]') as HTMLElement;
    const left = parseFloat(menu.style.left);
    const top = parseFloat(menu.style.top);
    // Greater than the initial (100, 120) position proves the reposition ran
    // at all; the upper bounds prove the clamp pulled it back inside the
    // viewport from the far-outside requested coordinates.
    expect(left).toBeGreaterThan(100);
    expect(left).toBeLessThanOrEqual(window.innerWidth - 4);
    expect(top).toBeGreaterThan(120);
    expect(top).toBeLessThanOrEqual(window.innerHeight - 4);
  });

  // Regression: an items binding that churns array references every
  // change-detection pass (the pre-fix consumer getters) must not schedule
  // reposition/focus work -- that microtask re-triggered zone change
  // detection, which minted another reference, looping until the tab hung.
  it('does not reposition or steal focus when only the items reference changes', async () => {
    const spy = jest.spyOn(component as unknown as { positionAndFocus(): void }, 'positionAndFocus');
    fixture.componentRef.setInput('items', [...component.items]);
    fixture.detectChanges();
    // Any microtask the component (wrongly) scheduled was queued before this
    // one, so it has run by the time the await resolves.
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(spy).not.toHaveBeenCalled();
  });

  it('resets the active item to the first enabled item when the items input changes', () => {
    fixture.componentRef.setInput('items', [
      { id: 'disabled-first', label: 'Unavailable', disabled: true },
      { id: 'open', label: 'Open' },
    ]);
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(1);
  });
});
