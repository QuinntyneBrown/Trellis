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

  it('defaults to 0.5 when no ratio has ever been stored', () => {
    expect(service.getEditorPaneRatio()).toBe(0.5);
  });

  it('round-trips a ratio set then read back', () => {
    service.setEditorPaneRatio(0.35);

    expect(service.getEditorPaneRatio()).toBe(0.35);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ editorPaneRatio: 0.35 });
  });

  it('falls back to the default when the stored value is corrupt JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    expect(service.getEditorPaneRatio()).toBe(0.5);
  });

  it('falls back to the default when the stored ratio is out of the (0, 1) range', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: 1.5 }));
    expect(service.getEditorPaneRatio()).toBe(0.5);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: 0 }));
    expect(service.getEditorPaneRatio()).toBe(0.5);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: -0.2 }));
    expect(service.getEditorPaneRatio()).toBe(0.5);
  });

  it('falls back to the default when the stored shape has a non-numeric ratio', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ editorPaneRatio: 'half' }));
    expect(service.getEditorPaneRatio()).toBe(0.5);
  });

  it('falls back to the default when the stored value is valid JSON but not the expected shape', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(service.getEditorPaneRatio()).toBe(0.5);
  });

  it('never throws out of setEditorPaneRatio when the underlying storage write fails', () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(() => service.setEditorPaneRatio(0.6)).not.toThrow();

    setItemSpy.mockRestore();
  });

  it('never throws out of getEditorPaneRatio when the underlying storage read fails', () => {
    const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });

    expect(() => service.getEditorPaneRatio()).not.toThrow();
    expect(service.getEditorPaneRatio()).toBe(0.5);

    getItemSpy.mockRestore();
  });

  describe('side panel width (additive field on the same stored blob)', () => {
    it('defaults to 260 when no width has ever been stored', () => {
      expect(service.getSidePanelWidthPx()).toBe(260);
    });

    it('round-trips a width set then read back', () => {
      service.setSidePanelWidthPx(320);

      expect(service.getSidePanelWidthPx()).toBe(320);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({ sidePanelWidthPx: 320 });
    });

    it('falls back to the default when the stored value is corrupt JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{not valid json');

      expect(service.getSidePanelWidthPx()).toBe(260);
    });

    it('falls back to the default when the stored width is not a positive finite number', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidePanelWidthPx: 0 }));
      expect(service.getSidePanelWidthPx()).toBe(260);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidePanelWidthPx: -50 }));
      expect(service.getSidePanelWidthPx()).toBe(260);

      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sidePanelWidthPx: 'wide' }));
      expect(service.getSidePanelWidthPx()).toBe(260);
    });

    it('does NOT clamp to any UX-level min/max -- an absurdly large or tiny positive width round-trips as-is', () => {
      service.setSidePanelWidthPx(5000);
      expect(service.getSidePanelWidthPx()).toBe(5000);

      service.setSidePanelWidthPx(1);
      expect(service.getSidePanelWidthPx()).toBe(1);
    });

    it('never throws out of setSidePanelWidthPx when the underlying storage write fails', () => {
      const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      expect(() => service.setSidePanelWidthPx(300)).not.toThrow();

      setItemSpy.mockRestore();
    });

    it('never throws out of getSidePanelWidthPx when the underlying storage read fails', () => {
      const getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => service.getSidePanelWidthPx()).not.toThrow();
      expect(service.getSidePanelWidthPx()).toBe(260);

      getItemSpy.mockRestore();
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
