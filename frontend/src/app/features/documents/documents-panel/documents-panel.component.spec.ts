import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { DocumentSummary } from '../../../core/models/document-summary.model';
import { Folder } from '../../../core/models/folder.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { FoldersService } from '../../../core/services/folders.service';
import { DocumentsPanelComponent } from './documents-panel.component';

describe('DocumentsPanelComponent', () => {
  let fixture: ComponentFixture<DocumentsPanelComponent>;
  let component: DocumentsPanelComponent;
  let documentsServiceMock: {
    list: jest.Mock;
    delete: jest.Mock;
    rename: jest.Mock;
    getById: jest.Mock;
    update: jest.Mock;
    move: jest.Mock;
  };
  let foldersServiceMock: { list: jest.Mock; create: jest.Mock; rename: jest.Mock; delete: jest.Mock };

  const folders: Folder[] = [{ id: 'f1', name: 'Diagrams', parentFolderId: null }];
  const summaries: DocumentSummary[] = [
    { id: '1', name: 'Doc One', updatedAt: '2026-01-01T00:00:00Z', folderId: null, kind: 'plantuml' },
    { id: '2', name: 'Nested Doc', updatedAt: '2026-01-02T00:00:00Z', folderId: 'f1', kind: 'plantuml' },
  ];

  beforeEach(async () => {
    documentsServiceMock = {
      list: jest.fn().mockReturnValue(of(summaries)),
      delete: jest.fn().mockReturnValue(of(undefined)),
      rename: jest.fn().mockReturnValue(of({})),
      getById: jest.fn(),
      update: jest.fn(),
      move: jest.fn().mockReturnValue(of({})),
    };
    foldersServiceMock = {
      list: jest.fn().mockReturnValue(of(folders)),
      create: jest.fn().mockReturnValue(of({ id: 'new', name: 'New', parentFolderId: null })),
      rename: jest.fn().mockReturnValue(of({})),
      delete: jest.fn().mockReturnValue(of(undefined)),
    };

    await TestBed.configureTestingModule({
      imports: [DocumentsPanelComponent],
      providers: [
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: FoldersService, useValue: foldersServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsPanelComponent);
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

  it('renders nothing when closed', () => {
    component.open = false;
    fixture.detectChanges();

    expect(byTestId('documents-panel')).toBeNull();
    expect(documentsServiceMock.list).not.toHaveBeenCalled();
    expect(foldersServiceMock.list).not.toHaveBeenCalled();
  });

  it('fetches both lists and renders the tree when opened', () => {
    openPanel();

    expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);
    expect(foldersServiceMock.list).toHaveBeenCalledTimes(1);
    expect(byTestId('documents-panel')).toBeTruthy();
    expect(byTestId('documents-tree')).toBeTruthy();
    // Root level shows the folder and the root document; the nested document
    // stays hidden until its folder is expanded.
    expect(byTestId('document-folder')!.getAttribute('data-folder-name')).toBe('Diagrams');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(1);
  });

  it('shows the empty message only when there are no folders and no documents', () => {
    documentsServiceMock.list.mockReturnValue(of([]));
    foldersServiceMock.list.mockReturnValue(of([]));
    openPanel();

    expect(byTestId('documents-panel')!.textContent).toContain('No saved documents yet.');
    expect(byTestId('documents-tree')).toBeNull();
  });

  it('emits documentOpened when a root document row is opened', () => {
    openPanel();
    const spy = jest.fn();
    component.documentOpened.subscribe(spy);

    (byTestId('document-item-open') as HTMLButtonElement).click();

    expect(spy).toHaveBeenCalledWith(summaries[0]);
  });

  it('expands a folder locally (no refetch) and reveals its documents', () => {
    openPanel();
    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(1);

    byTestId('document-folder')!.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(2);
    expect(foldersServiceMock.list).toHaveBeenCalledTimes(1);
    expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);
  });

  it('keeps a folder expanded across refreshes, keyed by id', () => {
    openPanel();
    byTestId('document-folder')!.click();
    fixture.detectChanges();

    component.refresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(2);
  });

  it('creates a root folder from the header button and refreshes', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Fresh folder');
    openPanel();

    (byTestId('documents-new-folder') as HTMLButtonElement).click();

    expect(foldersServiceMock.create).toHaveBeenCalledWith({ name: 'Fresh folder', parentFolderId: null });
    expect(foldersServiceMock.list).toHaveBeenCalledTimes(2);
  });

  it('does not create a folder when the header prompt is cancelled', () => {
    jest.spyOn(window, 'prompt').mockReturnValue(null);
    openPanel();

    (byTestId('documents-new-folder') as HTMLButtonElement).click();

    expect(foldersServiceMock.create).not.toHaveBeenCalled();
  });

  it('creates a subfolder via the row button and pre-expands its parent', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Nested folder');
    openPanel();

    (byTestId('document-folder-new-folder') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(foldersServiceMock.create).toHaveBeenCalledWith({ name: 'Nested folder', parentFolderId: 'f1' });
    // The parent was pre-expanded, so after the refresh its nested document shows.
    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(2);
  });

  it('dispatches renames to the folders service for folder nodes', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Renamed folder');
    openPanel();

    (byTestId('document-folder-rename') as HTMLButtonElement).click();

    expect(foldersServiceMock.rename).toHaveBeenCalledWith('f1', 'Renamed folder');
    expect(documentsServiceMock.rename).not.toHaveBeenCalled();
  });

  it('dispatches renames to the documents service for document nodes', () => {
    jest.spyOn(window, 'prompt').mockReturnValue('Renamed doc');
    openPanel();

    (byTestId('document-item-rename') as HTMLButtonElement).click();

    expect(documentsServiceMock.rename).toHaveBeenCalledWith('1', 'Renamed doc');
    expect(foldersServiceMock.rename).not.toHaveBeenCalled();
  });

  it('dispatches deletes by node kind and refreshes', () => {
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    openPanel();

    (byTestId('document-folder-delete') as HTMLButtonElement).click();
    expect(foldersServiceMock.delete).toHaveBeenCalledWith('f1');

    (byTestId('document-item-delete') as HTMLButtonElement).click();
    expect(documentsServiceMock.delete).toHaveBeenCalledWith('1');
  });

  describe('revealing the active document on open (D-009)', () => {
    const nestedFolders: Folder[] = [
      { id: 'parent', name: 'parent', parentFolderId: null },
      { id: 'child', name: 'child', parentFolderId: 'parent' },
    ];
    const nestedSummaries: DocumentSummary[] = [
      { id: 'deep-doc', name: 'Deep Doc', updatedAt: '2026-01-03T00:00:00Z', folderId: 'child', kind: 'plantuml' },
    ];

    beforeEach(() => {
      foldersServiceMock.list.mockReturnValue(of(nestedFolders));
      documentsServiceMock.list.mockReturnValue(of(nestedSummaries));
    });

    it('expands the whole ancestor chain of the active document when the panel opens', () => {
      component.activeDocumentId = 'deep-doc';
      openPanel();

      const row = byTestId('document-item')!;
      expect(row.getAttribute('data-document-name')).toBe('Deep Doc');
      expect(row.classList).toContain('document-tree-node__row--active');
      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="document-folder"][aria-expanded="true"]').length,
      ).toBe(2);
    });

    it('leaves everything collapsed when no document is active', () => {
      component.activeDocumentId = null;
      openPanel();

      expect(byTestId('document-item')).toBeNull();
      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="document-folder"][aria-expanded="true"]').length,
      ).toBe(0);
    });

    it('does not fight a deliberate collapse on a plain mutation refresh', () => {
      component.activeDocumentId = 'deep-doc';
      openPanel();

      // Collapse the parent folder (the active doc's chain), then refresh
      // WITHOUT reopening the panel -- the collapse must survive.
      const parentRow = fixture.nativeElement.querySelector('[data-folder-name="parent"]') as HTMLElement;
      parentRow.click();
      fixture.detectChanges();
      expect(byTestId('document-item')).toBeNull();

      component.refresh();
      fixture.detectChanges();

      expect(byTestId('document-item')).toBeNull();
    });

    it('ignores an active id that no longer exists', () => {
      component.activeDocumentId = 'ghost';
      openPanel();

      expect(
        fixture.nativeElement.querySelectorAll('[data-testid="document-folder"][aria-expanded="true"]').length,
      ).toBe(0);
    });
  });

  it('highlights the row matching activeDocumentId as the currently open document', () => {
    component.activeDocumentId = '1';
    openPanel();

    const row = byTestId('document-item')!;
    expect(row.getAttribute('data-document-name')).toBe('Doc One');
    expect(row.classList).toContain('document-tree-node__row--active');
    expect(row.getAttribute('aria-current')).toBe('true');
  });

  describe('moving documents', () => {
    it('moves a document into a folder, pre-expands the target, and refreshes', () => {
      openPanel();

      component.onMoveDocument('1', 'f1');
      fixture.detectChanges();

      expect(documentsServiceMock.move).toHaveBeenCalledWith('1', 'f1');
      expect(documentsServiceMock.list).toHaveBeenCalledTimes(2);
      // The target folder was pre-expanded, so its nested document is visible
      // after the refresh without any extra click.
      expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(2);
    });

    it('never calls move when the document is already in the target folder', () => {
      openPanel();

      component.onMoveDocument('2', 'f1'); // doc 2 already lives in f1
      component.onMoveDocument('1', null); // doc 1 is already at the root

      expect(documentsServiceMock.move).not.toHaveBeenCalled();
      expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);
    });

    it('moves a document to the root with a null target', () => {
      openPanel();

      component.onMoveDocument('2', null);

      expect(documentsServiceMock.move).toHaveBeenCalledWith('2', null);
    });

    it('ignores moves for unknown document ids', () => {
      openPanel();

      component.onMoveDocument('missing', 'f1');

      expect(documentsServiceMock.move).not.toHaveBeenCalled();
    });

    it('opens the move dialog from a row moveRequested event and moves on confirm', () => {
      openPanel();

      (byTestId('document-item-move') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(byTestId('move-document-dialog')).toBeTruthy();
      expect(component.movingDocument()!.id).toBe('1');

      component.onMoveDialogConfirm({ folderId: 'f1' });
      fixture.detectChanges();

      expect(documentsServiceMock.move).toHaveBeenCalledWith('1', 'f1');
      expect(byTestId('move-document-dialog')).toBeNull();
    });

    it('closes the move dialog without moving on cancel', () => {
      openPanel();

      (byTestId('document-item-move') as HTMLButtonElement).click();
      fixture.detectChanges();

      component.onMoveDialogCancel();
      fixture.detectChanges();

      expect(documentsServiceMock.move).not.toHaveBeenCalled();
      expect(byTestId('move-document-dialog')).toBeNull();
    });

    it('moves the dragged document to the root when dropped on the tree background', () => {
      openPanel();

      component.onRootDrop({
        preventDefault: jest.fn(),
        dataTransfer: {
          types: ['application/x-trellis-document-id'],
          getData: jest.fn().mockReturnValue('2'),
        },
      } as unknown as DragEvent);

      expect(documentsServiceMock.move).toHaveBeenCalledWith('2', null);
      expect(component.isRootDragOver).toBe(false);
    });

    it('ignores root-zone drags that are not document drags', () => {
      openPanel();
      const event = {
        preventDefault: jest.fn(),
        dataTransfer: { types: ['Files'], getData: jest.fn() },
      } as unknown as DragEvent;

      component.onRootDragEnter(event);
      component.onRootDrop(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(component.isRootDragOver).toBe(false);
      expect(documentsServiceMock.move).not.toHaveBeenCalled();
    });
  });

  it('prunes expanded ids for folders that no longer exist', () => {
    openPanel();
    byTestId('document-folder')!.click();
    fixture.detectChanges();

    // The folder disappears server-side; its id must fall out of the expanded set.
    foldersServiceMock.list.mockReturnValue(of([]));
    documentsServiceMock.list.mockReturnValue(of([summaries[0]]));
    component.refresh();
    fixture.detectChanges();

    // Re-creating a folder with the same id starts collapsed again.
    foldersServiceMock.list.mockReturnValue(of(folders));
    documentsServiceMock.list.mockReturnValue(of(summaries));
    component.refresh();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('[data-testid="document-item"]').length).toBe(1);
  });
});
