import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { TemplateSummary } from '../../../core/models/template-summary.model';
import { TemplatesService } from '../../../core/services/templates.service';
import { TemplatesPanelComponent } from './templates-panel.component';

describe('TemplatesPanelComponent', () => {
  let fixture: ComponentFixture<TemplatesPanelComponent>;
  let component: TemplatesPanelComponent;
  let templatesServiceMock: {
    list: jest.Mock;
    getById: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    rename: jest.Mock;
    delete: jest.Mock;
  };

  const summaries: TemplateSummary[] = [
    { id: 't-seq', name: 'Sequence Diagram', kind: 'plantuml', updatedAt: '2026-07-03T00:00:00Z' },
    { id: 't-blank', name: 'Blank', kind: 'plantuml', updatedAt: '2026-07-03T00:00:00Z' },
    { id: 't-notes', name: 'Meeting Notes', kind: 'markdown', updatedAt: '2026-07-03T00:00:00Z' },
  ];

  beforeEach(async () => {
    templatesServiceMock = {
      list: jest.fn().mockReturnValue(of(summaries)),
      getById: jest.fn(),
      create: jest.fn().mockReturnValue(of({})),
      update: jest.fn().mockReturnValue(of({})),
      rename: jest.fn().mockReturnValue(of({})),
      delete: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [TemplatesPanelComponent],
      providers: [{ provide: TemplatesService, useValue: templatesServiceMock }],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplatesPanelComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function openPanel(): void {
    component.open = true;
    component.ngOnChanges({ open: { currentValue: true } as never });
    fixture.detectChanges();
  }

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  function rowNames(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[data-testid="template-item"]')).map(
      (row) => (row as HTMLElement).getAttribute('data-template-name')!,
    );
  }

  it('renders nothing when closed and never fetches', () => {
    component.open = false;
    fixture.detectChanges();

    expect(byTestId('templates-panel')).toBeNull();
    expect(templatesServiceMock.list).not.toHaveBeenCalled();
  });

  it('fetches and renders the templates name-sorted when opened', () => {
    openPanel();

    expect(templatesServiceMock.list).toHaveBeenCalledTimes(1);
    expect(byTestId('templates-panel')).toBeTruthy();
    expect(rowNames()).toEqual(['Blank', 'Meeting Notes', 'Sequence Diagram']);
  });

  it('shows the empty message when there are no templates', () => {
    templatesServiceMock.list.mockReturnValue(of([]));
    openPanel();

    // The list container always renders (it hosts the background context
    // menu); only the rows disappear.
    expect(byTestId('templates-list')!.textContent).toContain('No templates yet.');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="template-item"]').length).toBe(0);
  });

  it('shows the MD badge only on markdown templates', () => {
    openPanel();

    const badges = fixture.nativeElement.querySelectorAll('[data-testid="template-kind-badge"]');
    expect(badges.length).toBe(1);
    expect(badges[0].closest('[data-testid="template-item"]')!.getAttribute('data-template-name')).toBe(
      'Meeting Notes',
    );
  });

  it('emits templateApplied from a row click, and rows carry no inline action icons', () => {
    openPanel();
    const spy = jest.fn();
    component.templateApplied.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-template-name="Blank"]') as HTMLElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(summaries[1]);

    // Row actions live in the context menu now -- no per-row icon buttons.
    expect(byTestId('template-item-apply')).toBeNull();
    expect(byTestId('template-item-update')).toBeNull();
    expect(byTestId('template-item-rename')).toBeNull();
    expect(byTestId('template-item-delete')).toBeNull();
  });

  it('creates a template from the editor content and kind under the prompted name', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('  My Starter  ');
    component.editorContent = '# from the editor';
    component.editorKind = 'markdown';
    openPanel();

    (byTestId('templates-new-template') as HTMLButtonElement).click();

    expect(templatesServiceMock.create).toHaveBeenCalledWith({
      name: 'My Starter',
      content: '# from the editor',
      kind: 'markdown',
    });
    expect(templatesServiceMock.list).toHaveBeenCalledTimes(2);
  });

  it('does not create when the prompt is cancelled', () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    openPanel();

    (byTestId('templates-new-template') as HTMLButtonElement).click();

    expect(templatesServiceMock.create).not.toHaveBeenCalled();
  });

  describe('context menu', () => {
    function row(name: string): HTMLElement {
      return fixture.nativeElement.querySelector(`[data-template-name="${name}"]`) as HTMLElement;
    }

    function openContextMenu(target: HTMLElement): void {
      target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 }));
      fixture.detectChanges();
    }

    function menuLabels(): (string | undefined)[] {
      return Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="tree-context-menu-item"]') as NodeListOf<HTMLElement>,
      ).map((item) => item.textContent?.trim());
    }

    function runContextCommand(target: HTMLElement, command: string): void {
      openContextMenu(target);
      const item = fixture.nativeElement.querySelector(`[data-command="${command}"]`) as HTMLButtonElement | null;
      expect(item).toBeTruthy();
      item!.click();
      fixture.detectChanges();
    }

    it('right-clicking a row offers the row commands and marks the row as the context target', () => {
      openPanel();

      openContextMenu(row('Blank'));

      expect(menuLabels()).toEqual(['Apply to Editor', 'Update from Editor', 'Rename', 'Delete']);
      expect(row('Blank').classList).toContain('templates-panel__row--context-target');
    });

    it('applies the row template via the menu and closes it', () => {
      openPanel();
      const spy = jest.fn();
      component.templateApplied.subscribe(spy);

      runContextCommand(row('Blank'), 'apply');

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(summaries[1]);
      expect(byTestId('tree-context-menu')).toBeNull();
    });

    it('updates from the editor via the menu after a confirm, without applying it', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      component.editorContent = '@startuml\nvia menu\n@enduml';
      component.editorKind = 'plantuml';
      openPanel();
      const appliedSpy = jest.fn();
      component.templateApplied.subscribe(appliedSpy);

      runContextCommand(row('Blank'), 'update');

      expect(window.confirm).toHaveBeenCalledWith('Overwrite "Blank" with the current editor content?');
      expect(templatesServiceMock.update).toHaveBeenCalledWith('t-blank', {
        name: 'Blank',
        content: '@startuml\nvia menu\n@enduml',
        kind: 'plantuml',
      });
      expect(appliedSpy).not.toHaveBeenCalled();
    });

    it('does not update when the confirm is declined', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(false);
      openPanel();

      runContextCommand(row('Blank'), 'update');

      expect(templatesServiceMock.update).not.toHaveBeenCalled();
    });

    it('renames via the menu with the seeded prompt', () => {
      jest.spyOn(window, 'prompt').mockReturnValue('Renamed');
      openPanel();

      runContextCommand(row('Sequence Diagram'), 'rename');

      expect(window.prompt).toHaveBeenCalledWith('Rename template', 'Sequence Diagram');
      expect(templatesServiceMock.rename).toHaveBeenCalledWith('t-seq', 'Renamed');
    });

    it('does not rename on a cancelled or unchanged prompt', () => {
      const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
      openPanel();

      runContextCommand(row('Blank'), 'rename');
      expect(templatesServiceMock.rename).not.toHaveBeenCalled();

      promptSpy.mockReturnValue('Blank');
      runContextCommand(row('Blank'), 'rename');
      expect(templatesServiceMock.rename).not.toHaveBeenCalled();
    });

    it('deletes via the menu after a confirm and refreshes', () => {
      jest.spyOn(window, 'confirm').mockReturnValue(true);
      openPanel();

      runContextCommand(row('Meeting Notes'), 'delete');

      expect(window.confirm).toHaveBeenCalledWith('Delete "Meeting Notes"? This cannot be undone.');
      expect(templatesServiceMock.delete).toHaveBeenCalledWith('t-notes');
      expect(templatesServiceMock.list).toHaveBeenCalledTimes(2);
    });

    it('right-clicking the list background offers only New Template from Editor and creates via the prompt', () => {
      jest.spyOn(window, 'prompt').mockReturnValue('From Background');
      component.editorContent = '# body';
      component.editorKind = 'markdown';
      openPanel();

      openContextMenu(byTestId('templates-list')!);
      expect(menuLabels()).toEqual(['New Template from Editor']);

      (fixture.nativeElement.querySelector('[data-command="new-template"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(templatesServiceMock.create).toHaveBeenCalledWith({
        name: 'From Background',
        content: '# body',
        kind: 'markdown',
      });
    });

    it('still offers New Template via the background menu when there are no templates', () => {
      templatesServiceMock.list.mockReturnValue(of([]));
      jest.spyOn(window, 'prompt').mockReturnValue('First Template');
      openPanel();

      runContextCommand(byTestId('templates-list')!, 'new-template');

      expect(templatesServiceMock.create).toHaveBeenCalledWith({
        name: 'First Template',
        content: '',
        kind: 'plantuml',
      });
    });

    it('opens a row menu from the keyboard (Shift+F10 on a focused row)', () => {
      openPanel();

      row('Blank').dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();

      expect(menuLabels()).toEqual(['Apply to Editor', 'Update from Editor', 'Rename', 'Delete']);
      expect(row('Blank').classList).toContain('templates-panel__row--context-target');
    });

    it('applies a focused row with Enter', () => {
      openPanel();
      const spy = jest.fn();
      component.templateApplied.subscribe(spy);

      row('Blank').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(summaries[1]);
    });

    it('opens the background menu from the keyboard (Shift+F10)', () => {
      openPanel();

      byTestId('templates-list')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }),
      );
      fixture.detectChanges();

      expect(byTestId('tree-context-menu')).toBeTruthy();
      expect(menuLabels()).toEqual(['New Template from Editor']);
    });

    it('closes the menu when the panel scrolls', () => {
      openPanel();
      openContextMenu(row('Blank'));
      expect(byTestId('tree-context-menu')).toBeTruthy();

      byTestId('templates-panel')!.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      expect(byTestId('tree-context-menu')).toBeNull();
    });

    it('drops a pending menu when the panel closes', () => {
      openPanel();
      openContextMenu(row('Blank'));

      component.open = false;
      component.ngOnChanges({ open: { currentValue: false } as never });
      fixture.detectChanges();
      openPanel();

      expect(byTestId('tree-context-menu')).toBeNull();
    });

    // Regression pin for the change-detection loop: the menu's [items]
    // binding must see a stable array reference across reads while a
    // request is open (a fresh-array-per-read getter wedged the tab).
    it('returns the same items array across reads while a menu is open', () => {
      openPanel();
      openContextMenu(row('Blank'));

      expect(component.contextMenuItems()).toBe(component.contextMenuItems());
    });
  });
});
