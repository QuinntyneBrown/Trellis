import { ExplainCollectionError, collectExplainFiles, isExplainableFile } from './collect-explain-files';

/**
 * Minimal stand-ins for File System Access handles: collectExplainFiles only
 * touches kind/name/values()/getFile(), so plain objects suffice (jsdom has
 * no FileSystemDirectoryHandle at all).
 */
interface FakeFileHandle {
  kind: 'file';
  name: string;
  getFile: () => Promise<{ size: number; text: () => Promise<string> }>;
}

interface FakeDirectoryHandle {
  kind: 'directory';
  name: string;
  values: () => AsyncGenerator<FakeFileHandle | FakeDirectoryHandle>;
}

function fakeFile(name: string, content: string, sizeOverride?: number): FakeFileHandle {
  return {
    kind: 'file',
    name,
    getFile: () => Promise.resolve({ size: sizeOverride ?? content.length, text: () => Promise.resolve(content) }),
  };
}

function fakeDir(name: string, children: (FakeFileHandle | FakeDirectoryHandle)[]): FakeDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const child of children) {
        yield child;
      }
    },
  };
}

function collect(dir: FakeDirectoryHandle): ReturnType<typeof collectExplainFiles> {
  return collectExplainFiles(dir as unknown as FileSystemDirectoryHandle);
}

describe('isExplainableFile', () => {
  it.each(['main.ts', 'page.html', 'app.scss', 'site.css', 'Program.cs', 'a.csproj', 'a.sln', 'cfg.json', 'ci.yaml', 'ci.yml', 'README.md', 'flow.puml'])(
    'accepts %s',
    (name) => {
      expect(isExplainableFile(name)).toBe(true);
    },
  );

  it.each(['photo.png', 'archive.zip', 'binary.exe', 'noextension', 'script.js'])('rejects %s', (name) => {
    expect(isExplainableFile(name)).toBe(false);
  });

  it('matches extensions case-insensitively', () => {
    expect(isExplainableFile('README.MD')).toBe(true);
  });
});

describe('collectExplainFiles', () => {
  it('collects allowed files recursively with forward-slash paths relative to the picked folder', async () => {
    const dir = fakeDir('repo', [
      fakeFile('README.md', '# readme'),
      fakeDir('src', [fakeFile('main.ts', 'const x = 1;'), fakeDir('diagrams', [fakeFile('flow.puml', '@startuml')])]),
    ]);

    const entries = await collect(dir);

    expect(entries).toEqual([
      { path: 'README.md', content: '# readme' },
      { path: 'src/main.ts', content: 'const x = 1;' },
      { path: 'src/diagrams/flow.puml', content: '@startuml' },
    ]);
  });

  it('skips excluded folders and files with disallowed extensions', async () => {
    const dir = fakeDir('repo', [
      fakeDir('node_modules', [fakeFile('index.ts', 'never read')]),
      fakeDir('dist', [fakeFile('bundle.css', 'never read')]),
      fakeDir('bin', [fakeFile('a.cs', 'never read')]),
      fakeDir('obj', [fakeFile('b.cs', 'never read')]),
      fakeDir('.git', [fakeFile('config.json', 'never read')]),
      fakeFile('photo.png', 'binary'),
      fakeFile('app.ts', 'kept'),
    ]);

    const entries = await collect(dir);

    expect(entries).toEqual([{ path: 'app.ts', content: 'kept' }]);
  });

  it('matches excluded folder names case-insensitively', async () => {
    const dir = fakeDir('repo', [fakeDir('NODE_MODULES', [fakeFile('index.ts', 'never read')])]);

    await expect(collect(dir)).resolves.toEqual([]);
  });

  it('throws ExplainCollectionError when the file-count cap is exceeded', async () => {
    const files = Array.from({ length: 2001 }, (_, i) => fakeFile(`f${i}.ts`, 'x'));
    const dir = fakeDir('repo', files);

    await expect(collect(dir)).rejects.toThrow(ExplainCollectionError);
  });

  it('throws ExplainCollectionError when the total-size cap is exceeded', async () => {
    const dir = fakeDir('repo', [fakeFile('huge.md', 'tiny stand-in body', 21 * 1024 * 1024)]);

    await expect(collect(dir)).rejects.toThrow(ExplainCollectionError);
  });
});
