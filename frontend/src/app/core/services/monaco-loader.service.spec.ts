import { MonacoLoaderService } from './monaco-loader.service';

describe('MonacoLoaderService', () => {
  let service: MonacoLoaderService;

  beforeEach(() => {
    service = new MonacoLoaderService();
    document.getElementById('monaco-amd-loader')?.remove();
    delete (window as unknown as Record<string, unknown>)['monaco'];
    delete (window as unknown as Record<string, unknown>)['require'];
    delete (window as unknown as Record<string, unknown>)['MonacoEnvironment'];
  });

  afterEach(() => {
    document.getElementById('monaco-amd-loader')?.remove();
  });

  it('injects a single script tag pointing at the copied monaco assets', () => {
    void service.load();

    const scripts = document.querySelectorAll('#monaco-amd-loader');
    expect(scripts.length).toBe(1);
    expect((scripts[0] as HTMLScriptElement).src).toContain('assets/monaco/vs/loader.js');
  });

  it('configures the AMD loader and resolves with the monaco namespace once vs/editor/editor.main loads', async () => {
    const fakeMonaco = { editor: { create: jest.fn() } } as unknown as Record<string, unknown>;

    const requireFn = jest.fn((_deps: string[], onLoad: () => void) => {
      (window as unknown as Record<string, unknown>)['monaco'] = fakeMonaco;
      onLoad();
    }) as unknown as { (deps: string[], onLoad: () => void): void; config: jest.Mock };
    requireFn.config = jest.fn();

    const loadPromise = service.load();

    // Simulate the AMD loader script itself finishing download.
    (window as unknown as Record<string, unknown>)['require'] = requireFn;
    const script = document.getElementById('monaco-amd-loader') as HTMLScriptElement;
    script.onload?.(new Event('load'));

    const resolved = await loadPromise;

    expect(requireFn.config).toHaveBeenCalledWith({ paths: { vs: 'assets/monaco/vs' } });
    expect(requireFn).toHaveBeenCalledWith(['vs/editor/editor.main'], expect.any(Function), expect.any(Function));
    expect(resolved).toBe(fakeMonaco);
  });

  it('caches the loading promise so a second call does not inject another script tag', () => {
    const requireFn = jest.fn() as unknown as { (deps: string[], onLoad: () => void): void; config: jest.Mock };
    requireFn.config = jest.fn();
    (window as unknown as Record<string, unknown>)['require'] = requireFn;

    const first = service.load();
    const second = service.load();

    expect(first).toBe(second);
    expect(document.querySelectorAll('#monaco-amd-loader').length).toBe(1);
  });

  it('resolves immediately when monaco is already present on window', async () => {
    const fakeMonaco = { editor: { create: jest.fn() } } as unknown as Record<string, unknown>;
    (window as unknown as Record<string, unknown>)['monaco'] = fakeMonaco;

    const resolved = await service.load();

    expect(resolved).toBe(fakeMonaco);
    expect(document.getElementById('monaco-amd-loader')).toBeNull();
  });
});
