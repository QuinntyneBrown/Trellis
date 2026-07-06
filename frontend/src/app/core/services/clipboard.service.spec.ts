import { TestBed } from '@angular/core/testing';

import { ClipboardService } from './clipboard.service';

describe('ClipboardService', () => {
  let service: ClipboardService;
  let writeTextMock: jest.Mock;
  let writeMock: jest.Mock;

  /** Captures the constructor payload so tests can assert the mime keying. */
  class ClipboardItemStub {
    constructor(readonly items: Record<string, Promise<Blob>>) {}
  }

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ClipboardService);

    // jsdom implements neither navigator.clipboard nor ClipboardItem, so
    // both are stood up as stubs and torn back down after each test.
    writeTextMock = jest.fn().mockResolvedValue(undefined);
    writeMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock, write: writeMock },
      configurable: true,
    });
    (globalThis as Record<string, unknown>)['ClipboardItem'] = ClipboardItemStub;
  });

  afterEach(() => {
    delete (navigator as unknown as Record<string, unknown>)['clipboard'];
    delete (globalThis as Record<string, unknown>)['ClipboardItem'];
  });

  describe('copyText', () => {
    it('delegates to navigator.clipboard.writeText', async () => {
      await service.copyText('@startuml\n@enduml');

      expect(writeTextMock).toHaveBeenCalledWith('@startuml\n@enduml');
    });

    it('rejects with a friendly message when the clipboard API is unavailable', async () => {
      delete (navigator as unknown as Record<string, unknown>)['clipboard'];

      await expect(service.copyText('text')).rejects.toThrow('The clipboard is not available in this browser.');
    });
  });

  describe('copyPng', () => {
    it('wraps the pending blob promise in a ClipboardItem keyed image/png', async () => {
      const png = Promise.resolve(new Blob(['fake-png'], { type: 'image/png' }));

      await service.copyPng(png);

      expect(writeMock).toHaveBeenCalledTimes(1);
      const items = writeMock.mock.calls[0][0] as ClipboardItemStub[];
      expect(items).toHaveLength(1);
      expect(items[0]).toBeInstanceOf(ClipboardItemStub);
      expect(items[0].items['image/png']).toBe(png);
    });

    it('rejects with a friendly message when ClipboardItem is unavailable', async () => {
      delete (globalThis as Record<string, unknown>)['ClipboardItem'];

      await expect(service.copyPng(Promise.resolve(new Blob()))).rejects.toThrow(
        'Copying images is not supported in this browser.',
      );
    });

    it('rejects with a friendly message when clipboard.write is unavailable', async () => {
      delete (navigator as unknown as Record<string, unknown>)['clipboard'];

      await expect(service.copyPng(Promise.resolve(new Blob()))).rejects.toThrow(
        'Copying images is not supported in this browser.',
      );
    });
  });
});
