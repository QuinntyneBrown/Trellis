import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  DEFAULT_SIDE_PANEL_WIDTH_PX,
  MAX_SIDE_PANEL_WIDTH_PX,
  MIN_SIDE_PANEL_WIDTH_PX,
} from '../side-panel-width.constants';
import { PixelResizeDividerComponent } from './pixel-resize-divider.component';

/**
 * Fabricates a minimal event-like object rather than a real PointerEvent:
 * jsdom does not meaningfully emulate setPointerCapture's real capture/
 * redirect semantics, so tests call the component's handler methods
 * directly instead of relying on jsdom to actually redirect events. Mirrors
 * resize-divider.component.spec.ts's own fakePointerEvent exactly.
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

describe('PixelResizeDividerComponent', () => {
  let fixture: ComponentFixture<PixelResizeDividerComponent>;
  let component: PixelResizeDividerComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PixelResizeDividerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PixelResizeDividerComponent);
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

  it('renders the root separator with ARIA attributes derived from its inputs (raw pixel numbers)', () => {
    component.widthPx = 300;
    component.minWidthPx = 170;
    component.maxWidthPx = 500;
    fixture.detectChanges();

    const root = byTestId('pixel-resize-divider');
    expect(root.getAttribute('role')).toBe('separator');
    expect(root.getAttribute('aria-orientation')).toBe('vertical');
    expect(root.getAttribute('tabindex')).toBe('0');
    expect(root.getAttribute('aria-valuenow')).toBe('300');
    expect(root.getAttribute('aria-valuemin')).toBe('170');
    expect(root.getAttribute('aria-valuemax')).toBe('500');
    expect(root.getAttribute('aria-label')).toBeTruthy();
  });

  it('does not emit anything on pointermove before any pointerdown has occurred', () => {
    const widthChangeSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);

    component.onPointerMove(fakePointerEvent(600));

    expect(widthChangeSpy).not.toHaveBeenCalled();
  });

  it('emits widthChange (but not resizeEnd) on every pointermove during a drag', () => {
    component.widthPx = 300;
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(600));

    // +100px of pointer movement is directly +100px of width, pixel-native.
    expect(widthChangeSpy).toHaveBeenCalledWith(400);
    expect(resizeEndSpy).not.toHaveBeenCalled();
  });

  it('emits both widthChange and resizeEnd exactly once on pointerup, with the final width', () => {
    component.widthPx = 300;
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(550));
    component.onPointerUp(fakePointerEvent(600));

    expect(resizeEndSpy).toHaveBeenCalledTimes(1);
    expect(resizeEndSpy).toHaveBeenCalledWith(400);
    expect(widthChangeSpy).toHaveBeenLastCalledWith(400);
  });

  it('clamps a drag pushed far past the minimum width to exactly minWidthPx, never below', () => {
    component.widthPx = 300;
    component.minWidthPx = MIN_SIDE_PANEL_WIDTH_PX;
    component.maxWidthPx = MAX_SIDE_PANEL_WIDTH_PX;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    // A 900px leftward drag would produce 300 - 900 = -600px unclamped.
    component.onPointerUp(fakePointerEvent(-400));

    expect(resizeEndSpy).toHaveBeenCalledWith(MIN_SIDE_PANEL_WIDTH_PX);
  });

  it('clamps a drag pushed far past the maximum width to exactly maxWidthPx, never above', () => {
    component.widthPx = 300;
    component.minWidthPx = MIN_SIDE_PANEL_WIDTH_PX;
    component.maxWidthPx = MAX_SIDE_PANEL_WIDTH_PX;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    // A 900px rightward drag would produce 300 + 900 = 1200px unclamped.
    component.onPointerUp(fakePointerEvent(1400));

    expect(resizeEndSpy).toHaveBeenCalledWith(MAX_SIDE_PANEL_WIDTH_PX);
  });

  it('ignores pointerup/pointercancel when no drag is in progress', () => {
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerUp(fakePointerEvent(600));
    component.onPointerCancel(fakePointerEvent(600));

    expect(widthChangeSpy).not.toHaveBeenCalled();
    expect(resizeEndSpy).not.toHaveBeenCalled();
  });

  it('pointercancel ends the drag without emitting resizeEnd', () => {
    component.widthPx = 300;
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onPointerDown(fakePointerEvent(500));
    component.onPointerMove(fakePointerEvent(550));
    component.onPointerCancel(fakePointerEvent(550));

    expect(resizeEndSpy).not.toHaveBeenCalled();
    expect(component.isDragging()).toBe(false);
  });

  it('toggles the pixel-resize-divider--active class on between pointerdown and pointerup', () => {
    fixture.detectChanges();

    component.onPointerDown(fakePointerEvent(500));
    fixture.detectChanges();
    expect(byTestId('pixel-resize-divider').classList).toContain('pixel-resize-divider--active');

    component.onPointerUp(fakePointerEvent(500));
    fixture.detectChanges();
    expect(byTestId('pixel-resize-divider').classList).not.toContain('pixel-resize-divider--active');
  });

  it('adds is-resizing-panes to document.body on pointerdown and removes it on pointerup', () => {
    component.onPointerDown(fakePointerEvent(500));
    expect(document.body.classList.contains('is-resizing-panes')).toBe(true);

    component.onPointerUp(fakePointerEvent(500));
    expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
  });

  it('removes is-resizing-panes from document.body on pointercancel too', () => {
    component.onPointerDown(fakePointerEvent(500));
    component.onPointerCancel(fakePointerEvent(500));

    expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
  });

  it('nudges the width by a fixed 16px step and emits the clamped value via both outputs on ArrowRight', () => {
    component.widthPx = 260;
    component.minWidthPx = MIN_SIDE_PANEL_WIDTH_PX;
    component.maxWidthPx = MAX_SIDE_PANEL_WIDTH_PX;
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onArrowRight();

    expect(widthChangeSpy).toHaveBeenCalledWith(276);
    expect(resizeEndSpy).toHaveBeenCalledWith(276);
  });

  it('nudges the width down and clamps at minWidthPx on repeated ArrowLeft', () => {
    component.widthPx = MIN_SIDE_PANEL_WIDTH_PX;
    component.minWidthPx = MIN_SIDE_PANEL_WIDTH_PX;
    component.maxWidthPx = MAX_SIDE_PANEL_WIDTH_PX;
    const resizeEndSpy = jest.fn();
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onArrowLeft();

    expect(resizeEndSpy).toHaveBeenCalledWith(MIN_SIDE_PANEL_WIDTH_PX);
  });

  it('resets to the default width on dblclick regardless of the current width, via both outputs', () => {
    component.widthPx = 450;
    const widthChangeSpy = jest.fn();
    const resizeEndSpy = jest.fn();
    component.widthChange.subscribe(widthChangeSpy);
    component.resizeEnd.subscribe(resizeEndSpy);

    component.onDblClick();

    expect(widthChangeSpy).toHaveBeenCalledWith(DEFAULT_SIDE_PANEL_WIDTH_PX);
    expect(resizeEndSpy).toHaveBeenCalledWith(DEFAULT_SIDE_PANEL_WIDTH_PX);
  });
});
