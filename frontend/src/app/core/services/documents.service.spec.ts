import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Document } from '../models/document.model';
import { DocumentSummary } from '../models/document-summary.model';
import { DocumentsService } from './documents.service';

describe('DocumentsService', () => {
  let service: DocumentsService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/documents`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DocumentsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists document summaries', () => {
    const summaries: DocumentSummary[] = [
      { id: '1', name: 'Doc 1', updatedAt: '2026-01-01T00:00:00Z' },
    ];

    service.list().subscribe((result) => {
      expect(result).toEqual(summaries);
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(summaries);
  });

  it('gets a document by id', () => {
    const document: Document = {
      id: '1',
      name: 'Doc 1',
      content: '@startuml\n@enduml',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };

    service.getById('1').subscribe((result) => {
      expect(result).toEqual(document);
    });

    const req = httpMock.expectOne(`${baseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(document);
  });

  it('creates a document', () => {
    service.create({ name: 'New', content: 'x' }).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'New', content: 'x' });
    req.flush({});
  });

  it('updates a document, always keying off the route id', () => {
    service.update('42', { name: 'Renamed', content: 'y' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/42`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Renamed', content: 'y' });
    req.flush({});
  });

  it('deletes a document', () => {
    service.delete('42').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/42`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });

  it('uploads a file with an optional documentId field', () => {
    const file = new File(['@startuml\n@enduml'], 'diagram.puml');

    service.upload(file, 'existing-id').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/upload`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('file')).toBe(file);
    expect(body.get('documentId')).toBe('existing-id');
    req.flush({});
  });

  it('uploads a file without a documentId field when none is provided', () => {
    const file = new File(['@startuml\n@enduml'], 'diagram.puml');

    service.upload(file).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/upload`);
    const body = req.request.body as FormData;
    expect(body.get('documentId')).toBeNull();
    req.flush({});
  });
});
