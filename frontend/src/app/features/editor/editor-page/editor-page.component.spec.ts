import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { BehaviorSubject, of } from 'rxjs';

import { Document } from '../../../core/models/document.model';
import { OpenedDiskFile } from '../../../core/models/opened-disk-file.model';
import { Template } from '../../../core/models/template.model';
import { DiagramHubService } from '../../../core/services/diagram-hub.service';
import { DocumentsService } from '../../../core/services/documents.service';
import { EditorLayoutPreferencesService } from '../../../core/services/editor-layout-preferences.service';
import { FileSystemAccessService } from '../../../core/services/file-system-access.service';
import { MonacoLoaderService } from '../../../core/services/monaco-loader.service';
import { TemplatesService } from '../../../core/services/templates.service';
import { MAX_EDITOR_PANE_RATIO, MIN_EDITOR_PANE_RATIO } from '../editor-pane-ratio.constants';
import { MAX_SIDE_PANEL_WIDTH_PX, MIN_SIDE_PANEL_WIDTH_PX } from '../side-panel-width.constants';
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
  let layoutPreferencesMock: {
    getEditorPaneRatio: jest.Mock;
    setEditorPaneRatio: jest.Mock;
    getSidePanelWidthPx: jest.Mock;
    setSidePanelWidthPx: jest.Mock;
  };
  let fileSystemAccessServiceMock: {
    isSupported: jest.Mock;
    pickDirectory: jest.Mock;
    listChildren: jest.Mock;
    readTextFile: jest.Mock;
    writeTextFile: jest.Mock;
    queryPermission: jest.Mock;
    requestPermission: jest.Mock;
    saveRootHandle: jest.Mock;
    loadRootHandle: jest.Mock;
    clearRootHandle: jest.Mock;
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
    layoutPreferencesMock = {
      getEditorPaneRatio: jest.fn().mockReturnValue(0.4),
      setEditorPaneRatio: jest.fn(),
      getSidePanelWidthPx: jest.fn().mockReturnValue(300),
      setSidePanelWidthPx: jest.fn(),
    };
    fileSystemAccessServiceMock = {
      // ExplorerPanelComponent is always mounted inside EditorPageComponent's
      // own template now (see Feature 6), so this mock must satisfy its
      // ngOnInit too, not just the disk-save methods EditorPageComponent
      // itself calls directly -- loadRootHandle resolving null keeps it
      // parked on its default "Open Folder" button state, a no-op as far as
      // these EditorPageComponent-focused tests are concerned.
      isSupported: jest.fn().mockReturnValue(true),
      pickDirectory: jest.fn(),
      listChildren: jest.fn().mockResolvedValue([]),
      readTextFile: jest.fn(),
      writeTextFile: jest.fn().mockResolvedValue(undefined),
      queryPermission: jest.fn(),
      requestPermission: jest.fn(),
      saveRootHandle: jest.fn().mockResolvedValue(undefined),
      loadRootHandle: jest.fn().mockResolvedValue(null),
      clearRootHandle: jest.fn().mockResolvedValue(undefined),
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
        { provide: EditorLayoutPreferencesService, useValue: layoutPreferencesMock },
        { provide: FileSystemAccessService, useValue: fileSystemAccessServiceMock },
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

  it('toggles the documents panel open state via the shared activeSidePanel signal', () => {
    fixture.detectChanges();

    expect(component.activeSidePanel()).toBeNull();
    component.onDocumentsPanelToggle();
    expect(component.activeSidePanel()).toBe('documents');
    component.onDocumentsPanelToggle();
    expect(component.activeSidePanel()).toBeNull();
  });

  it('seeds the initial editor pane ratio from the layout preferences service, clamped to bounds', () => {
    fixture.detectChanges();

    expect(layoutPreferencesMock.getEditorPaneRatio).toHaveBeenCalled();
    expect(component.editorPaneRatio()).toBe(0.4);
    expect(component.editorPaneRatioPercent()).toBe(40);
  });

  it('clamps an out-of-bounds persisted ratio into [MIN_EDITOR_PANE_RATIO, MAX_EDITOR_PANE_RATIO] at seed time', async () => {
    layoutPreferencesMock.getEditorPaneRatio.mockReturnValue(0.95);

    await TestBed.resetTestingModule()
      .configureTestingModule({
        imports: [EditorPageComponent],
        providers: [
          { provide: ActivatedRoute, useValue: { data: routeDataSubject.asObservable() } },
          { provide: Location, useValue: locationMock },
          { provide: DocumentsService, useValue: documentsServiceMock },
          { provide: DiagramHubService, useValue: hubServiceMock },
          { provide: EditorLayoutPreferencesService, useValue: layoutPreferencesMock },
          { provide: FileSystemAccessService, useValue: fileSystemAccessServiceMock },
          { provide: TemplatesService, useValue: { list: jest.fn().mockReturnValue(of([])) } },
        ],
      })
      .compileComponents();
    const clampedFixture = TestBed.createComponent(EditorPageComponent);

    expect(clampedFixture.componentInstance.editorPaneRatio()).toBe(MAX_EDITOR_PANE_RATIO);
  });

  it('updates the live ratio/percent used for the editor pane width binding on (ratioChange), without persisting', () => {
    fixture.detectChanges();

    component.onDividerRatioChange(0.65);

    expect(component.editorPaneRatio()).toBe(0.65);
    expect(component.editorPaneRatioPercent()).toBe(65);
    fixture.detectChanges();
    const editorPane = fixture.nativeElement.querySelector('.editor-page__editor-pane') as HTMLElement;
    expect(editorPane.style.flexBasis).toBe('65%');
    expect(layoutPreferencesMock.setEditorPaneRatio).not.toHaveBeenCalled();
  });

  it('persists the ratio via the layout preferences service on (resizeEnd) only', () => {
    fixture.detectChanges();

    component.onDividerRatioChange(0.3);
    expect(layoutPreferencesMock.setEditorPaneRatio).not.toHaveBeenCalled();

    component.onDividerResizeEnd(0.3);

    expect(layoutPreferencesMock.setEditorPaneRatio).toHaveBeenCalledTimes(1);
    expect(layoutPreferencesMock.setEditorPaneRatio).toHaveBeenCalledWith(0.3);
    expect(component.editorPaneRatio()).toBe(0.3);
  });

  it('exposes MIN_EDITOR_PANE_RATIO/MAX_EDITOR_PANE_RATIO for the template to bind to the divider', () => {
    expect(component.MIN_EDITOR_PANE_RATIO).toBe(MIN_EDITOR_PANE_RATIO);
    expect(component.MAX_EDITOR_PANE_RATIO).toBe(MAX_EDITOR_PANE_RATIO);
  });

  describe('Ctrl/Cmd+S quick-save', () => {
    function ctrlSEvent(): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
      jest.spyOn(event, 'preventDefault');
      return event;
    }

    it('quick-saves the existing document (no dialog) when there are unsaved changes and a documentId', () => {
      const document: Document = {
        id: '1',
        name: 'Doc',
        content: 'old',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };
      routeDataSubject.next({ document });
      fixture.detectChanges();
      component.sourceCode.set('new content');
      documentsServiceMock.update.mockReturnValue(
        of({
          id: '1',
          name: 'Doc',
          content: 'new content',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        }),
      );

      const event = ctrlSEvent();
      component.onKeyDown(event);

      expect(documentsServiceMock.update).toHaveBeenCalledWith('1', { name: 'Doc', content: 'new content' });
      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(component.isSaveDialogOpen()).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('opens the save dialog (without saving) when there are unsaved changes but no documentId yet', () => {
      fixture.detectChanges();
      component.sourceCode.set('brand new content');

      const event = ctrlSEvent();
      component.onKeyDown(event);

      expect(component.isSaveDialogOpen()).toBe(true);
      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(documentsServiceMock.update).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does nothing when there are no unsaved changes', () => {
      fixture.detectChanges();

      const event = ctrlSEvent();
      component.onKeyDown(event);

      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(documentsServiceMock.update).not.toHaveBeenCalled();
      expect(component.isSaveDialogOpen()).toBe(false);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('is a no-op when the save dialog is already open, regardless of documentId/hasUnsavedChanges', () => {
      const document: Document = {
        id: '1',
        name: 'Doc',
        content: 'old',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };
      routeDataSubject.next({ document });
      fixture.detectChanges();
      component.sourceCode.set('new content');
      component.isSaveDialogOpen.set(true);

      const event = ctrlSEvent();
      component.onKeyDown(event);

      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(documentsServiceMock.update).not.toHaveBeenCalled();
      expect(component.isSaveDialogOpen()).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('ignores a non-save key combination and does not call preventDefault', () => {
      fixture.detectChanges();
      component.sourceCode.set('unsaved content');

      const plainA = new KeyboardEvent('keydown', { key: 'a', cancelable: true });
      jest.spyOn(plainA, 'preventDefault');
      component.onKeyDown(plainA);

      const ctrlB = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true });
      jest.spyOn(ctrlB, 'preventDefault');
      component.onKeyDown(ctrlB);

      expect(plainA.preventDefault).not.toHaveBeenCalled();
      expect(ctrlB.preventDefault).not.toHaveBeenCalled();
      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(documentsServiceMock.update).not.toHaveBeenCalled();
      expect(component.isSaveDialogOpen()).toBe(false);
    });

    it('also triggers via metaKey (Cmd+S) and via an uppercase "S"', () => {
      fixture.detectChanges();
      component.sourceCode.set('brand new content');

      const event = new KeyboardEvent('keydown', { key: 'S', metaKey: true, cancelable: true });
      jest.spyOn(event, 'preventDefault');
      component.onKeyDown(event);

      expect(component.isSaveDialogOpen()).toBe(true);
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });

  describe('disk-backed files (Explorer) vs. SQLite documents', () => {
    /**
     * A real FileSystemFileHandle's isSameEntry() compares by underlying
     * disk identity, not by object reference (two separate directory reads
     * of the very same file hand back two distinct, `!==` handle objects
     * that still resolve isSameEntry() true against each other) -- mocked
     * here by name so a differently-referenced-but-same-name fake behaves
     * the same way a real refreshed handle would.
     */
    function fakeFileHandle(name: string): FileSystemFileHandle {
      return {
        name,
        isSameEntry: (other: FileSystemHandle) => Promise.resolve((other as { name?: string })?.name === name),
      } as unknown as FileSystemFileHandle;
    }

    function diskFile(overrides: Partial<OpenedDiskFile> = {}): OpenedDiskFile {
      return {
        handle: fakeFileHandle('diagram.puml'),
        name: 'diagram.puml',
        content: '@startuml\nfrom disk\n@enduml',
        ...overrides,
      };
    }

    it('opening a disk file sets openFileHandle, clears documentId, updates content, and resets the URL', () => {
      const document: Document = {
        id: '1',
        name: 'Doc',
        content: 'old',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };
      routeDataSubject.next({ document });
      fixture.detectChanges();

      const file = diskFile();
      component.onDiskFileOpened(file);

      expect(component.documentId()).toBeNull();
      expect(component.documentName()).toBe('diagram.puml');
      expect(component.sourceCode()).toBe(file.content);
      expect(component.savedSourceCode()).toBe(file.content);
      expect(component.openFileHandle()).toBe(file.handle);
      expect(locationMock.go).toHaveBeenCalledWith('/editor');
      expect(hubServiceMock.render).toHaveBeenCalledWith(file.content);
    });

    it('the confirm-guard interrupts opening a disk file when there are unsaved changes and the user declines', () => {
      fixture.detectChanges();
      component.sourceCode.set('unsaved content');

      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
      component.onDiskFileOpened(diskFile());

      expect(confirmSpy).toHaveBeenCalled();
      expect(component.sourceCode()).toBe('unsaved content');
      expect(component.openFileHandle()).toBeNull();

      confirmSpy.mockRestore();
    });

    it('opening a disk file proceeds without prompting when there are no unsaved changes', () => {
      fixture.detectChanges();
      const confirmSpy = jest.spyOn(window, 'confirm');

      component.onDiskFileOpened(diskFile());

      expect(confirmSpy).not.toHaveBeenCalled();
      expect(component.openFileHandle()).not.toBeNull();

      confirmSpy.mockRestore();
    });

    it('starting a New document clears a previously open disk file handle', () => {
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      expect(component.openFileHandle()).not.toBeNull();

      component.onNewDocument();

      expect(component.openFileHandle()).toBeNull();
    });

    it('opening a SQLite document (route-resolved) clears a previously open disk file handle', () => {
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      expect(component.openFileHandle()).not.toBeNull();

      const document: Document = {
        id: '1',
        name: 'Doc',
        content: 'from db',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: null,
      };
      routeDataSubject.next({ document });

      expect(component.openFileHandle()).toBeNull();
    });

    it('onDiskFileDeleted resets to the blank document and navigates to /editor when the handle matches the currently open file', async () => {
      fixture.detectChanges();
      const file = diskFile();
      component.onDiskFileOpened(file);
      component.sourceCode.set('edited content');
      locationMock.go.mockClear();

      await component.onDiskFileDeleted(file.handle);

      expect(component.documentId()).toBeNull();
      expect(component.documentName()).toBe('Untitled diagram');
      expect(component.sourceCode()).toBe('');
      expect(component.savedSourceCode()).toBe('');
      expect(component.openFileHandle()).toBeNull();
      expect(locationMock.go).toHaveBeenCalledWith('/editor');
    });

    it('onDiskFileDeleted resets the editor even when the deleted handle is a different object instance representing the same file (isSameEntry, not ===)', async () => {
      fixture.detectChanges();
      const file = diskFile();
      component.onDiskFileOpened(file);
      component.sourceCode.set('edited content');
      locationMock.go.mockClear();

      // A distinct handle object -- e.g. what ExplorerPanelComponent hands
      // over after any refresh of the file's parent directory -- but
      // isSameEntry-equal to the one currently open.
      await component.onDiskFileDeleted(fakeFileHandle('diagram.puml'));

      expect(component.sourceCode()).toBe('');
      expect(component.openFileHandle()).toBeNull();
      expect(locationMock.go).toHaveBeenCalledWith('/editor');
    });

    it('onDiskFileDeleted is a complete no-op when the handle does not match the currently open file', async () => {
      fixture.detectChanges();
      const file = diskFile();
      component.onDiskFileOpened(file);
      component.sourceCode.set('edited content');
      locationMock.go.mockClear();

      const otherHandle = fakeFileHandle('other.puml');
      await component.onDiskFileDeleted(otherHandle);

      expect(component.documentName()).toBe(file.name);
      expect(component.sourceCode()).toBe('edited content');
      expect(component.openFileHandle()).toBe(file.handle);
      expect(locationMock.go).not.toHaveBeenCalled();
    });

    it('onDiskFileDeleted never calls window.confirm, unlike onDiskFileOpened', async () => {
      fixture.detectChanges();
      const file = diskFile();
      component.onDiskFileOpened(file);
      component.sourceCode.set('edited content');

      const confirmSpy = jest.spyOn(window, 'confirm');
      await component.onDiskFileDeleted(file.handle);

      expect(confirmSpy).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('selecting a template clears a previously open disk file handle', () => {
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      expect(component.openFileHandle()).not.toBeNull();

      const template: Template = { key: 'c4-context', name: 'C4', category: 'C4', content: 'template content' };
      component.onTemplateSelected(template);

      expect(component.openFileHandle()).toBeNull();
    });

    it('Save button performs a direct, silent disk write with no dialog when a disk file is open', async () => {
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      component.sourceCode.set('edited content');

      component.onSaveClicked();
      await Promise.resolve();
      await Promise.resolve();

      expect(fileSystemAccessServiceMock.writeTextFile).toHaveBeenCalledWith(
        component.openFileHandle(),
        'edited content',
      );
      expect(component.isSaveDialogOpen()).toBe(false);
      expect(component.savedSourceCode()).toBe('edited content');
    });

    it('Ctrl+S performs a direct, silent disk write with no dialog when a disk file is open', async () => {
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      component.sourceCode.set('edited via ctrl+s');

      const event = ctrlSEventFactory();
      component.onKeyDown(event);
      await Promise.resolve();
      await Promise.resolve();

      expect(fileSystemAccessServiceMock.writeTextFile).toHaveBeenCalledWith(
        component.openFileHandle(),
        'edited via ctrl+s',
      );
      expect(component.isSaveDialogOpen()).toBe(false);
      expect(documentsServiceMock.create).not.toHaveBeenCalled();
      expect(documentsServiceMock.update).not.toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('falls through to the existing SQLite create/update branching when openFileHandle is null', () => {
      fixture.detectChanges();
      component.sourceCode.set('brand new content');

      component.onSaveClicked();

      expect(fileSystemAccessServiceMock.writeTextFile).not.toHaveBeenCalled();
      expect(component.isSaveDialogOpen()).toBe(true);
    });

    it('surfaces a write failure via diskSaveError and does not update savedSourceCode', async () => {
      fileSystemAccessServiceMock.writeTextFile.mockRejectedValue(new Error('disk full'));
      fixture.detectChanges();
      component.onDiskFileOpened(diskFile());
      component.sourceCode.set('will fail to save');

      component.onSaveClicked();
      await Promise.resolve();
      await Promise.resolve();

      expect(component.diskSaveError()).toBe('disk full');
      expect(component.savedSourceCode()).not.toBe('will fail to save');
    });

    function ctrlSEventFactory(): KeyboardEvent {
      const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
      jest.spyOn(event, 'preventDefault');
      return event;
    }
  });

  describe('activeSidePanel exclusivity (Explorer vs. Documents)', () => {
    it('selecting Explorer while Documents is active swaps to Explorer', () => {
      fixture.detectChanges();

      component.toggleSidePanel('documents');
      expect(component.activeSidePanel()).toBe('documents');

      component.toggleSidePanel('explorer');
      expect(component.activeSidePanel()).toBe('explorer');
    });

    it('clicking the same panel toggle twice collapses back to null', () => {
      fixture.detectChanges();

      component.onExplorerPanelToggle();
      expect(component.activeSidePanel()).toBe('explorer');

      component.onExplorerPanelToggle();
      expect(component.activeSidePanel()).toBeNull();
    });

    it('exposes explorerSupported from FileSystemAccessService.isSupported()', () => {
      expect(component.explorerSupported).toBe(true);
    });
  });

  describe('side panel width (pixel divider)', () => {
    it('seeds the initial side panel width from the layout preferences service, clamped to bounds', () => {
      fixture.detectChanges();

      expect(layoutPreferencesMock.getSidePanelWidthPx).toHaveBeenCalled();
      expect(component.sidePanelWidthPx()).toBe(300);
    });

    it('clamps an out-of-bounds persisted width into [MIN_SIDE_PANEL_WIDTH_PX, MAX_SIDE_PANEL_WIDTH_PX] at seed time', async () => {
      layoutPreferencesMock.getSidePanelWidthPx.mockReturnValue(10000);

      await TestBed.resetTestingModule()
        .configureTestingModule({
          imports: [EditorPageComponent],
          providers: [
            { provide: ActivatedRoute, useValue: { data: routeDataSubject.asObservable() } },
            { provide: Location, useValue: locationMock },
            { provide: DocumentsService, useValue: documentsServiceMock },
            { provide: DiagramHubService, useValue: hubServiceMock },
            { provide: EditorLayoutPreferencesService, useValue: layoutPreferencesMock },
            { provide: FileSystemAccessService, useValue: fileSystemAccessServiceMock },
            { provide: TemplatesService, useValue: { list: jest.fn().mockReturnValue(of([])) } },
          ],
        })
        .compileComponents();
      const clampedFixture = TestBed.createComponent(EditorPageComponent);

      expect(clampedFixture.componentInstance.sidePanelWidthPx()).toBe(MAX_SIDE_PANEL_WIDTH_PX);
    });

    it('updates the live width used for the side panel binding on (widthChange), without persisting', () => {
      fixture.detectChanges();

      component.onSidePanelDividerWidthChange(350);

      expect(component.sidePanelWidthPx()).toBe(350);
      expect(layoutPreferencesMock.setSidePanelWidthPx).not.toHaveBeenCalled();
    });

    it('persists the width via the layout preferences service on (resizeEnd) only', () => {
      fixture.detectChanges();

      component.onSidePanelDividerWidthChange(320);
      expect(layoutPreferencesMock.setSidePanelWidthPx).not.toHaveBeenCalled();

      component.onSidePanelDividerResizeEnd(320);

      expect(layoutPreferencesMock.setSidePanelWidthPx).toHaveBeenCalledTimes(1);
      expect(layoutPreferencesMock.setSidePanelWidthPx).toHaveBeenCalledWith(320);
      expect(component.sidePanelWidthPx()).toBe(320);
    });

    it('exposes MIN_SIDE_PANEL_WIDTH_PX/MAX_SIDE_PANEL_WIDTH_PX for the template to bind to the pixel divider', () => {
      expect(component.MIN_SIDE_PANEL_WIDTH_PX).toBe(MIN_SIDE_PANEL_WIDTH_PX);
      expect(component.MAX_SIDE_PANEL_WIDTH_PX).toBe(MAX_SIDE_PANEL_WIDTH_PX);
    });
  });
});
