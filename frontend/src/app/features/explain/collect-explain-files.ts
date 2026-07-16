import { ExplainFileEntry } from '../../core/models/explain-file-entry.model';

/**
 * Client-side pre-filter for local Explain This selections, mirroring the
 * backend's ExplainContentPolicy (GetFiles allowlist + .md/.puml, fixed
 * exclusions). The backend re-applies the same policy authoritatively; this
 * walk just avoids reading and uploading files that would only be discarded
 * server-side (node_modules alone would otherwise dwarf the payload).
 */
const ALLOWED_EXTENSIONS = new Set([
  '.ts',
  '.html',
  '.scss',
  '.css',
  '.cs',
  '.csproj',
  '.sln',
  '.json',
  '.yaml',
  '.yml',
  '.md',
  '.puml',
]);

const EXCLUDED_FOLDERS = new Set(['node_modules', 'dist', 'bin', 'obj', '.git']);

/**
 * Caps guard against pathological selections (a user picking their whole
 * home directory) before anything is read or posted. Generous relative to
 * the backend's 8M-char prompt cap, which remains the final arbiter.
 */
const MAX_FILES = 2000;
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

/** Thrown when a folder walk exceeds the file-count or total-size caps. */
export class ExplainCollectionError extends Error {}

function hasAllowedExtension(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot < 0) {
    return false;
  }
  return ALLOWED_EXTENSIONS.has(name.slice(dot).toLowerCase());
}

/** Whether a single picked file would be included by the aggregation policy. */
export function isExplainableFile(name: string): boolean {
  return hasAllowedExtension(name);
}

/**
 * Recursively walks `directory`, returning path+content entries (paths
 * forward-slash-separated, relative to the picked folder) for every file
 * the aggregation policy accepts. Deterministic order is left to the
 * backend, which sorts entries itself.
 */
export async function collectExplainFiles(directory: FileSystemDirectoryHandle): Promise<ExplainFileEntry[]> {
  const entries: ExplainFileEntry[] = [];
  let totalBytes = 0;

  const walk = async (dir: FileSystemDirectoryHandle, prefix: string): Promise<void> => {
    for await (const handle of dir.values()) {
      if (handle.kind === 'directory') {
        if (!EXCLUDED_FOLDERS.has(handle.name.toLowerCase())) {
          await walk(handle, `${prefix}${handle.name}/`);
        }
        continue;
      }
      if (!hasAllowedExtension(handle.name)) {
        continue;
      }
      if (entries.length >= MAX_FILES) {
        throw new ExplainCollectionError(
          `The selected folder contains more than ${MAX_FILES} matching files. Pick a smaller folder.`,
        );
      }
      const file = await handle.getFile();
      totalBytes += file.size;
      if (totalBytes > MAX_TOTAL_BYTES) {
        throw new ExplainCollectionError(
          'The selected folder\'s matching files exceed 20 MB. Pick a smaller folder.',
        );
      }
      entries.push({ path: `${prefix}${handle.name}`, content: await file.text() });
    }
  };

  await walk(directory, '');
  return entries;
}
