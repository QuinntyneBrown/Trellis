import { TestBed } from '@angular/core/testing';

import { FileDownloadService } from './file-download.service';

describe('FileDownloadService', () => {
  let service: FileDownloadService;
  let createObjectURLMock: jest.Mock;
  let revokeObjectURLMock: jest.Mock;
  let clickSpy: jest.SpyInstance;
  let clickedAnchor: HTMLAnchorElement | null;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileDownloadService);

    // jsdom implements neither object URLs nor anchor-click navigation, so
    // the whole Blob -> object URL -> click choreography is asserted against
    // mocks rather than real browser behavior.
    createObjectURLMock = jest.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = jest.fn();
    (URL as unknown as Record<string, unknown>)['createObjectURL'] = createObjectURLMock;
    (URL as unknown as Record<string, unknown>)['revokeObjectURL'] = revokeObjectURLMock;

    clickedAnchor = null;
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchor = this;
    });
  });

  afterEach(() => {
    delete (URL as unknown as Record<string, unknown>)['createObjectURL'];
    delete (URL as unknown as Record<string, unknown>)['revokeObjectURL'];
    jest.restoreAllMocks();
  });

  it('downloads text as a markdown file via a synthetic anchor click, then revokes the URL', async () => {
    service.downloadTextFile('notes.md', '# Notes');

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/markdown');
    // jsdom's Blob has no .text() -- read it back through FileReader instead.
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(blob);
    });
    expect(text).toBe('# Notes');

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickedAnchor!.download).toBe('notes.md');
    expect(clickedAnchor!.href).toBe('blob:mock-url');

    expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
  });

  it('honors an explicit mime type', () => {
    service.downloadTextFile('data.txt', 'plain', 'text/plain');

    const blob = createObjectURLMock.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('text/plain');
  });
});
