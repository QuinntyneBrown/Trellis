import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { Document } from '../../../core/models/document.model';
import { DocumentSummary } from '../../../core/models/document-summary.model';
import { DocumentsService } from '../../../core/services/documents.service';
import { DocumentsListPageComponent } from './documents-list-page.component';

describe('DocumentsListPageComponent', () => {
  let fixture: ComponentFixture<DocumentsListPageComponent>;
  let component: DocumentsListPageComponent;
  let documentsServiceMock: {
    list: jest.Mock;
    delete: jest.Mock;
    getById: jest.Mock;
    update: jest.Mock;
  };
  let routerMock: { navigate: jest.Mock };
  const summaries: DocumentSummary[] = [
    { id: '1', name: 'Doc One', updatedAt: '2026-01-01T00:00:00Z' },
    { id: '2', name: 'Doc Two', updatedAt: '2026-01-02T00:00:00Z' },
  ];

  beforeEach(async () => {
    documentsServiceMock = {
      list: jest.fn().mockReturnValue(of(summaries)),
      delete: jest.fn().mockReturnValue(of(undefined)),
      getById: jest.fn(),
      update: jest.fn(),
    };
    routerMock = { navigate: jest.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [DocumentsListPageComponent],
      providers: [
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentsListPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('fetches and renders the document summaries', () => {
    expect(documentsServiceMock.list).toHaveBeenCalledTimes(1);

    const items = fixture.nativeElement.querySelectorAll('[data-testid="document-item"]');
    expect(items.length).toBe(2);
  });

  it('navigates to the editor route when a document is opened', () => {
    component.onOpen(summaries[0]);
    expect(routerMock.navigate).toHaveBeenCalledWith(['/editor', '1']);
  });

  it('refetches the list after deleting a document', () => {
    component.onDelete(summaries[0]);

    expect(documentsServiceMock.delete).toHaveBeenCalledWith('1');
    expect(documentsServiceMock.list).toHaveBeenCalledTimes(2);
  });

  it('renames by fetching the full document then updating with the new name and existing content', () => {
    const full: Document = {
      id: '1',
      name: 'Doc One',
      content: '@startuml\n@enduml',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
    documentsServiceMock.getById.mockReturnValue(of(full));
    documentsServiceMock.update.mockReturnValue(of({ ...full, name: 'Renamed' }));

    component.onRename({ document: summaries[0], newName: 'Renamed' });

    expect(documentsServiceMock.getById).toHaveBeenCalledWith('1');
    expect(documentsServiceMock.update).toHaveBeenCalledWith('1', {
      name: 'Renamed',
      content: '@startuml\n@enduml',
    });
    expect(documentsServiceMock.list).toHaveBeenCalledTimes(2);
  });
});
