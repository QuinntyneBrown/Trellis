import { Injectable } from '@angular/core';

import { DirectoryChildEntry } from '../models/directory-child-entry.model';

const DB_NAME = 'trellis.explorerFs.v1';
const STORE_NAME = 'rootHandle';
const RECORD_KEY = 'current';

const DEFAULT_PERMISSION_MODE: FileSystemPermissionMode = 'readwrite';

/**
 * Thin wrapper around the browser File System Access API
 * (`window.showDirectoryPicker` plus the `FileSystemDirectoryHandle` /
 * `FileSystemFileHandle` surface), plus a small IndexedDB-backed
 * persistence layer for the last-picked root directory handle -- browsers
 * can structured-clone these handle objects directly into IndexedDB, so no
 * serialization of paths/permissions is needed on top.
 *
 * Every IndexedDB-backed method (saveRootHandle/loadRootHandle/
 * clearRootHandle) wraps its work in try/catch and swallows failures the
 * same way EditorLayoutPreferencesService swallows localStorage failures: a
 * failed persist/rehydrate must never crash boot or throw out to a caller,
 * it just behaves as though nothing had ever been stored.
 */
@Injectable({ providedIn: 'root' })
export class FileSystemAccessService {
  isSupported(): boolean {
    return 'showDirectoryPicker' in window;
  }

  /**
   * Opens the native directory picker. Always requests 'readwrite' up
   * front (rather than 'read' followed by a later upgrade prompt): almost
   * every folder opened here will eventually have a file saved back into
   * it, and a second permission prompt at that later point would be worse
   * UX than asking once, up front.
   *
   * Resolves to `null` (rather than rejecting) when the user cancels the
   * picker -- an expected, caller-uninteresting outcome, not an error.
   * Anything else is rethrown.
   */
  async pickDirectory(): Promise<FileSystemDirectoryHandle | null> {
    try {
      return await window.showDirectoryPicker({ mode: 'readwrite' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  /**
   * Lists the immediate (one-level) children of `dir`, sorted directories-
   * before-files, then alphabetically within each group via
   * localeCompare(..., { sensitivity: 'base' }) -- VS Code's own Explorer
   * sort convention.
   */
  async listChildren(dir: FileSystemDirectoryHandle): Promise<DirectoryChildEntry[]> {
    const entries: DirectoryChildEntry[] = [];
    for await (const handle of dir.values()) {
      entries.push({ name: handle.name, kind: handle.kind, handle });
    }

    return entries.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
  }

  async readTextFile(file: FileSystemFileHandle): Promise<string> {
    const contents = await file.getFile();
    return contents.text();
  }

  async writeTextFile(file: FileSystemFileHandle, contents: string): Promise<void> {
    const writable = await file.createWritable();
    try {
      await writable.write(contents);
    } finally {
      // Always attempted, even when write() rejects -- otherwise a failed
      // write would also leak an open writable stream.
      await writable.close();
    }
  }

  async queryPermission(
    handle: FileSystemHandle,
    mode: FileSystemPermissionMode = DEFAULT_PERMISSION_MODE,
  ): Promise<PermissionState> {
    return handle.queryPermission({ mode });
  }

  async requestPermission(
    handle: FileSystemHandle,
    mode: FileSystemPermissionMode = DEFAULT_PERMISSION_MODE,
  ): Promise<PermissionState> {
    return handle.requestPermission({ mode });
  }

  async saveRootHandle(handle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const db = await this.openDatabase();
      try {
        await runRequest(db, 'readwrite', (store) => store.put(handle, RECORD_KEY));
      } finally {
        db.close();
      }
    } catch {
      // Swallowed deliberately -- see class doc.
    }
  }

  async loadRootHandle(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.openDatabase();
      try {
        const result = await runRequest<FileSystemDirectoryHandle | undefined>(db, 'readonly', (store) =>
          store.get(RECORD_KEY),
        );
        return result ?? null;
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  }

  async clearRootHandle(): Promise<void> {
    try {
      const db = await this.openDatabase();
      try {
        await runRequest(db, 'readwrite', (store) => store.delete(RECORD_KEY));
      } finally {
        db.close();
      }
    } catch {
      // Swallowed deliberately -- see class doc.
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

/** Runs a single request against STORE_NAME within its own transaction. */
function runRequest<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
