import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { ExplainFileEntry } from '../models/explain-file-entry.model';
import { ExplainPrompt } from '../models/explain-prompt.model';

/**
 * The "Explain This" endpoints. Local selections are read client-side
 * (File System Access API) and posted as path+content pairs; repository URLs
 * and saved folders are aggregated entirely server-side -- either way the
 * backend owns the one implementation of the GetFiles-style aggregation and
 * the prompt text.
 */
@Injectable({
  providedIn: 'root',
})
export class ExplainService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/explain`;

  aggregateFiles(files: ExplainFileEntry[]): Observable<ExplainPrompt> {
    return this.http.post<ExplainPrompt>(`${this.baseUrl}/aggregate`, { files });
  }

  aggregateUrl(url: string): Observable<ExplainPrompt> {
    return this.http.post<ExplainPrompt>(`${this.baseUrl}/aggregate-url`, { url });
  }

  /** Aggregates every document in a saved folder and its subfolders, entirely server-side. */
  aggregateFolder(folderId: string): Observable<ExplainPrompt> {
    return this.http.get<ExplainPrompt>(`${this.baseUrl}/folder/${folderId}`);
  }
}
