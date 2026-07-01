import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';

import { Document } from '../models/document.model';
import { DocumentsService } from '../services/documents.service';
import { documentResolver } from './document.resolver';

describe('documentResolver', () => {
  let documentsServiceMock: { getById: jest.Mock };
  let routerMock: { navigate: jest.Mock };

  beforeEach(() => {
    documentsServiceMock = { getById: jest.fn() };
    routerMock = { navigate: jest.fn().mockResolvedValue(true) };

    TestBed.configureTestingModule({
      providers: [
        { provide: DocumentsService, useValue: documentsServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    });
  });

  function runResolver(documentId: string | null): Observable<Document | null> {
    const route = { paramMap: { get: () => documentId } } as unknown as ActivatedRouteSnapshot;
    const state = {} as RouterStateSnapshot;
    return TestBed.runInInjectionContext(() => documentResolver(route, state)) as Observable<Document | null>;
  }

  it('resolves null immediately when there is no documentId param, without hitting the API', async () => {
    const result = await firstValueFrom(runResolver(null));

    expect(result).toBeNull();
    expect(documentsServiceMock.getById).not.toHaveBeenCalled();
  });

  it('resolves the document when the fetch succeeds', async () => {
    const document: Document = {
      id: '1',
      name: 'Doc',
      content: 'x',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: null,
    };
    documentsServiceMock.getById.mockReturnValue(of(document));

    const result = await firstValueFrom(runResolver('1'));

    expect(result).toEqual(document);
    expect(documentsServiceMock.getById).toHaveBeenCalledWith('1');
  });

  it('redirects to /editor and resolves null on a 404', async () => {
    documentsServiceMock.getById.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    const result = await firstValueFrom(runResolver('missing'));

    expect(result).toBeNull();
    expect(routerMock.navigate).toHaveBeenCalledWith(['/editor']);
  });

  it('re-throws non-404 errors instead of silently resolving null', async () => {
    const serverError = new HttpErrorResponse({ status: 500 });
    documentsServiceMock.getById.mockReturnValue(throwError(() => serverError));

    await expect(firstValueFrom(runResolver('1'))).rejects.toBe(serverError);
    expect(routerMock.navigate).not.toHaveBeenCalled();
  });
});
