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

  it('renders the panel toggles and connection status -- the New/Save/Upload actions live in the File menu (D-012)', () => {
    expect(byTestId('editor-toolbar')).toBeTruthy();
    expect(byTestId('templates-panel-toggle')).toBeTruthy();
    expect(byTestId('documents-panel-toggle')).toBeTruthy();
    expect(byTestId('connection-status')).toBeTruthy();
    expect(byTestId('toolbar-new')).toBeNull();
    expect(byTestId('toolbar-save')).toBeNull();
    expect(byTestId('toolbar-upload')).toBeNull();
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
