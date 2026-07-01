import { Injectable } from '@angular/core';
import type * as Monaco from 'monaco-editor';

declare global {
  interface Window {
    require: {
      config: (options: { paths: Record<string, string> }) => void;
      (dependencies: string[], onLoad: () => void, onError?: (error: unknown) => void): void;
    };
    monaco: typeof Monaco;
  }
}

const MONACO_BASE_PATH = 'assets/monaco/vs';
const LOADER_SCRIPT_ID = 'monaco-amd-loader';

/**
 * Loads Monaco's AMD bundle exactly once via an injected script tag, caching
 * the loading promise so multiple editor instances never trigger a second
 * download/AMD-bootstrap of the editor.
 */
@Injectable({
  providedIn: 'root',
})
export class MonacoLoaderService {
  private loadingPromise: Promise<typeof Monaco> | null = null;

  load(): Promise<typeof Monaco> {
    if (!this.loadingPromise) {
      this.loadingPromise = this.loadMonaco();
    }
    return this.loadingPromise;
  }

  private loadMonaco(): Promise<typeof Monaco> {
    if (window.monaco) {
      return Promise.resolve(window.monaco);
    }

    return new Promise<typeof Monaco>((resolve, reject) => {
      const onAmdLoaderReady = () => {
        window.MonacoEnvironment = {
          getWorkerUrl: () =>
            `data:text/javascript;charset=utf-8,${encodeURIComponent(`
              self.MonacoEnvironment = { baseUrl: '${document.baseURI}${MONACO_BASE_PATH}/' };
              importScripts('${document.baseURI}${MONACO_BASE_PATH}/base/worker/workerMain.js');
            `)}`,
        };

        window.require.config({ paths: { vs: MONACO_BASE_PATH } });
        window.require(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
      };

      const existingScript = document.getElementById(LOADER_SCRIPT_ID);
      if (existingScript) {
        existingScript.addEventListener('load', onAmdLoaderReady, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.id = LOADER_SCRIPT_ID;
      script.src = `${MONACO_BASE_PATH}/loader.js`;
      script.onload = onAmdLoaderReady;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }
}
