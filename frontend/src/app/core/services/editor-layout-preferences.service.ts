import { Injectable } from '@angular/core';

const STORAGE_KEY = 'trellis.editorLayout.v1';

interface StoredEditorLayout {
  editorPaneRatio: number;
  /**
   * Additive field: older stored blobs (from before the Explorer/Documents
   * side panel existed) simply lack this key and read back as null -- no
   * STORAGE_KEY version bump needed for this to stay backward compatible.
   */
  sidePanelWidthPx?: number;
}

/**
 * Persists editor layout preferences (the editor/preview pane split ratio,
 * and the Explorer/Documents side panel width) across sessions via
 * localStorage, both fields sharing the one STORAGE_KEY JSON blob.
 *
 * Deliberately dumb storage: getters return the stored number or null
 * (missing key, corrupt JSON, or a non-finite value from a hand-edited
 * blob). Defaults and UX-level min/max bounds are owned by the editor page,
 * which seeds its signals with clamp(stored ?? DEFAULT, MIN, MAX).
 *
 * Every localStorage access is wrapped in try/catch: private-browsing modes
 * (and storage-quota exhaustion) can make getItem/setItem throw, and that
 * must never escape this service and break the editor.
 */
@Injectable({
  providedIn: 'root',
})
export class EditorLayoutPreferencesService {
  getEditorPaneRatio(): number | null {
    return asFiniteNumber(this.readStored()?.editorPaneRatio);
  }

  setEditorPaneRatio(ratio: number): void {
    this.writeStored({ editorPaneRatio: ratio });
  }

  getSidePanelWidthPx(): number | null {
    return asFiniteNumber(this.readStored()?.sidePanelWidthPx);
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

/** Guards against NaN/Infinity/strings from a hand-edited localStorage blob. */
function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
