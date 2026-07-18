import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { ExplainService } from './explain.service';

describe('ExplainService', () => {
  let service: ExplainService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/explain`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExplainService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts local path+content pairs to the aggregate endpoint', () => {
    const files = [{ path: 'src/main.ts', content: 'const x = 1;' }];
    const response = {
      prompt: '# Explain This',
      fileCount: 1,
      attachmentFileName: 'explain-this-files.md',
      attachmentContent: '=== FILE: src/main.ts ===',
    };

    service.aggregateFiles(files).subscribe((result) => {
      expect(result).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/aggregate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ files });
    req.flush(response);
  });

  it('gets the folder aggregate endpoint for a saved folder id', () => {
    const response = {
      prompt: '# Explain This',
      fileCount: 4,
      attachmentFileName: 'explain-this-files.md',
      attachmentContent: '=== FILE: Overview.md ===',
    };

    service.aggregateFolder('f1').subscribe((result) => {
      expect(result).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/folder/f1`);
    expect(req.request.method).toBe('GET');
    req.flush(response);
  });

  it('posts a repository URL to the aggregate-url endpoint', () => {
    const response = {
      prompt: '# Explain This',
      fileCount: 12,
      attachmentFileName: 'explain-this-files.md',
      attachmentContent: '=== FILE: README.md ===',
    };

    service.aggregateUrl('https://github.com/owner/repo').subscribe((result) => {
      expect(result).toEqual(response);
    });

    const req = httpMock.expectOne(`${baseUrl}/aggregate-url`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ url: 'https://github.com/owner/repo' });
    req.flush(response);
  });
});
