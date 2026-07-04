import { TestBed } from '@angular/core/testing';

import { EditorLayoutPreferencesService } from './editor-layout-preferences.service';

const STORAGE_KEY = 'trellis.editorLayout.v1';

describe('EditorLayoutPreferencesService', () => {
  let service: EditorLayoutPreferencesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(EditorLayoutPreferencesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns null when no ratio has ever been stored', () => {
    expect(service.getEditorPaneRatio()).toBeNull();
  });

  it('round-trips a ratio set then read back', () => {
    service.setEditorPaneRatio(0.35);

    expect(service.getEditorPaneRatio()).toBe(0.35);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ editorPaneRatio: 0.35 });
  });

  it('returns null when the stored value is corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    expect(service.getEditorPaneRatio()).toBeNull();
  });

  it('returns null when the stored shape has a non-numeric or non-finite ratio', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: 'half' }));
    expect(service.getEditorPaneRatio()).toBeNull();

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: null }));
    expect(service.getEditorPaneRatio()).toBeNull();
  });

  it('returns null when the stored value is valid JSON but not the expected shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(service.getEditorPaneRatio()).toBeNull();
  });

  it('does NOT apply any UX-level bounds -- an out-of-range stored number is returned as-is for the page to clamp', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: 1.5 }));
    expect(service.getEditorPaneRatio()).toBe(1.5);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidePanelWidthPx: -50 }));
    expect(service.getSidePanelWidthPx()).toBe(-50);
  });

  it('never throws out of setEditorPaneRatio when the underlying storage write fails', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => service.setEditorPaneRatio(0.6)).not.toThrow();
  });

  it('never throws out of getEditorPaneRatio when the underlying storage read fails', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => service.getEditorPaneRatio()).not.toThrow();
    expect(service.getEditorPaneRatio()).toBeNull();
  });

  describe('side panel width (additive field on the same stored blob)', () => {
    it('returns null when no width has ever been stored', () => {
      expect(service.getSidePanelWidthPx()).toBeNull();
    });

    it('round-trips a width set then read back', () => {
      service.setSidePanelWidthPx(320);

      expect(service.getSidePanelWidthPx()).toBe(320);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ sidePanelWidthPx: 320 });
    });

    it('returns null when the stored width is not a finite number', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidePanelWidthPx: 'wide' }));
      expect(service.getSidePanelWidthPx()).toBeNull();
    });

    it('never throws out of setSidePanelWidthPx when the underlying storage write fails', () => {
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => service.setSidePanelWidthPx(300)).not.toThrow();
    });

    it('never throws out of getSidePanelWidthPx when the underlying storage read fails', () => {
      jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => service.getSidePanelWidthPx()).not.toThrow();
      expect(service.getSidePanelWidthPx()).toBeNull();
    });

    it('round-trips the active side panel, including an explicit null for a deliberately closed panel', () => {
      expect(service.getActiveSidePanel()).toBeNull();

      service.setActiveSidePanel('documents');
      expect(service.getActiveSidePanel()).toBe('documents');

      service.setActiveSidePanel('explorer');
      expect(service.getActiveSidePanel()).toBe('explorer');

      service.setActiveSidePanel('templates');
      expect(service.getActiveSidePanel()).toBe('templates');

      service.setActiveSidePanel(null);
      expect(service.getActiveSidePanel()).toBeNull();
      // Stored as an explicit null (not just absent) so "user closed the panel" survives a reload too.
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ activeSidePanel: null });
    });

    it('returns null for a corrupt persisted side panel value', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeSidePanel: 'kitchen-sink' }));
      expect(service.getActiveSidePanel()).toBeNull();
    });

    it('setting the active side panel does not clobber the other persisted layout fields', () => {
      service.setSidePanelWidthPx(300);
      service.setActiveSidePanel('documents');

      expect(service.getSidePanelWidthPx()).toBe(300);
      expect(service.getActiveSidePanel()).toBe('documents');
    });

    it('round-trips the Documents scope folder id, including an explicit null for a cleared scope', () => {
      expect(service.getDocumentsScopeFolderId()).toBeNull();

      service.setDocumentsScopeFolderId('folder-42');
      expect(service.getDocumentsScopeFolderId()).toBe('folder-42');

      service.setDocumentsScopeFolderId(null);
      expect(service.getDocumentsScopeFolderId()).toBeNull();
      // Stored as an explicit null (not just absent) so "user cleared the scope" survives a reload too.
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ documentsScopeFolderId: null });
    });

    it('returns null for a corrupt persisted scope folder id', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ documentsScopeFolderId: 42 }));
      expect(service.getDocumentsScopeFolderId()).toBeNull();
    });

    it('setting the scope folder id does not clobber the other persisted layout fields', () => {
      service.setSidePanelWidthPx(300);
      service.setDocumentsScopeFolderId('folder-42');

      expect(service.getSidePanelWidthPx()).toBe(300);
      expect(service.getDocumentsScopeFolderId()).toBe('folder-42');
    });

    it('setting the editor pane ratio does not clobber a previously persisted side panel width, and vice versa', () => {
      service.setSidePanelWidthPx(300);
      service.setEditorPaneRatio(0.35);

      expect(service.getSidePanelWidthPx()).toBe(300);
      expect(service.getEditorPaneRatio()).toBe(0.35);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
        sidePanelWidthPx: 300,
        editorPaneRatio: 0.35,
      });

      service.setSidePanelWidthPx(400);

      expect(service.getEditorPaneRatio()).toBe(0.35);
      expect(service.getSidePanelWidthPx()).toBe(400);
    });
  });
});
