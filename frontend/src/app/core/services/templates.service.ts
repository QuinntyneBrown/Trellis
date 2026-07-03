import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';

import { environment } from '../../../environments/environment';
import { CreateTemplateRequest } from '../models/create-template-request.model';
import { Template } from '../models/template.model';
import { TemplateSummary } from '../models/template-summary.model';
import { UpdateTemplateRequest } from '../models/update-template-request.model';

@Injectable({
  providedIn: 'root',
})
export class TemplatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/templates`;

  list(): Observable<TemplateSummary[]> {
    return this.http.get<TemplateSummary[]>(this.baseUrl);
  }

  getById(id: string): Observable<Template> {
    return this.http.get<Template>(`${this.baseUrl}/${id}`);
  }

  create(request: CreateTemplateRequest): Observable<Template> {
    return this.http.post<Template>(this.baseUrl, request);
  }

  update(id: string, request: UpdateTemplateRequest): Observable<Template> {
    return this.http.put<Template>(`${this.baseUrl}/${id}`, request);
  }

  /**
   * Renames a template. The update endpoint requires content and kind too,
   * so this hides the fetch-then-echo choreography a name-only change forces
   * (the same idiom as DocumentsService.rename).
   */
  rename(id: string, newName: string): Observable<Template> {
    return this.getById(id).pipe(
      switchMap((full) => this.update(id, { name: newName, content: full.content, kind: full.kind })),
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
