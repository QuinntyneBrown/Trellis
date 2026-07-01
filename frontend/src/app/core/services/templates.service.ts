import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Template } from '../models/template.model';

@Injectable({
  providedIn: 'root',
})
export class TemplatesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/templates`;

  list(): Observable<Template[]> {
    return this.http.get<Template[]>(this.baseUrl);
  }
}
