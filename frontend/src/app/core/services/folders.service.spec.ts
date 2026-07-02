import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { Folder } from '../models/folder.model';
import { FoldersService } from './folders.service';

describe('FoldersService', () => {
  let service: FoldersService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/folders`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(FoldersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists folders', () => {
    const folders: Folder[] = [{ id: 'f1', name: 'Diagrams', parentFolderId: null }];

    service.list().subscribe((result) => {
      expect(result).toEqual(folders);
    });

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('GET');
    req.flush(folders);
  });

  it('creates a folder', () => {
    service.create({ name: 'New folder', parentFolderId: null }).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ name: 'New folder', parentFolderId: null });
    req.flush({});
  });

  it('creates a nested folder with its parent id', () => {
    service.create({ name: 'Child', parentFolderId: 'parent-1' }).subscribe();

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.body).toEqual({ name: 'Child', parentFolderId: 'parent-1' });
    req.flush({});
  });

  it('renames a folder with a name-only body', () => {
    service.rename('f1', 'Renamed').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/f1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ name: 'Renamed' });
    req.flush({});
  });

  it('deletes a folder', () => {
    service.delete('f1').subscribe();

    const req = httpMock.expectOne(`${baseUrl}/f1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
