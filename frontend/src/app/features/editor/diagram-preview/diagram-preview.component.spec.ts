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

    const result: RenderResult = { isSuccess: true, svg: '<svg><circle /></svg>', errorMessage: null };
    applyResult(result, null);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
    expect(fixture.nativeElement.querySelector('[data-testid="preview-placeholder"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="preview-error"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.diagram-preview__svg svg')).toBeTruthy();
  });

  it('increments the seq counter and shows the error banner on a failed result', () => {
    fixture.detectChanges();

    const result: RenderResult = { isSuccess: false, svg: null, errorMessage: 'Syntax error at line 3' };
    applyResult(result, null);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
    const errorEl: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-error"]');
    expect(errorEl.textContent).toContain('Syntax error at line 3');
  });

  it('increments by exactly one per new result, across multiple renders', () => {
    fixture.detectChanges();

    const first: RenderResult = { isSuccess: true, svg: '<svg></svg>', errorMessage: null };
    applyResult(first, null);

    const second: RenderResult = { isSuccess: false, svg: null, errorMessage: 'bad' };
    applyResult(second, first);

    const third: RenderResult = { isSuccess: true, svg: '<svg><rect /></svg>', errorMessage: null };
    applyResult(third, second);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('3');
  });

  it('does not increment when the same result reference is reapplied', () => {
    fixture.detectChanges();

    const result: RenderResult = { isSuccess: true, svg: '<svg></svg>', errorMessage: null };
    applyResult(result, null);
    applyResult(result, result);

    const pane: HTMLElement = fixture.nativeElement.querySelector('[data-testid="preview-pane"]');
    expect(pane.getAttribute('data-render-seq')).toBe('1');
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
