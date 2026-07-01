import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { Document } from '../../../core/models/document.model';
import { Template } from '../../../core/models/template.model';
import { DiagramHubService } from '../../../core/services/diagram-hub.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { MonacoLoaderService } from '../../../core/services/monaco-loader.service';
import { TemplatesService } from '../../../core/services/templates.service';
import { EditorPageComponent } from './editor-page.component';

describe('EditorPageComponent', () => {
  let fixture: ComponentFixture<EditorPageComponent>;
  let component: EditorPageComponent;
  let routeDataSubject: BehaviorSubject<Record<string, unknown>>;
  let documentsServiceMock: {
    create: jest.Mock;
    update: jest.Mock;
    upload: jest.Mock;
    list: jest.Mock;
    delete: jest.Mock;
    getById: jest.Mock;
  };
  let locationMock: { go: jest.Mock };
  let hubServiceMock: {
    connectionState: ReturnType<typeof signal<'connected' | 'disconnected' | 'reconnecting'>>;
    renderResult: ReturnType<typeof signal<null>>;
    renderError: ReturnType<typeof signal<null>>;
    isRendering: ReturnType<typeof signal<boolean>>;
    render: jest.Mock;
  };

  beforeEach(async () => {
    routeDataSubject = new BehaviorSubject<Record<string, unknown>>({});
    documentsServiceMock = {
      create: jest.fn(),
      update: jest.fn(),
      upload: jest.fn(),
      list: jest.fn().mockReturnValue(of([])),
      delete: jest.fn(),
      getById: jest.fn(),
    };
    locationMock = { go: jest.fn() };
    hubServiceMock = {
      connectionState: signal('connected'),
      renderResult: signal(null),
      renderError: signal(null),
      isRendering: signal(false),
      render: jest.fn().mockResolvedValue(undefined),
    };

    const editorStub = {
      getValue: jest.fn(() => ''),
      setValue: jest.fn(),
      onDidChangeModelContent: jest.fn(),
      addCommand: jest.fn(),
      dispose: jest.fn(),
    };
    const fakeMonaco = {
      editor: { create: jest.fn(() => editorStub) },
      KeyMod: { CtrlCmd: 2048 },
      KeyCode: { Enter: 3 },
    };

    await TestBed.configureTestingModule({
      imports: [EditorPageComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { data: routeDataSubject.asObservable() } },
        { provide: Location, useValue: locationMock },
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: DiagramHubService, useValue: hubServiceMock },
        { provide: TemplatesService, useValue: { list: jest.fn().mockReturnValue(of([])) } },
        { provide: MonacoLoaderService, useValue: { load: jest.fn().mockResolvedValue(fakeMonaco) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EditorPageComponent);
    component = fixture.componentInstance;
  });

  function byTestId(testId: string): HTMLElement | null {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  it('renders the editor-page root and its composed children', () => {
    fixture.detectChanges();

    expect(byTestId('editor-page')).toBeTruthy();
    expect(byTestId('editor-toolbar')).toBeTruthy();
    expect(byTestId('monaco-editor')).toBeTruthy();
    expect(byTestId('preview-pane')).toBeTruthy();
  });

  it('starts blank when the resolver provides no document', () => {
    fixture.detectChanges();

    expect(component.documentId()).toBeNull();
    expect(component.sourceCode()).toBe('');
    expect(component.documentName()).toBe('Untitled diagram');
  });

  it('applies the resolved document from route data', () => {
    const document: Document = {
      id: '1',
      name: 'Loaded Doc',
      content: '@startuml\nfoo\n@enduml',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
    routeDataSubject.next({ document });
    fixture.detectChanges();

    expect(component.documentId()).toBe('1');
    expect(component.documentName()).toBe('Loaded Doc');
    expect(component.sourceCode()).toBe('@startuml\nfoo\n@enduml');
  });

  it('re-applies a newly resolved document when route data changes on a reused instance', () => {
    fixture.detectChanges();

    const document: Document = {
      id: '2',
      name: 'Second Doc',
      content: 'second content',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
    routeDataSubject.next({ document });

    expect(component.documentId()).toBe('2');
    expect(component.sourceCode()).toBe('second content');
  });

  it('invokes hubService.render when the editor requests a render', () => {
    fixture.detectChanges();

    component.onRenderRequested('@startuml\n@enduml');

    expect(hubServiceMock.render).toHaveBeenCalledWith('@startuml\n@enduml');
  });

  it('creates a new document on save confirm when there is no existing id', () => {
    fixture.detectChanges();
    documentsServiceMock.create.mockReturnValue(
      of({ id: 'new-id', name: 'New Doc', content: 'x', createdAt: '2026-01-01T00:00:00Z', updatedAt: null }),
    );

    component.sourceCode.set('x');
    component.onSaveConfirm('New Doc');

    expect(documentsServiceMock.create).toHaveBeenCalledWith({ name: 'New Doc', content: 'x' });
    expect(locationMock.go).toHaveBeenCalledWith('/editor/new-id');
    expect(component.documentId()).toBe('new-id');
  });

  it('updates the existing document on save confirm when an id is already present', () => {
    const document: Document = {
      id: '1',
      name: 'Doc',
      content: 'old',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
    routeDataSubject.next({ document });
    fixture.detectChanges();

    documentsServiceMock.update.mockReturnValue(
      of({
        id: '1',
        name: 'Renamed',
        content: 'old',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      }),
    );

    component.onSaveConfirm('Renamed');

    expect(documentsServiceMock.update).toHaveBeenCalledWith('1', { name: 'Renamed', content: 'old' });
    expect(locationMock.go).not.toHaveBeenCalled();
  });

  it('uploads the selected file, applies its text immediately, and navigates to the created document', async () => {
    fixture.detectChanges();

    const file = new File(['@startuml\nuploaded\n@enduml'], 'diagram.puml');
    documentsServiceMock.upload.mockReturnValue(
      of({
        id: 'uploaded-id',
        name: 'diagram',
        content: '@startuml\nuploaded\n@enduml',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      }),
    );

    component.onFileSelected(file);
    await Promise.resolve();
    await Promise.resolve();

    expect(component.sourceCode()).toBe('@startuml\nuploaded\n@enduml');
    expect(documentsServiceMock.upload).toHaveBeenCalledWith(file, undefined);
    expect(locationMock.go).toHaveBeenCalledWith('/editor/uploaded-id');
  });

  it('guards template selection behind a confirm dialog when there are unsaved changes', () => {
    fixture.detectChanges();
    component.sourceCode.set('unsaved content');

    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    const template: Template = { key: 'c4-context', name: 'C4', category: 'C4', content: 'template content' };
    component.onTemplateSelected(template);

    expect(confirmSpy).toHaveBeenCalled();
    expect(component.sourceCode()).toBe('unsaved content');

    confirmSpy.mockRestore();
  });

  it('applies the template content directly when there are no unsaved changes', () => {
    fixture.detectChanges();

    const template: Template = { key: 'c4-context', name: 'C4', category: 'C4', content: 'template content' };
    component.onTemplateSelected(template);

    expect(component.sourceCode()).toBe('template content');
  });

  it('toggles the documents panel open state', () => {
    fixture.detectChanges();

    expect(component.isDocumentsPanelOpen()).toBe(false);
    component.onDocumentsPanelToggle();
    expect(component.isDocumentsPanelOpen()).toBe(true);
  });
});
