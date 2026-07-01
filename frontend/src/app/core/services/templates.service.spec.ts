import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Template } from '../models/template.model';
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

  it('lists the template catalog', () => {
    const templates: Template[] = [
      { key: 'c4-context', name: 'C4 - Context', category: 'C4', content: '@startuml\n@enduml' },
    ];

    service.list().subscribe((result) => {
      expect(result).toEqual(templates);
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(templates);
  });
});
