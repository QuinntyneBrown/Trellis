import { Injectable } from '@angular/core';

const STORAGE_KEY = 'trellis.editorLayout.v1';
const DEFAULT_EDITOR_PANE_RATIO = 0.5;

interface StoredEditorLayout {
  editorPaneRatio: number;
}

/**
 * Persists the editor/preview pane split ratio across sessions via
 * localStorage.
 *
 * Deliberately does NOT know about MIN_EDITOR_PANE_RATIO/MAX_EDITOR_PANE_RATIO
 * -- those are UX-level bounds owned by the resize-divider/editor-page
 * layer, applied via clampRatio when seeding the editor page's ratio signal
 * from getEditorPaneRatio(). This service only knows the much looser
 * structural invariant "a ratio is a finite number strictly between 0 and 1",
 * and falls back to the default for anything else (missing key, corrupt
 * JSON, or an out-of-range value).
 *
 * Every localStorage access is wrapped in try/catch: private-browsing modes
 * (and storage-quota exhaustion) can make getItem/setItem throw, and that
 * must never escape this service and break the editor.
 */
@Injectable({
  providedIn: 'root',
})
export class EditorLayoutPreferencesService {
  getEditorPaneRatio(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return DEFAULT_EDITOR_PANE_RATIO;
      }

      const parsed = JSON.parse(raw) as Partial<StoredEditorLayout> | null;
      const ratio = parsed?.editorPaneRatio;
      if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
        return DEFAULT_EDITOR_PANE_RATIO;
      }

      return ratio;
    } catch {
      return DEFAULT_EDITOR_PANE_RATIO;
    }
  }

  setEditorPaneRatio(ratio: number): void {
    try {
      const stored: StoredEditorLayout = { editorPaneRatio: ratio };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      // Swallowed deliberately -- see class doc. A failed persist should
      // never surface to the caller; the layout simply won't survive a
      // reload this time.
    }
  }
}
