import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';

import { DocumentsService } from '../../../core/services/documents.service';
import { FoldersService } from '../../../core/services/folders.service';
import { QuickOpenComponent } from '../quick-open/quick-open.component';
import { TitleBarComponent } from './title-bar.component';

describe('TitleBarComponent', () => {
  let fixture: ComponentFixture<TitleBarComponent>;
  let component: TitleBarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TitleBarComponent],
      // The Quick Open command center is a real child; its injected list
      // services must be faked or the whole suite fails on DI.
      providers: [
        { provide: DocumentsService, useValue: { list: jest.fn().mockReturnValue(of([])) } },
        { provide: FoldersService, useValue: { list: jest.fn().mockReturnValue(of([])) } },
      ],
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

  it('renders no app menus or logo -- they live behind the rail hamburger, vscode.dev-style', () => {
    expect(fixture.nativeElement.querySelector('.title-bar__menu')).toBeNull();
    expect(fixture.nativeElement.querySelector('.title-bar__menus')).toBeNull();
    expect(fixture.nativeElement.querySelector('.title-bar__logo')).toBeNull();
    expect(byTestId('title-bar-menu-file')).toBeNull();
  });

  describe('copy document contents', () => {
    it('emits copyContents on click', () => {
      const spy = jest.fn();
      component.copyContents.subscribe(spy);

      (byTestId('title-bar-copy-contents') as HTMLButtonElement).click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('swaps the copy glyph for a checkmark while copied is set', () => {
      const button = byTestId('title-bar-copy-contents');
      // The copy glyph is the two overlapping rectangles (a <rect> plus a <path>).
      expect(button.querySelector('rect')).toBeTruthy();

      component.copied = true;
      fixture.detectChanges();

      // The checkmark is a lone <path> -- no <rect> remains.
      expect(button.querySelector('rect')).toBeNull();
      expect(button.querySelector('path')).toBeTruthy();
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
      '.title-bar__layout-toggle, .title-bar__window-control, .title-bar__command-center, .title-bar__copy-button',
    );
    for (const button of Array.from(iconButtons)) {
      expect((button as HTMLElement).getAttribute('aria-label')).toBeTruthy();
    }
  });

  describe('Quick Open passthrough (the page owns every decision)', () => {
    function quickOpen(): QuickOpenComponent {
      return fixture.debugElement.query(By.directive(QuickOpenComponent)).componentInstance as QuickOpenComponent;
    }

    it('forwards its inputs to the command center', () => {
      component.quickOpenOpen = true;
      component.quickOpenCommands = [{ id: 'save', label: 'Save' }];
      fixture.detectChanges();

      expect(quickOpen().documentName).toBe('Untitled diagram');
      expect(quickOpen().open).toBe(true);
      expect(quickOpen().commands).toEqual([{ id: 'save', label: 'Save' }]);
    });

    it('re-emits each Quick Open output unchanged', () => {
      const requested = jest.fn();
      const dismissed = jest.fn();
      const documentSelected = jest.fn();
      const commandSelected = jest.fn();
      component.quickOpenRequested.subscribe(requested);
      component.quickOpenDismissed.subscribe(dismissed);
      component.quickOpenDocumentSelected.subscribe(documentSelected);
      component.quickOpenCommandSelected.subscribe(commandSelected);

      const child = quickOpen();
      child.openRequested.emit();
      child.dismissed.emit({ restoreFocus: true });
      const summary = {
        id: '1',
        name: 'Doc',
        updatedAt: '2026-07-01T00:00:00Z',
        folderId: null,
        kind: 'plantuml' as const,
        excludedFromExport: false,
      };
      child.documentSelected.emit(summary);
      child.commandSelected.emit('save');

      expect(requested).toHaveBeenCalledTimes(1);
      expect(dismissed).toHaveBeenCalledWith({ restoreFocus: true });
      expect(documentSelected).toHaveBeenCalledWith(summary);
      expect(commandSelected).toHaveBeenCalledWith('save');
    });
  });
});
