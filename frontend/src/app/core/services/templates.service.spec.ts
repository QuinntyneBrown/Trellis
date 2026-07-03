import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Template } from '../models/template.model';
import { TemplateSummary } from '../models/template-summary.model';
import { TemplatesService } from './templates.service';

describe('TemplatesService', () => {
  let service: TemplatesService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/templates`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TemplatesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists template summaries', () => {
    const summaries: TemplateSummary[] = [
      { id: 't1', name: 'Blank', kind: 'plantuml', updatedAt: '2026-07-03T00:00:00Z' },
    ];

    service.list().subscribe((result) => {
      expect(result).toEqual(summaries);
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(summaries);
  });

  it('gets a template by id', () => {
    const template: Template = {
      id: 't1',
      name: 'Blank',
      content: '@startuml\n@enduml',
      kind: 'plantuml',
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: null,
    };

    service.getById('t1').subscribe((result) => {
      expect(result).toEqual(template);
    });

    const req = httpMock.expectOne(`${baseUrl}/t1`);
    expect(req.request.method).toBe('GET');
    req.flush(template);
  });

  it('creates a template', () => {
    service.create({ name: 'Mine', content: '# md', kind: 'markdown' }).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'Mine', content: '# md', kind: 'markdown' });
    req.flush({});
  });

  it('updates a template, always keying off the route id', () => {
    service.update('t9', { name: 'New', content: 'c', kind: 'plantuml' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/t9`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'New', content: 'c', kind: 'plantuml' });
    req.flush({});
  });

  it('renames a template by fetching it and echoing content AND kind back through update', () => {
    service.rename('t9', 'Renamed').subscribe();

    const getReq = httpMock.expectOne(`${baseUrl}/t9`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({
      id: 't9',
      name: 'Old',
      content: '# existing',
      kind: 'markdown',
      createdAt: '2026-07-03T00:00:00Z',
      updatedAt: null,
    });

    const putReq = httpMock.expectOne(`${baseUrl}/t9`);
    expect(putReq.request.method).toBe('PUT');
    expect(putReq.request.body).toEqual({ name: 'Renamed', content: '# existing', kind: 'markdown' });
    putReq.flush({});
  });

  it('deletes a template', () => {
    service.delete('t9').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/t9`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
