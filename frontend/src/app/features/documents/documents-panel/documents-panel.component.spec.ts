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
  };
  let foldersServiceMock: { list: jest.Mock; create: jest.Mock; rename: jest.Mock; delete: jest.Mock };

  const folders: Folder[] = [{ id: 'f1', name: 'Diagrams', parentFolderId: null }];
  const summaries: DocumentSummary[] = [
    { id: '1', name: 'Doc One', updatedAt: '2026-01-01T00:00:00Z', folderId: null },
    { id: '2', name: 'Nested Doc', updatedAt: '2026-01-02T00:00:00Z', folderId: 'f1' },
  ];

  beforeEach(async () => {
    documentsServiceMock = {
      list: jest.fn().mockReturnValue(of(summaries)),
      delete: jest.fn().mockReturnValue(of(undefined)),
      rename: jest.fn().mockReturnValue(of({})),
      getById: jest.fn(),
      update: jest.fn(),
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
