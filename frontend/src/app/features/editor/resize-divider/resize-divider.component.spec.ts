import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  DEFAULT_EDITOR_PANE_RATIO,
  MAX_EDITOR_PANE_RATIO,
  MIN_EDITOR_PANE_RATIO,
} from '../editor-pane-ratio.constants';
import { ResizeDividerComponent } from './resize-divider.component';

/**
 * Fabricates a minimal event-like object rather than a real PointerEvent:
 * jsdom does not meaningfully emulate setPointerCapture's real capture/
 * redirect semantics, so tests call the component's handler methods
 * directly instead of relying on jsdom to actually redirect events.
 */
function fakePointerEvent(clientX: number, pointerId = 1): PointerEvent {
  return {
    clientX,
    pointerId,
    target: {
      setPointerCapture: jest.fn(),
      releasePointerCapture: jest.fn(),
    },
  } as unknown as PointerEvent;
}

describe('ResizeDividerComponent', () => {
  let fixture: ComponentFixture<ResizeDividerComponent>;
  let component: ResizeDividerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResizeDividerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ResizeDividerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // onPointerDown adds this class straight to the real document.body; a
    // test that asserts a drag started (without also completing/cancelling
    // it) must not leak that class into later tests.
    document.body.classList.remove('is-resizing-panes');
  });

  function byTestId(testId: string): HTMLElement {
    return fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  }

  /** Stubs the divider's container (its parentElement) to a fixed width. */
  function stubContainerWidth(width: number): void {
    const hostEl = fixture.nativeElement as HTMLElement;
    jest.spyOn(hostEl.parentElement as HTMLElement, 'getBoundingClientRect').mockReturnValue({
      width,
    } as DOMRect);
  }

  it('renders the root separator with ARIA attributes derived from its inputs', () => {
    component.ratio = 0.3;
    component.minRatio = 0.2;
    component.maxRatio = 0.8;
    fixture.detectChanges();

    const root = byTestId('resize-divider');
    expect(root.getAttribute('role')).toBe('separator');
    expect(root.getAttribute('aria-orientation')).toBe('vertical');
    expect(root.getAttribute('tabindex')).toBe('0');
    expect(root.getAttribute('aria-valuenow')).toBe('30');
    expect(root.getAttribute('aria-valuemin')).toBe('20');
    expect(root.getAttribute('aria-valuemax')).toBe('80');
    expect(root.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not emit anything on pointermove before any pointerdown has occurred', () => {
    stubContainerWidth(1000);
    const ratioChangeSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);

    component.onPointerMove(fakePointerEvent(600));

    expect(ratioChangeSpy).not.toHaveBeenCalled();
  });

  it('emits ratioChange (but not resizeEnd) on every pointermove during a drag', () => {
    stubContainerWidth(1000);
    component.ratio = 0.5;
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(600));

    // +100px over a 1000px container is +0.1 ratio, from a 0.5 start.
    expect(ratioChangeSpy).toHaveBeenCalledWith(0.6);
    expect(resizeEndSpy).not.toHaveBeenCalled();
  });

  it('emits both ratioChange and resizeEnd exactly once on pointerup, with the final ratio', () => {
    stubContainerWidth(1000);
    component.ratio = 0.5;
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(550));
    component.onPointerUp(fakePointerEvent(600));

    expect(resizeEndSpy).toHaveBeenCalledTimes(1);
    expect(resizeEndSpy).toHaveBeenCalledWith(0.6);
    expect(ratioChangeSpy).toHaveBeenLastCalledWith(0.6);
  });

  it('clamps a drag pushed far past the minimum ratio to exactly minRatio, never below', () => {
    stubContainerWidth(1000);
    component.ratio = 0.5;
    component.minRatio = MIN_EDITOR_PANE_RATIO;
    component.maxRatio = MAX_EDITOR_PANE_RATIO;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    // A 900px leftward drag would produce ratio 0.5 - 0.9 = -0.4 unclamped.
    component.onPointerUp(fakePointerEvent(-400));

    expect(resizeEndSpy).toHaveBeenCalledWith(MIN_EDITOR_PANE_RATIO);
  });

  it('clamps a drag pushed far past the maximum ratio to exactly maxRatio, never above', () => {
    stubContainerWidth(1000);
    component.ratio = 0.5;
    component.minRatio = MIN_EDITOR_PANE_RATIO;
    component.maxRatio = MAX_EDITOR_PANE_RATIO;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    // A 900px rightward drag would produce ratio 0.5 + 0.9 = 1.4 unclamped.
    component.onPointerUp(fakePointerEvent(1400));

    expect(resizeEndSpy).toHaveBeenCalledWith(MAX_EDITOR_PANE_RATIO);
  });

  it('ignores pointerup/pointercancel when no drag is in progress', () => {
    stubContainerWidth(1000);
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerUp(fakePointerEvent(600));
    component.onPointerCancel(fakePointerEvent(600));

    expect(ratioChangeSpy).not.toHaveBeenCalled();
    expect(resizeEndSpy).not.toHaveBeenCalled();
  });

  it('pointercancel ends the drag without emitting resizeEnd', () => {
    stubContainerWidth(1000);
    component.ratio = 0.5;
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(550));
    component.onPointerCancel(fakePointerEvent(550));

    expect(resizeEndSpy).not.toHaveBeenCalled();
    expect(component.isDragging()).toBe(false);
  });

  it('toggles the resize-divider--active class on between pointerdown and pointerup', () => {
    stubContainerWidth(1000);
    fixture.detectChanges();

    component.onPointerDown(fakePointerEvent(500));
    fixture.detectChanges();
    expect(byTestId('resize-divider').classList).toContain('resize-divider--active');

    component.onPointerUp(fakePointerEvent(500));
    fixture.detectChanges();
    expect(byTestId('resize-divider').classList).not.toContain('resize-divider--active');
  });

  it('adds is-resizing-panes to document.body on pointerdown and removes it on pointerup', () => {
    stubContainerWidth(1000);

    component.onPointerDown(fakePointerEvent(500));
    expect(document.body.classList.contains('is-resizing-panes')).toBe(true);

    component.onPointerUp(fakePointerEvent(500));
    expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
  });

  it('removes is-resizing-panes from document.body on pointercancel too', () => {
    stubContainerWidth(1000);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerCancel(fakePointerEvent(500));

    expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
  });

  it('nudges the ratio by a fixed step and emits the clamped value via both outputs on ArrowRight', () => {
    component.ratio = 0.5;
    component.minRatio = MIN_EDITOR_PANE_RATIO;
    component.maxRatio = MAX_EDITOR_PANE_RATIO;
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onArrowRight();

    expect(ratioChangeSpy).toHaveBeenCalledWith(0.52);
    expect(resizeEndSpy).toHaveBeenCalledWith(0.52);
  });

  it('nudges the ratio down and clamps at minRatio on repeated ArrowLeft', () => {
    component.ratio = MIN_EDITOR_PANE_RATIO;
    component.minRatio = MIN_EDITOR_PANE_RATIO;
    component.maxRatio = MAX_EDITOR_PANE_RATIO;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onArrowLeft();

    expect(resizeEndSpy).toHaveBeenCalledWith(MIN_EDITOR_PANE_RATIO);
  });

  it('resets to the default ratio on dblclick regardless of the current ratio, via both outputs', () => {
    component.ratio = 0.75;
    const ratioChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.ratioChange.subscribe(ratioChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onDblClick();

    expect(ratioChangeSpy).toHaveBeenCalledWith(DEFAULT_EDITOR_PANE_RATIO);
    expect(resizeEndSpy).toHaveBeenCalledWith(DEFAULT_EDITOR_PANE_RATIO);
  });
});
