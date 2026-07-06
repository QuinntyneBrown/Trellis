import { Injectable } from '@angular/core';

/**
 * Triggers browser file downloads for in-memory text content via the
 * Blob + object-URL + synthetic anchor click idiom -- the only way to hand
 * the browser a generated file without a server round-trip carrying
 * Content-Disposition. An injectable service (rather than a free function)
 * so consumers' specs can mock the download away instead of jsdom choking
 * on URL.createObjectURL, which it does not implement.
 */
@Injectable({
  providedIn: 'root',
})
export class FileDownloadService {
  downloadTextFile(fileName: string, text: string, mimeType = 'text/markdown'): void {
    this.downloadBlob(fileName, new Blob([text], { type: mimeType }));
  }

  downloadBlob(fileName: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();

    URL.revokeObjectURL(url);
  }
}
