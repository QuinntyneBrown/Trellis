import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { ResolveFn, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Document } from '../models/document.model';
import { DocumentsService } from '../services/documents.service';

/**
 * Resolves the document for the 'editor/:documentId' route. When there is no
 * documentId param (the plain 'editor' route) it resolves null so the editor
 * starts blank. A 404 for a stale/bad id redirects back to a fresh editor.
 */
export const documentResolver: ResolveFn<Document | null> = (route): Observable<Document | null> => {
  const documentId = route.paramMap.get('documentId');
  if (!documentId) {
    return of(null);
  }

  const documentsService = inject(DocumentsService);
  const router = inject(Router);

  return documentsService.getById(documentId).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 404) {
        void router.navigate(['/editor']);
        return of(null);
      }
      throw error;
    }),
  );
};
