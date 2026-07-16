import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditorToolbarComponent } from './editor-toolbar.component';

describe('EditorToolbarComponent', () => {
  let fixture: ComponentFixture<EditorToolbarComponent>;
  let component: EditorToolbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorToolbarComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorToolbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('renders the panel toggles and connection status -- the New/Save/Upload actions live in the hamburger File menu', () => {
    expect(byTestId('editor-toolbar')).toBeTruthy();
    expect(byTestId('rail-hamburger')).toBeTruthy();
    expect(byTestId('templates-panel-toggle')).toBeTruthy();
    expect(byTestId('documents-panel-toggle')).toBeTruthy();
    expect(byTestId('connection-status')).toBeTruthy();
    expect(byTestId('toolbar-new')).toBeNull();
    expect(byTestId('toolbar-save')).toBeNull();
    expect(byTestId('toolbar-upload')).toBeNull();
  });

  describe('application (hamburger) menu', () => {
    function hamburger(): HTMLButtonElement {
      return byTestId('rail-hamburger') as HTMLButtonElement;
    }

    function fileEntry(): HTMLButtonElement {
      return byTestId('rail-menu-file') as HTMLButtonElement;
    }

    function openFileSubmenu(): void {
      hamburger().click();
      fixture.detectChanges();
      fileEntry().click();
      fixture.detectChanges();
    }

    it('is closed by default and opens on hamburger click with the four chevroned entries', () => {
      expect(byTestId('rail-menu-file')).toBeNull();
      expect(hamburger().getAttribute('aria-expanded')).toBe('false');
      expect(hamburger().getAttribute('aria-haspopup')).toBe('menu');

      hamburger().click();
      fixture.detectChanges();

      expect(hamburger().getAttribute('aria-expanded')).toBe('true');
      const entries = Array.from(fixture.nativeElement.querySelectorAll('.editor-toolbar__menu-entry')).map(
        (entry) => (entry as HTMLElement).querySelector('.editor-toolbar__menu-entry-label')?.textContent?.trim(),
      );
      expect(entries).toEqual(['File', 'Edit', 'View', 'Help']);
      for (const entry of Array.from(
        fixture.nativeElement.querySelectorAll('.editor-toolbar__menu-entry'),
      ) as HTMLElement[]) {
        expect(entry.getAttribute('aria-haspopup')).toBe('menu');
        expect(entry.querySelector('.editor-toolbar__menu-entry-chevron')).toBeTruthy();
      }
    });

    it('keeps the File submenu closed until File is clicked, then shows the three commands with honest shortcuts', () => {
      hamburger().click();
      fixture.detectChanges();
      expect(byTestId('rail-menu-item-new')).toBeNull();
      expect(fileEntry().getAttribute('aria-expanded')).toBe('false');

      fileEntry().click();
      fixture.detectChanges();

      expect(fileEntry().getAttribute('aria-expanded')).toBe('true');
      expect(byTestId('rail-menu-item-new').textContent).toContain('Alt+N');
      expect(byTestId('rail-menu-item-save').textContent).toContain('Ctrl+S');
      expect(byTestId('rail-menu-item-upload').textContent).toContain('Ctrl+U');
    });

    it('expands the File submenu on hover and collapses it when an inert entry is hovered', () => {
      hamburger().click();
      fixture.detectChanges();

      fileEntry().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(byTestId('rail-menu-item-new')).toBeTruthy();

      const inertEntries = fixture.nativeElement.querySelectorAll('.editor-toolbar__menu-entry');
      (inertEntries[1] as HTMLElement).dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
      expect(byTestId('rail-menu-item-new')).toBeNull();
    });

    it('emits the matching output and closes the whole menu on each File command click', () => {
      const newSpy = jest.fn();
      const saveSpy = jest.fn();
      const uploadSpy = jest.fn();
      component.newDocument.subscribe(newSpy);
      component.save.subscribe(saveSpy);
      component.uploadRequested.subscribe(uploadSpy);

      for (const [testId, spy] of [
        ['rail-menu-item-new', newSpy],
        ['rail-menu-item-save', saveSpy],
        ['rail-menu-item-upload', uploadSpy],
      ] as const) {
        openFileSubmenu();

        (byTestId(testId) as HTMLButtonElement).click();
        fixture.detectChanges();

        expect(spy).toHaveBeenCalledTimes(1);
        expect(byTestId(testId)).toBeNull();
        expect(byTestId('rail-menu-file')).toBeNull();
      }
    });

    it('closes on Escape and on a click outside the rail, returning focus to the hamburger on Escape', () => {
      openFileSubmenu();
      expect(byTestId('rail-menu-item-new')).toBeTruthy();

      component.onEscape();
      fixture.detectChanges();
      expect(byTestId('rail-menu-file')).toBeNull();
      expect(document.activeElement).toBe(hamburger());

      hamburger().click();
      fixture.detectChanges();

      document.body.click();
      fixture.detectChanges();
      expect(byTestId('rail-menu-file')).toBeNull();
    });

    it('toggles closed when the hamburger is clicked again', () => {
      hamburger().click();
      fixture.detectChanges();
      hamburger().click();
      fixture.detectChanges();

      expect(byTestId('rail-menu-file')).toBeNull();
      expect(hamburger().getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('emits documentsPanelToggle when the documents panel toggle is clicked', () => {
    const spy = jest.fn();
    component.documentsPanelToggle.subscribe(spy);

    byTestId('documents-panel-toggle').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('emits templatesPanelToggle and reflects the active state on the templates toggle', () => {
    const spy = jest.fn();
    component.templatesPanelToggle.subscribe(spy);

    byTestId('templates-panel-toggle').click();
    expect(spy).toHaveBeenCalledTimes(1);

    expect(byTestId('templates-panel-toggle').classList).not.toContain('rail-button--active');
    component.activeSidePanel = 'templates';
    fixture.detectChanges();
    expect(byTestId('templates-panel-toggle').classList).toContain('rail-button--active');
  });

  it('forwards connectionState down to the connection-status indicator', () => {
    component.connectionState = 'reconnecting';
    fixture.detectChanges();

    expect(byTestId('connection-status').textContent).toBe('reconnecting');
  });

  describe('Explorer rail button', () => {
    it('is absent when explorerSupported is false (the default)', () => {
      expect(byTestId('toolbar-explorer')).toBeNull();
    });

    it('renders when explorerSupported is true', () => {
      component.explorerSupported = true;
      fixture.detectChanges();

      expect(byTestId('toolbar-explorer')).toBeTruthy();
    });

    it('emits explorerPanelToggle when clicked', () => {
      component.explorerSupported = true;
      fixture.detectChanges();
      const spy = jest.fn();
      component.explorerPanelToggle.subscribe(spy);

      byTestId('toolbar-explorer').click();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('active side panel indicator', () => {
    it('applies the active modifier to the Explorer button when activeSidePanel is "explorer"', () => {
      component.explorerSupported = true;
      component.activeSidePanel = 'explorer';
      fixture.detectChanges();

      expect(byTestId('toolbar-explorer').classList).toContain('rail-button--active');
      expect(byTestId('documents-panel-toggle').classList).not.toContain('rail-button--active');
    });

    it('applies the active modifier to the Documents button when activeSidePanel is "documents"', () => {
      component.explorerSupported = true;
      component.activeSidePanel = 'documents';
      fixture.detectChanges();

      expect(byTestId('documents-panel-toggle').classList).toContain('rail-button--active');
      expect(byTestId('toolbar-explorer').classList).not.toContain('rail-button--active');
    });

    it('applies the active modifier to neither button when activeSidePanel is null', () => {
      component.explorerSupported = true;
      component.activeSidePanel = null;
      fixture.detectChanges();

      expect(byTestId('toolbar-explorer').classList).not.toContain('rail-button--active');
      expect(byTestId('documents-panel-toggle').classList).not.toContain('rail-button--active');
    });
  });
});
