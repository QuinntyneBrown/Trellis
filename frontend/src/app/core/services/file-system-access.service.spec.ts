import { TestBed } from '@angular/core/testing';

import { FileSystemAccessService } from './file-system-access.service';

/** Minimal FileSystemHandle-shaped fake, just enough for listChildren's sort. */
function fakeChildHandle(name: string, kind: 'file' | 'directory'): FileSystemHandle {
  return { name, kind } as unknown as FileSystemHandle;
}

/**
 * Fake directory handle whose values() yields the given children in
 * whatever (deliberately scrambled) order they're supplied, exercising
 * listChildren's own sort rather than relying on the input already being
 * sorted.
 */
function fakeDirectoryHandle(children: Array<{ name: string; kind: 'file' | 'directory' }>): FileSystemDirectoryHandle {
  return {
    values: () => {
      let index = 0;
      return {
        [Symbol.asyncIterator]() {
          return this;
        },
        next: async () => {
          if (index < children.length) {
            const child = children[index++];
            return { value: fakeChildHandle(child.name, child.kind), done: false as const };
          }
          return { value: undefined, done: true as const };
        },
      };
    },
  } as unknown as FileSystemDirectoryHandle;
}

interface FakeIDBRequest<T> {
  result?: T;
  error?: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

function resolveRequest<T>(request: FakeIDBRequest<T>, result: T): void {
  request.result = result;
  queueMicrotask(() => request.onsuccess?.());
}

function rejectingOpen(): { open: jest.Mock } {
  return {
    open: jest.fn(() => {
      const request: FakeIDBRequest<unknown> = { onsuccess: null, onerror: null };
      queueMicrotask(() => request.onerror?.());
      return request;
    }),
  };
}

/** Hand-built fake IDBOpenDBRequest/IDBDatabase pair backing a single in-memory record. */
function createFakeIndexedDb(): { indexedDbMock: { open: jest.Mock } } {
  let stored: unknown;

  const store = {
    put: jest.fn((value: unknown) => {
      stored = value;
      const request: FakeIDBRequest<undefined> = { onsuccess: null, onerror: null };
      resolveRequest(request, undefined);
      return request;
    }),
    get: jest.fn(() => {
      const request: FakeIDBRequest<unknown> = { onsuccess: null, onerror: null };
      resolveRequest(request, stored);
      return request;
    }),
    delete: jest.fn(() => {
      stored = undefined;
      const request: FakeIDBRequest<undefined> = { onsuccess: null, onerror: null };
      resolveRequest(request, undefined);
      return request;
    }),
  };

  const db = {
    createObjectStore: jest.fn(),
    transaction: jest.fn(() => ({
      objectStore: jest.fn(() => store),
    })),
    close: jest.fn(),
  };

  const indexedDbMock = {
    open: jest.fn(() => {
      const request: FakeIDBRequest<typeof db> & { onupgradeneeded: (() => void) | null } = {
        result: db,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }),
  };

  return { indexedDbMock };
}

describe('FileSystemAccessService', () => {
  let service: FileSystemAccessService;
  let originalIndexedDb: unknown;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FileSystemAccessService);
    originalIndexedDb = (globalThis as { indexedDB?: unknown }).indexedDB;
  });

  afterEach(() => {
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
    delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;
    (globalThis as { indexedDB?: unknown }).indexedDB = originalIndexedDb;
  });

  describe('isSupported', () => {
    it('returns true when window.showDirectoryPicker exists', () => {
      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = jest.fn();

      expect(service.isSupported()).toBe(true);
    });

    it('returns false when window.showDirectoryPicker does not exist', () => {
      delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;

      expect(service.isSupported()).toBe(false);
    });
  });

  describe('isFilePickerSupported', () => {
    it('returns true when window.showOpenFilePicker exists', () => {
      (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = jest.fn();

      expect(service.isFilePickerSupported()).toBe(true);
    });

    it('returns false when window.showOpenFilePicker does not exist', () => {
      delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker;

      expect(service.isFilePickerSupported()).toBe(false);
    });
  });

  describe('pickDirectory', () => {
    it('resolves the handle returned by window.showDirectoryPicker, requesting readwrite mode up front', async () => {
      const handle = {} as FileSystemDirectoryHandle;
      const showDirectoryPicker = jest.fn().mockResolvedValue(handle);
      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = showDirectoryPicker;

      const result = await service.pickDirectory();

      expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result).toBe(handle);
    });

    it('forwards an explicit read mode for read-only consumers', async () => {
      const showDirectoryPicker = jest.fn().mockResolvedValue({} as FileSystemDirectoryHandle);
      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = showDirectoryPicker;

      await service.pickDirectory('read');

      expect(showDirectoryPicker).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('returns null when the user cancels the picker (AbortError)', async () => {
      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = jest
        .fn()
        .mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

      const result = await service.pickDirectory();

      expect(result).toBeNull();
    });

    it('rethrows any error other than AbortError', async () => {
      (window as unknown as { showDirectoryPicker: unknown }).showDirectoryPicker = jest
        .fn()
        .mockRejectedValue(new Error('boom'));

      await expect(service.pickDirectory()).rejects.toThrow('boom');
    });
  });

  describe('pickFile', () => {
    it('resolves the first handle returned by window.showOpenFilePicker, requesting a single file', async () => {
      const handle = {} as FileSystemFileHandle;
      const showOpenFilePicker = jest.fn().mockResolvedValue([handle]);
      (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = showOpenFilePicker;

      const result = await service.pickFile();

      expect(showOpenFilePicker).toHaveBeenCalledWith({ multiple: false });
      expect(result).toBe(handle);
    });

    it('returns null when the user cancels the picker (AbortError)', async () => {
      (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = jest
        .fn()
        .mockRejectedValue(new DOMException('The user aborted a request.', 'AbortError'));

      const result = await service.pickFile();

      expect(result).toBeNull();
    });

    it('rethrows any error other than AbortError', async () => {
      (window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = jest
        .fn()
        .mockRejectedValue(new Error('boom'));

      await expect(service.pickFile()).rejects.toThrow('boom');
    });
  });

  describe('listChildren', () => {
    it('sorts directories before files, then alphabetically (case-insensitively) within each group', async () => {
      const dir = fakeDirectoryHandle([
        { name: 'zebra.txt', kind: 'file' },
        { name: 'Banana', kind: 'directory' },
        { name: 'apple.txt', kind: 'file' },
        { name: 'apricot', kind: 'directory' },
      ]);

      const result = await service.listChildren(dir);

      expect(result.map((entry) => entry.name)).toEqual(['apricot', 'Banana', 'apple.txt', 'zebra.txt']);
      expect(result.map((entry) => entry.kind)).toEqual(['directory', 'directory', 'file', 'file']);
    });

    it('returns an empty array for an empty directory', async () => {
      const dir = fakeDirectoryHandle([]);

      const result = await service.listChildren(dir);

      expect(result).toEqual([]);
    });
  });

  describe('readTextFile / writeTextFile', () => {
    it('readTextFile delegates to file.getFile().text()', async () => {
      const text = jest.fn().mockResolvedValue('file contents');
      const file = { getFile: jest.fn().mockResolvedValue({ text }) } as unknown as FileSystemFileHandle;

      const result = await service.readTextFile(file);

      expect(file.getFile).toHaveBeenCalled();
      expect(text).toHaveBeenCalled();
      expect(result).toBe('file contents');
    });

    it('writeTextFile writes then closes the writable stream', async () => {
      const write = jest.fn().mockResolvedValue(undefined);
      const close = jest.fn().mockResolvedValue(undefined);
      const file = { createWritable: jest.fn().mockResolvedValue({ write, close }) } as unknown as FileSystemFileHandle;

      await service.writeTextFile(file, 'new contents');

      expect(write).toHaveBeenCalledWith('new contents');
      expect(close).toHaveBeenCalled();
    });

    it('still closes the writable stream (and rethrows) when write() rejects', async () => {
      const write = jest.fn().mockRejectedValue(new Error('disk full'));
      const close = jest.fn().mockResolvedValue(undefined);
      const file = { createWritable: jest.fn().mockResolvedValue({ write, close }) } as unknown as FileSystemFileHandle;

      await expect(service.writeTextFile(file, 'new contents')).rejects.toThrow('disk full');
      expect(close).toHaveBeenCalled();
    });
  });

  describe('createFile', () => {
    it('delegates to parent.getFileHandle with create:true and returns the resolved handle', async () => {
      const fileHandle = {} as FileSystemFileHandle;
      const getFileHandle = jest.fn().mockResolvedValue(fileHandle);
      const parent = { getFileHandle } as unknown as FileSystemDirectoryHandle;

      const result = await service.createFile(parent, 'new-file.puml');

      expect(getFileHandle).toHaveBeenCalledWith('new-file.puml', { create: true });
      expect(result).toBe(fileHandle);
    });

    it('propagates a rejection rather than swallowing it', async () => {
      const getFileHandle = jest.fn().mockRejectedValue(new Error('cannot create'));
      const parent = { getFileHandle } as unknown as FileSystemDirectoryHandle;

      await expect(service.createFile(parent, 'new-file.puml')).rejects.toThrow('cannot create');
    });
  });

  describe('createDirectory', () => {
    it('delegates to parent.getDirectoryHandle with create:true and returns the resolved handle', async () => {
      const dirHandle = {} as FileSystemDirectoryHandle;
      const getDirectoryHandle = jest.fn().mockResolvedValue(dirHandle);
      const parent = { getDirectoryHandle } as unknown as FileSystemDirectoryHandle;

      const result = await service.createDirectory(parent, 'new-folder');

      expect(getDirectoryHandle).toHaveBeenCalledWith('new-folder', { create: true });
      expect(result).toBe(dirHandle);
    });

    it('propagates a rejection rather than swallowing it', async () => {
      const getDirectoryHandle = jest.fn().mockRejectedValue(new Error('cannot create'));
      const parent = { getDirectoryHandle } as unknown as FileSystemDirectoryHandle;

      await expect(service.createDirectory(parent, 'new-folder')).rejects.toThrow('cannot create');
    });
  });

  describe('removeEntry', () => {
    it('passes recursive:false when removing a file', async () => {
      const removeEntry = jest.fn().mockResolvedValue(undefined);
      const parent = { removeEntry } as unknown as FileSystemDirectoryHandle;

      await service.removeEntry(parent, 'diagram.puml', 'file');

      expect(removeEntry).toHaveBeenCalledWith('diagram.puml', { recursive: false });
    });

    it('passes recursive:true when removing a directory', async () => {
      const removeEntry = jest.fn().mockResolvedValue(undefined);
      const parent = { removeEntry } as unknown as FileSystemDirectoryHandle;

      await service.removeEntry(parent, 'subdir', 'directory');

      expect(removeEntry).toHaveBeenCalledWith('subdir', { recursive: true });
    });

    it('propagates a rejection rather than swallowing it', async () => {
      const removeEntry = jest.fn().mockRejectedValue(new Error('permission denied'));
      const parent = { removeEntry } as unknown as FileSystemDirectoryHandle;

      await expect(service.removeEntry(parent, 'diagram.puml', 'file')).rejects.toThrow('permission denied');
    });
  });

  describe('queryPermission / requestPermission', () => {
    it('queryPermission passes through to handle.queryPermission, defaulting to readwrite', async () => {
      const queryPermission = jest.fn().mockResolvedValue('granted');
      const handle = { queryPermission } as unknown as FileSystemHandle;

      const result = await service.queryPermission(handle);

      expect(queryPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result).toBe('granted');
    });

    it('queryPermission forwards an explicit mode', async () => {
      const queryPermission = jest.fn().mockResolvedValue('prompt');
      const handle = { queryPermission } as unknown as FileSystemHandle;

      await service.queryPermission(handle, 'read');

      expect(queryPermission).toHaveBeenCalledWith({ mode: 'read' });
    });

    it('requestPermission passes through to handle.requestPermission, defaulting to readwrite', async () => {
      const requestPermission = jest.fn().mockResolvedValue('granted');
      const handle = { requestPermission } as unknown as FileSystemHandle;

      const result = await service.requestPermission(handle);

      expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
      expect(result).toBe('granted');
    });

    it('requestPermission forwards an explicit mode', async () => {
      const requestPermission = jest.fn().mockResolvedValue('denied');
      const handle = { requestPermission } as unknown as FileSystemHandle;

      await service.requestPermission(handle, 'read');

      expect(requestPermission).toHaveBeenCalledWith({ mode: 'read' });
    });
  });

  describe('root handle persistence (IndexedDB)', () => {
    it('round-trips a saved handle through saveRootHandle/loadRootHandle', async () => {
      const { indexedDbMock } = createFakeIndexedDb();
      (globalThis as { indexedDB?: unknown }).indexedDB = indexedDbMock;
      const handle = { name: 'my-folder', kind: 'directory' } as unknown as FileSystemDirectoryHandle;

      await service.saveRootHandle(handle);
      const loaded = await service.loadRootHandle();

      expect(loaded).toBe(handle);
    });

    it('loadRootHandle resolves null when nothing has ever been stored', async () => {
      const { indexedDbMock } = createFakeIndexedDb();
      (globalThis as { indexedDB?: unknown }).indexedDB = indexedDbMock;

      const loaded = await service.loadRootHandle();

      expect(loaded).toBeNull();
    });

    it('saveRootHandle swallows a failing indexedDB.open and never throws', async () => {
      (globalThis as { indexedDB?: unknown }).indexedDB = rejectingOpen();

      await expect(service.saveRootHandle({} as FileSystemDirectoryHandle)).resolves.toBeUndefined();
    });

    it('loadRootHandle swallows a failing indexedDB.open and resolves null', async () => {
      (globalThis as { indexedDB?: unknown }).indexedDB = rejectingOpen();

      await expect(service.loadRootHandle()).resolves.toBeNull();
    });
  });
});
