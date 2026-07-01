import { Page } from '@playwright/test';

/**
 * Fixed OPFS-relative directory name used as the "picked" folder root for
 * every Explorer e2e test. Exported so specs/POM code can assert against the
 * exact folder name the Explorer panel shows once opened.
 */
export const OPFS_ROOT_DIR_NAME = 'trellis-e2e-explorer-root';

/** Same DB/store/key FileSystemAccessService itself reads/writes via saveRootHandle/loadRootHandle. */
const INDEXED_DB_NAME = 'trellis.explorerFs.v1';
const INDEXED_DB_STORE_NAME = 'rootHandle';
const INDEXED_DB_RECORD_KEY = 'current';

/**
 * A simple nested plain-object shape describing a directory tree to seed:
 * string leaves are file contents, nested objects are subdirectories.
 *
 * e.g. `{ 'readme.txt': 'hi', docs: { 'a.puml': '@startuml\n@enduml' } }`
 */
export interface OpfsTreeNode {
  [name: string]: string | OpfsTreeNode;
}

/**
 * Monkey-patches the BROWSER GLOBAL `window.showDirectoryPicker` (via
 * page.addInitScript(), so it's in place before Angular bootstraps on every
 * subsequent navigation in this page's context) to resolve a directory
 * handle from the origin private file system (OPFS) instead of invoking the
 * real native OS picker dialog.
 *
 * The application's FileSystemAccessService.pickDirectory() is NOT changed
 * or made test-aware in any way -- it still calls the exact same
 * `window.showDirectoryPicker()` global, which has simply been swapped out
 * from underneath it, for this page's context only.
 *
 * Must be called *before* `editorPage.goto()` (an addInitScript only takes
 * effect starting with the next navigation).
 */
export async function installFakeDirectoryPicker(page: Page): Promise<void> {
  await page.addInitScript((rootDirName: string) => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker =
      async () => {
        const opfsRoot = await navigator.storage.getDirectory();
        return opfsRoot.getDirectoryHandle(rootDirName, { create: true });
      };
  }, OPFS_ROOT_DIR_NAME);
}

/**
 * Builds real nested folders/files under the same dedicated OPFS
 * subdirectory `installFakeDirectoryPicker`'s fake resolves to, so opening
 * the folder in the app shows exactly this seeded tree as its immediate
 * (and nested) contents.
 */
export async function seedOpfsFixtureTree(page: Page, tree: OpfsTreeNode): Promise<void> {
  await page.evaluate(
    async ({ rootDirName, tree }: { rootDirName: string; tree: OpfsTreeNode }) => {
      async function writeNode(dirHandle: FileSystemDirectoryHandle, node: OpfsTreeNode): Promise<void> {
        for (const [name, value] of Object.entries(node)) {
          if (typeof value === 'string') {
            const fileHandle = await dirHandle.getFileHandle(name, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(value);
            await writable.close();
          } else {
            const childDir = await dirHandle.getDirectoryHandle(name, { create: true });
            await writeNode(childDir, value);
          }
        }
      }

      const opfsRoot = await navigator.storage.getDirectory();
      const rootDir = await opfsRoot.getDirectoryHandle(rootDirName, { create: true });
      await writeNode(rootDir, tree);
    },
    { rootDirName: OPFS_ROOT_DIR_NAME, tree },
  );
}

/**
 * For auto-reopen tests specifically: seeds an OPFS directory handle
 * directly into the SAME IndexedDB database/store/key
 * ('trellis.explorerFs.v1'/'rootHandle'/'current') the app itself writes to
 * via FileSystemAccessService.saveRootHandle -- entirely bypassing
 * pickDirectory()/showDirectoryPicker(), so the app's auto-reopen-on-load
 * code path (loadRootHandle -> queryPermission -> populate) is exercised
 * for real on the next navigation/reload.
 */
export async function seedIndexedDbRootHandle(page: Page): Promise<void> {
  await page.evaluate(
    async ({
      rootDirName,
      dbName,
      storeName,
      recordKey,
    }: {
      rootDirName: string;
      dbName: string;
      storeName: string;
      recordKey: string;
    }) => {
      const opfsRoot = await navigator.storage.getDirectory();
      const rootDir = await opfsRoot.getDirectoryHandle(rootDirName, { create: true });

      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = () => {
          request.result.createObjectStore(storeName);
        };
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(storeName, 'readwrite');
          transaction.objectStore(storeName).put(rootDir, recordKey);
          transaction.oncomplete = () => {
            db.close();
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        };
        request.onerror = () => reject(request.error);
      });
    },
    {
      rootDirName: OPFS_ROOT_DIR_NAME,
      dbName: INDEXED_DB_NAME,
      storeName: INDEXED_DB_STORE_NAME,
      recordKey: INDEXED_DB_RECORD_KEY,
    },
  );
}

/**
 * Reads a file's current contents directly back out of OPFS (under the same
 * dedicated root directory the fake picker/seeding helpers above use),
 * bypassing the app entirely -- used to prove a disk write actually
 * happened, rather than merely an in-memory editor change.
 *
 * `relativePath` is a '/'-separated path under the OPFS root dir, e.g.
 * 'docs/architecture.puml'.
 *
 * Retries internally (bounded, short-lived) on Chromium's transient
 * NotReadableError, which OPFS can throw for a brief moment while the app's
 * own in-flight `createWritable()`/`write()`/`close()` sequence (kicked off
 * fire-and-forget from a click/keydown handler, with no observable
 * "save finished" signal in the DOM) still holds the file locked -- this is
 * a real, occasionally-reproducible race between this helper and the app's
 * own write, not a sign the write failed. Retrying here (rather than at each
 * call site) matters because callers typically pass this straight into
 * `expect.poll(...)`, whose polling loop only retries a *failed match*, not
 * a *thrown/rejected* poll callback (see playwright's invokePollMatcher) --
 * an unretried throw here would abort the whole poll on the very first
 * attempt instead of waiting the write out.
 */
export async function readOpfsFile(page: Page, relativePath: string): Promise<string> {
  return page.evaluate(
    async ({ rootDirName, relativePath }: { rootDirName: string; relativePath: string }) => {
      const opfsRoot = await navigator.storage.getDirectory();
      let dir = await opfsRoot.getDirectoryHandle(rootDirName, { create: true });
      const segments = relativePath.split('/').filter(Boolean);
      const fileName = segments.pop();
      if (!fileName) {
        throw new Error(`readOpfsFile: relativePath "${relativePath}" has no file name segment.`);
      }
      for (const segment of segments) {
        dir = await dir.getDirectoryHandle(segment);
      }

      const maxAttempts = 20;
      const retryDelayMs = 50;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const fileHandle = await dir.getFileHandle(fileName);
          const file = await fileHandle.getFile();
          return await file.text();
        } catch (error) {
          const isLastAttempt = attempt === maxAttempts;
          const isTransientLockError = error instanceof DOMException && error.name === 'NotReadableError';
          if (isLastAttempt || !isTransientLockError) {
            throw error;
          }
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
      // Unreachable -- the loop above always either returns or throws.
      throw new Error('readOpfsFile: exhausted retries without returning or throwing.');
    },
    { rootDirName: OPFS_ROOT_DIR_NAME, relativePath },
  );
}
