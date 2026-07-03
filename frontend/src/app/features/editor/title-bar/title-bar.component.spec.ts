import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  let fixture: ComponentFixture<TitleBarComponent>;
  let component: TitleBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(TitleBarComponent);
    component = fixture.componentInstance;
    component.documentName = 'Untitled diagram';
    fixture.detectChanges();
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('shows "name — Trellis" in the command center', () => {
    expect(byTestId('title-bar-title').textContent).toBe('Untitled diagram — Trellis');
  });

  it('updates the command center when the document name changes', () => {
    component.documentName = 'order-flow.puml';
    fixture.detectChanges();

    expect(byTestId('title-bar-title').textContent).toBe('order-flow.puml — Trellis');
  });

  it('renders the app menu entries', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.title-bar__menu')).map(
      (button) => (button as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['File', 'Edit', 'View', 'Help']);
  });

  describe('File menu (D-012)', () => {
    function fileTrigger(): HTMLButtonElement {
      return byTestId('title-bar-menu-file') as HTMLButtonElement;
    }

    it('is closed by default and opens on File click with the three commands and honest shortcuts', () => {
      expect(byTestId('title-bar-menu-item-new')).toBeNull();
      expect(fileTrigger().getAttribute('aria-expanded')).toBe('false');

      fileTrigger().click();
      fixture.detectChanges();

      expect(fileTrigger().getAttribute('aria-expanded')).toBe('true');
      expect(byTestId('title-bar-menu-item-new').textContent).toContain('Alt+N');
      expect(byTestId('title-bar-menu-item-save').textContent).toContain('Ctrl+S');
      expect(byTestId('title-bar-menu-item-upload').textContent).toContain('Ctrl+U');
    });

    it('emits the matching output and closes on each item click', () => {
      const newSpy = jest.fn();
      const saveSpy = jest.fn();
      const uploadSpy = jest.fn();
      component.newDocument.subscribe(newSpy);
      component.save.subscribe(saveSpy);
      component.uploadRequested.subscribe(uploadSpy);

      for (const [testId, spy] of [
        ['title-bar-menu-item-new', newSpy],
        ['title-bar-menu-item-save', saveSpy],
        ['title-bar-menu-item-upload', uploadSpy],
      ] as const) {
        fileTrigger().click();
        fixture.detectChanges();

        (byTestId(testId) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(byTestId(testId)).toBeNull();
      }
    });

    it('closes on Escape and on a click outside the title bar', () => {
      fileTrigger().click();
      fixture.detectChanges();
      expect(byTestId('title-bar-menu-item-new')).toBeTruthy();

      component.onEscape();
      fixture.detectChanges();
      expect(byTestId('title-bar-menu-item-new')).toBeNull();

      fileTrigger().click();
      fixture.detectChanges();

      document.body.click();
      fixture.detectChanges();
      expect(byTestId('title-bar-menu-item-new')).toBeNull();
    });

    it('toggles closed when File is clicked again', () => {
      fileTrigger().click();
      fixture.detectChanges();
      fileTrigger().click();
      fixture.detectChanges();

      expect(byTestId('title-bar-menu-item-new')).toBeNull();
      expect(fileTrigger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('emits sidebarToggle from the primary-sidebar layout toggle', () => {
    const spy = jest.fn();
    component.sidebarToggle.subscribe(spy);

    (byTestId('title-bar-sidebar-toggle') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('fills the sidebar toggle only while a side panel is open', () => {
    expect(byTestId('title-bar-sidebar-toggle').classList).not.toContain('title-bar__layout-toggle--active');

    component.sidePanelOpen = true;
    fixture.detectChanges();

    expect(byTestId('title-bar-sidebar-toggle').classList).toContain('title-bar__layout-toggle--active');
  });

  it('gives every icon-only control an aria-label', () => {
    const iconButtons = fixture.nativeElement.querySelectorAll(
      '.title-bar__layout-toggle, .title-bar__window-control, .title-bar__command-center',
    );
    for (const button of Array.from(iconButtons)) {
      expect((button as HTMLElement).getAttribute('aria-label')).toBeTruthy();
    }
  });
});
