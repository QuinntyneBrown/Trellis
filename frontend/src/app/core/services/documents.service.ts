import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { CreateDocumentRequest } from '../models/create-document-request.model';
import { Document } from '../models/document.model';
import { DocumentSummary } from '../models/document-summary.model';
import { UpdateDocumentRequest } from '../models/update-document-request.model';

@Injectable({
  providedIn: 'root',
})
export class DocumentsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/documents`;

  list(): Observable<DocumentSummary[]> {
    return this.http.get<DocumentSummary[]>(this.baseUrl);
  }

  getById(id: string): Observable<Document> {
    return this.http.get<Document>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateDocumentRequest): Observable<Document> {
    return this.http.post<Document>(this.baseUrl, request);
  }

  update(id: string, request: UpdateDocumentRequest): Observable<Document> {
    return this.http.put<Document>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Renames a document. The update endpoint requires both name and content,
   * so this hides the fetch-then-echo-the-content choreography that a
   * name-only change forces.
   */
  rename(id: string, newName: string): Observable<Document> {
    return this.getById(id).pipe(switchMap((full) => this.update(id, { name: newName, content: full.content })));
  }

  /**
   * Moves a document into a folder, or to the root when folderId is null.
   * A dedicated endpoint (not a folder field on update) so "move to root"
   * and "leave unchanged" can never be confused -- see the backend's
   * MoveDocumentRequest.
   */
  move(id: string, folderId: string | null): Observable<Document> {
    return this.http.put<Document>(`${this.baseUrl}/${id}/folder`, { folderId });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  upload(file: File, documentId?: string): Observable<Document> {
    const formData = new FormData();
    formData.append('file', file);
    if (documentId) {
      formData.append('documentId', documentId);
    }
    return this.http.post<Document>(`${this.baseUrl}/upload`, formData);
  }
}
