import { SimpleChange } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RenderResult } from '../../../core/models/render-result.model';
import { DiagramPreviewComponent } from './diagram-preview.component';

describe('DiagramPreviewComponent', () => {
  let fixture: ComponentFixture<DiagramPreviewComponent>;
  let component: DiagramPreviewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DiagramPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(DiagramPreviewComponent);
    component = fixture.componentInstance;
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
});
