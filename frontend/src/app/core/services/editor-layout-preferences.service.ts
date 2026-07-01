import { Injectable } from '@angular/core';

const STORAGE_KEY = 'trellis.editorLayout.v1';
const DEFAULT_EDITOR_PANE_RATIO = 0.5;
const DEFAULT_SIDE_PANEL_WIDTH_PX = 260;

interface StoredEditorLayout {
  editorPaneRatio: number;
  /**
   * Additive field: older stored blobs (from before the Explorer/Documents
   * side panel existed) simply lack this key, and getSidePanelWidthPx()
   * falls back to the default for them exactly like a corrupt/out-of-range
   * value -- no STORAGE_KEY version bump needed for this to stay backward
   * compatible.
   */
  sidePanelWidthPx?: number;
}

/**
 * Persists editor layout preferences (the editor/preview pane split ratio,
 * and the Explorer/Documents side panel width) across sessions via
 * localStorage, both fields sharing the one STORAGE_KEY JSON blob.
 *
 * Deliberately does NOT know about MIN_EDITOR_PANE_RATIO/MAX_EDITOR_PANE_RATIO
 * or MIN/MAX_SIDE_PANEL_WIDTH_PX -- those are UX-level bounds owned by the
 * resize-divider/editor-page layer, applied via clampRatio/clampWidthPx when
 * seeding the editor page's signals from this service's getters. This
 * service only knows much looser structural invariants ("a ratio is a
 * finite number strictly between 0 and 1", "a width is a finite number
 * greater than 0"), and falls back to the relevant default for anything
 * else (missing key, corrupt JSON, or an out-of-range value).
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
    const ratio = this.readStored()?.editorPaneRatio;
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0 || ratio >= 1) {
      return DEFAULT_EDITOR_PANE_RATIO;
    }
    return ratio;
  }

  setEditorPaneRatio(ratio: number): void {
    this.writeStored({ editorPaneRatio: ratio });
  }

  getSidePanelWidthPx(): number {
    const widthPx = this.readStored()?.sidePanelWidthPx;
    if (typeof widthPx !== 'number' || !Number.isFinite(widthPx) || widthPx <= 0) {
      return DEFAULT_SIDE_PANEL_WIDTH_PX;
    }
    return widthPx;
  }

  setSidePanelWidthPx(px: number): void {
    this.writeStored({ sidePanelWidthPx: px });
  }

  /** Reads and JSON-parses the shared stored blob, or null on a missing key/read failure/corrupt JSON. */
  private readStored(): Partial<StoredEditorLayout> | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) {
        return null;
      }
      return JSON.parse(raw) as Partial<StoredEditorLayout> | null;
    } catch {
      return null;
    }
  }

  /**
   * Merges `patch` into whatever is currently stored (so setting one field
   * never clobbers the other already-persisted field) and writes the result
   * back. Falls back to writing just `patch` alone if the existing blob
   * can't be read back (corrupt JSON, storage read failure) -- there is
   * nothing trustworthy to merge with in that case.
   */
  private writeStored(patch: Partial<StoredEditorLayout>): void {
    try {
      const existing = this.readStored() ?? {};
      const merged: Partial<StoredEditorLayout> = { ...existing, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch {
      // Swallowed deliberately -- see class doc. A failed persist should
      // never surface to the caller; the layout simply won't survive a
      // reload this time.
    }
  }
}
