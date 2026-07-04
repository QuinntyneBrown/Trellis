import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { CreateFolderRequest } from '../models/create-folder-request.model';
import { Folder } from '../models/folder.model';

@Injectable({
  providedIn: 'root',
})
export class FoldersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/folders`;

  list(): Observable<Folder[]> {
    return this.http.get<Folder[]>(this.baseUrl);
  }

  create(request: CreateFolderRequest): Observable<Folder> {
    return this.http.post<Folder>(this.baseUrl, request);
  }

  rename(id: string, newName: string): Observable<Folder> {
    return this.http.put<Folder>(`${this.baseUrl}/${id}`, { name: newName });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  /**
   * Fetches the folder subtree aggregated as one markdown document.
   * responseType 'text' is load-bearing: the endpoint returns raw
   * text/markdown, which the default JSON parser would mangle.
   */
  exportFolder(id: string): Observable<string> {
    return this.http.get(`${this.baseUrl}/${id}/export`, { responseType: 'text' });
  }
}
