import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenderResult } from '../../../core/models/render-result.model';
import { ClipboardService } from '../../../core/services/clipboard.service';
import { FileDownloadService } from '../../../core/services/file-download.service';
import { ImageExportService } from '../../../core/services/image-export.service';
import { DiagramPreviewComponent } from './diagram-preview.component';

describe('DiagramPreviewComponent', () => {
  let fixture: ComponentFixture<DiagramPreviewComponent>;
  let component: DiagramPreviewComponent;
  let clipboardServiceMock: { copyPng: jest.Mock };
  let imageExportServiceMock: { svgToPngBlob: jest.Mock };
  let fileDownloadServiceMock: { downloadBlob: jest.Mock };

  beforeEach(async () => {
    clipboardServiceMock = { copyPng: jest.fn().mockResolvedValue(undefined) };
    imageExportServiceMock = { svgToPngBlob: jest.fn().mockResolvedValue(new Blob()) };
    fileDownloadServiceMock = { downloadBlob: jest.fn() };

    await TestBed.configureTestingModule({
      imports: [DiagramPreviewComponent],
      providers: [
        { provide: ClipboardService, useValue: clipboardServiceMock },
        { provide: ImageExportService, useValue: imageExportServiceMock },
        { provide: FileDownloadService, useValue: fileDownloadServiceMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramPreviewComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function applyResult(result: RenderResult | null, previous: RenderResult | null = null): void {
    component.result = result;
    component.ngOnChanges({ result: new SimpleChange(previous, result, previous === undefined) });
    fixture.detectChanges();
  }

  it('shows the placeholder with seq 0 before any render has happened', () => {
    fixture.detectChanges();

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('0');
    expect(fixture.nativeElement.querySelector('[data-testid="preview-placeholder"]')).toBeTruthy();
  });

  it('increments the seq counter and renders svg on a successful result', () => {
    fixture.detectChanges();

    const result: RenderResult = { isSuccess: true, svg: '<svg><circle /></svg>', html: null, errorMessage: null };
    applyResult(result, null);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
    expect(fixture.nativeElement.querySelector('[data-testid="preview-placeholder"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="preview-error"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.diagram-preview__svg svg')).toBeTruthy();
  });

  it('increments the seq counter and shows the error banner on a failed result', () => {
    fixture.detectChanges();

    const result: RenderResult = { isSuccess: false, svg: null, html: null, errorMessage: 'Syntax error at line 3' };
    applyResult(result, null);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
    const errorEl: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-error"]');
    expect(errorEl.textContent).toContain('Syntax error at line 3');
  });

  it('increments by exactly one per new result, across multiple renders', () => {
    fixture.detectChanges();

    const first: RenderResult = { isSuccess: true, svg: '<svg></svg>', html: null, errorMessage: null };
    applyResult(first, null);

    const second: RenderResult = { isSuccess: false, svg: null, html: null, errorMessage: 'bad' };
    applyResult(second, first);

    const third: RenderResult = { isSuccess: true, svg: '<svg><rect /></svg>', html: null, errorMessage: null };
    applyResult(third, second);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('3');
  });

  it('does not increment when the same result reference is reapplied', () => {
    fixture.detectChanges();

    const result: RenderResult = { isSuccess: true, svg: '<svg></svg>', html: null, errorMessage: null };
    applyResult(result, null);
    applyResult(result, result);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
  });

  it('renders a markdown result as prose in the preview-markdown branch', () => {
    fixture.detectChanges();

    applyResult({ isSuccess: true, svg: null, html: '<h1>Hello</h1><p>prose</p>', errorMessage: null }, null);
    fixture.detectChanges();

    const markdown: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-markdown"]');
    expect(markdown).toBeTruthy();
    expect(markdown.querySelector('h1')?.textContent).toBe('Hello');
    // The svg branch stays absent for a markdown result.
    expect(fixture.nativeElement.querySelector('.diagram-preview__svg')).toBeNull();
  });

  it('renders an svg result without the markdown branch', () => {
    fixture.detectChanges();

    applyResult({ isSuccess: true, svg: '<svg></svg>', html: null, errorMessage: null }, null);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.diagram-preview__svg')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="preview-markdown"]')).toBeNull();
  });

  it('clears the markdown branch when a failure follows a markdown success', () => {
    fixture.detectChanges();

    const success: RenderResult = { isSuccess: true, svg: null, html: '<h1>ok</h1>', errorMessage: null };
    applyResult(success, null);
    fixture.detectChanges();

    applyResult({ isSuccess: false, svg: null, html: null, errorMessage: 'boom' }, success);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="preview-markdown"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="preview-error"]')).toBeTruthy();
  });

  it('does not increment on mere isRendering changes', () => {
    fixture.detectChanges();

    component.isRendering = true;
    component.ngOnChanges({});
    fixture.detectChanges();

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('0');
  });

  describe('image actions overlay', () => {
    const svgResult: RenderResult = {
      isSuccess: true,
      svg: '<svg width="130px" height="120px"></svg>',
      html: null,
      errorMessage: null,
    };

    function overlay(): HTMLElement | null {
      return fixture.nativeElement.querySelector('[data-testid="preview-image-actions"]');
    }

    function byTestId(testId: string): HTMLElement | null {
      return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
    }

    /** Drains the copy/download promise chains -- they resolve in microtasks, never timers. */
    async function flushMicrotasks(): Promise<void> {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }

    it('shows the overlay only for successful svg renders', () => {
      fixture.detectChanges();
      expect(overlay()).toBeNull(); // placeholder

      applyResult(svgResult, null);
      expect(overlay()).toBeTruthy();

      const markdown: RenderResult = { isSuccess: true, svg: null, html: '<h1>md</h1>', errorMessage: null };
      applyResult(markdown, svgResult);
      expect(overlay()).toBeNull();

      const failure: RenderResult = { isSuccess: false, svg: null, html: null, errorMessage: 'boom' };
      applyResult(failure, markdown);
      expect(overlay()).toBeNull();
    });

    it('hides the overlay while a re-render is in flight, freeing the corner for the spinner', () => {
      fixture.detectChanges();
      applyResult(svgResult, null);
      expect(overlay()).toBeTruthy();

      component.isRendering = true;
      fixture.detectChanges();

      expect(overlay()).toBeNull();
    });

    it('hands the pending PNG promise to the clipboard and flashes the check glyph for 1.5s', async () => {
      fixture.detectChanges();
      applyResult(svgResult, null);
      jest.useFakeTimers();

      const pendingPng = Promise.resolve(new Blob(['fake-png'], { type: 'image/png' }));
      imageExportServiceMock.svgToPngBlob.mockReturnValue(pendingPng);

      (byTestId('preview-copy-image') as HTMLButtonElement).click();

      expect(imageExportServiceMock.svgToPngBlob).toHaveBeenCalledWith(svgResult.svg);
      // The un-awaited promise itself is what copyPng receives -- the
      // ClipboardItem must be built synchronously within the click gesture.
      expect(clipboardServiceMock.copyPng).toHaveBeenCalledWith(pendingPng);

      await flushMicrotasks();
      fixture.detectChanges();
      // check glyph = one path; copy glyph = two.
      expect(fixture.nativeElement.querySelectorAll('[data-testid="preview-copy-image"] path')).toHaveLength(1);

      jest.advanceTimersByTime(1500);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('[data-testid="preview-copy-image"] path')).toHaveLength(2);
    });

    it('emits exportError when the clipboard copy fails', async () => {
      fixture.detectChanges();
      applyResult(svgResult, null);
      clipboardServiceMock.copyPng.mockRejectedValue(new Error('denied'));
      const errors: string[] = [];
      component.exportError.subscribe((message) => errors.push(message));

      (byTestId('preview-copy-image') as HTMLButtonElement).click();
      await flushMicrotasks();

      expect(errors).toEqual(['Could not copy the diagram image to the clipboard.']);
    });

    it('downloads the PNG under a file name derived from the document name', async () => {
      fixture.detectChanges();
      component.documentName = 'order-flow.puml';
      applyResult(svgResult, null);
      const png = new Blob(['fake-png'], { type: 'image/png' });
      imageExportServiceMock.svgToPngBlob.mockResolvedValue(png);

      (byTestId('preview-download-image') as HTMLButtonElement).click();
      await flushMicrotasks();

      expect(fileDownloadServiceMock.downloadBlob).toHaveBeenCalledWith('order-flow.png', png);
    });

    it('emits exportError when rasterization fails during download', async () => {
      fixture.detectChanges();
      applyResult(svgResult, null);
      imageExportServiceMock.svgToPngBlob.mockRejectedValue(new Error('boom'));
      const errors: string[] = [];
      component.exportError.subscribe((message) => errors.push(message));

      (byTestId('preview-download-image') as HTMLButtonElement).click();
      await flushMicrotasks();

      expect(errors).toEqual(['Could not export the diagram as a PNG.']);
      expect(fileDownloadServiceMock.downloadBlob).not.toHaveBeenCalled();
    });
  });
});
