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

    expect(byTestId('templates-panel')!.textContent).toContain('No templates yet.');
    expect(byTestId('templates-list')).toBeNull();
  });

  it('shows the MD badge only on markdown templates', () => {
    openPanel();

    const badges = fixture.nativeElement.querySelectorAll('[data-testid="template-kind-badge"]');
    expect(badges.length).toBe(1);
    expect(badges[0].closest('[data-testid="template-item"]')!.getAttribute('data-template-name')).toBe(
      'Meeting Notes',
    );
  });

  it('emits templateApplied from a row click and from the Apply action, exactly once each', () => {
    openPanel();
    const spy = jest.fn();
    component.templateApplied.subscribe(spy);

    (fixture.nativeElement.querySelector('[data-template-name="Blank"]') as HTMLElement).click();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(summaries[1]);

    (byTestId('template-item-apply') as HTMLButtonElement).click();
    expect(spy).toHaveBeenCalledTimes(2);
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

  it('updates a template from the editor after a confirm, without applying it', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    component.editorContent = '@startuml\nnew\n@enduml';
    component.editorKind = 'plantuml';
    openPanel();
    const appliedSpy = jest.fn();
    component.templateApplied.subscribe(appliedSpy);

    (fixture.nativeElement.querySelector(
      '[data-template-name="Blank"] [data-testid="template-item-update"]',
    ) as HTMLButtonElement).click();

    expect(window.confirm).toHaveBeenCalledWith('Overwrite "Blank" with the current editor content?');
    expect(templatesServiceMock.update).toHaveBeenCalledWith('t-blank', {
      name: 'Blank',
      content: '@startuml\nnew\n@enduml',
      kind: 'plantuml',
    });
    expect(appliedSpy).not.toHaveBeenCalled();
  });

  it('does not update when the confirm is declined', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    openPanel();

    (byTestId('template-item-update') as HTMLButtonElement).click();

    expect(templatesServiceMock.update).not.toHaveBeenCalled();
  });

  it('renames via a seeded prompt and refreshes', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Renamed');
    openPanel();

    (fixture.nativeElement.querySelector(
      '[data-template-name="Sequence Diagram"] [data-testid="template-item-rename"]',
    ) as HTMLButtonElement).click();

    expect(window.prompt).toHaveBeenCalledWith('Rename template', 'Sequence Diagram');
    expect(templatesServiceMock.rename).toHaveBeenCalledWith('t-seq', 'Renamed');
  });

  it('does not rename on a cancelled or unchanged prompt', () => {
    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue(null);
    openPanel();

    (byTestId('template-item-rename') as HTMLButtonElement).click();
    expect(templatesServiceMock.rename).not.toHaveBeenCalled();

    promptSpy.mockReturnValue('Blank');
    (byTestId('template-item-rename') as HTMLButtonElement).click();
    expect(templatesServiceMock.rename).not.toHaveBeenCalled();
  });

  it('deletes after a confirm and refreshes', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    openPanel();

    (fixture.nativeElement.querySelector(
      '[data-template-name="Meeting Notes"] [data-testid="template-item-delete"]',
    ) as HTMLButtonElement).click();

    expect(window.confirm).toHaveBeenCalledWith('Delete "Meeting Notes"? This cannot be undone.');
    expect(templatesServiceMock.delete).toHaveBeenCalledWith('t-notes');
    expect(templatesServiceMock.list).toHaveBeenCalledTimes(2);
  });

  it('row action clicks never also apply the template (stopPropagation)', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    openPanel();
    const spy = jest.fn();
    component.templateApplied.subscribe(spy);

    (byTestId('template-item-update') as HTMLButtonElement).click();
    (byTestId('template-item-rename') as HTMLButtonElement).click();
    (byTestId('template-item-delete') as HTMLButtonElement).click();

    expect(spy).not.toHaveBeenCalled();
  });
});
