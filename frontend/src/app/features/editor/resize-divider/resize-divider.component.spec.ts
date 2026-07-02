import { ComponentFixture, TestBed } from '@angular/core/testing';

import {
  DEFAULT_EDITOR_PANE_RATIO,
  MAX_EDITOR_PANE_RATIO,
  MIN_EDITOR_PANE_RATIO,
} from '../editor-pane-ratio.constants';
import {
  DEFAULT_SIDE_PANEL_WIDTH_PX,
  MAX_SIDE_PANEL_WIDTH_PX,
  MIN_SIDE_PANEL_WIDTH_PX,
} from '../side-panel-width.constants';
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

  /** Configures the component the way the editor page's ratio divider instance does. */
  function setUpRatioMode(): void {
    component.value = DEFAULT_EDITOR_PANE_RATIO;
    component.min = MIN_EDITOR_PANE_RATIO;
    component.max = MAX_EDITOR_PANE_RATIO;
    component.step = 0.02;
    component.resetValue = DEFAULT_EDITOR_PANE_RATIO;
    component.ariaLabel = 'Resize editor and preview panes';
    component.testId = 'resize-divider';
    component.scaleToContainerWidth = true;
    fixture.detectChanges();
  }

  /** Configures the component the way the editor page's side-panel divider instance does. */
  function setUpPixelMode(): void {
    component.value = DEFAULT_SIDE_PANEL_WIDTH_PX;
    component.min = MIN_SIDE_PANEL_WIDTH_PX;
    component.max = MAX_SIDE_PANEL_WIDTH_PX;
    component.step = 16;
    component.resetValue = DEFAULT_SIDE_PANEL_WIDTH_PX;
    component.ariaLabel = 'Resize side panel';
    component.testId = 'pixel-resize-divider';
    component.scaleToContainerWidth = false;
    fixture.detectChanges();
  }

  describe('ratio mode (scaleToContainerWidth)', () => {
    it('renders the root separator with percentage ARIA attributes derived from its inputs', () => {
      setUpRatioMode();
      component.value = 0.3;
      fixture.detectChanges();

      const root = byTestId('resize-divider');
      expect(root.getAttribute('role')).toBe('separator');
      expect(root.getAttribute('aria-orientation')).toBe('vertical');
      expect(root.getAttribute('tabindex')).toBe('0');
      expect(root.getAttribute('aria-valuenow')).toBe('30');
      expect(root.getAttribute('aria-valuemin')).toBe('20');
      expect(root.getAttribute('aria-valuemax')).toBe('80');
      expect(root.getAttribute('aria-label')).toBe('Resize editor and preview panes');
    });

    it('does not emit anything on pointermove before any pointerdown has occurred', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      const valueChangeSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);

      component.onPointerMove(fakePointerEvent(600));

      expect(valueChangeSpy).not.toHaveBeenCalled();
    });

    it('emits valueChange (but not resizeEnd) on every pointermove during a drag', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      component.value = 0.5;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(600));

      // +100px over a 1000px container is +0.1 ratio, from a 0.5 start.
      expect(valueChangeSpy).toHaveBeenCalledWith(0.6);
      expect(resizeEndSpy).not.toHaveBeenCalled();
    });

    it('emits both valueChange and resizeEnd exactly once on pointerup, with the final ratio', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      component.value = 0.5;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(550));
      component.onPointerUp(fakePointerEvent(600));

      expect(resizeEndSpy).toHaveBeenCalledTimes(1);
      expect(resizeEndSpy).toHaveBeenCalledWith(0.6);
      expect(valueChangeSpy).toHaveBeenLastCalledWith(0.6);
    });

    it('clamps a drag pushed far past the minimum ratio to exactly min, never below', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      component.value = 0.5;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      // A 900px leftward drag would produce ratio 0.5 - 0.9 = -0.4 unclamped.
      component.onPointerUp(fakePointerEvent(-400));

      expect(resizeEndSpy).toHaveBeenCalledWith(MIN_EDITOR_PANE_RATIO);
    });

    it('clamps a drag pushed far past the maximum ratio to exactly max, never above', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      component.value = 0.5;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      // A 900px rightward drag would produce ratio 0.5 + 0.9 = 1.4 unclamped.
      component.onPointerUp(fakePointerEvent(1400));

      expect(resizeEndSpy).toHaveBeenCalledWith(MAX_EDITOR_PANE_RATIO);
    });

    it('produces a zero delta (not garbage) when the container width is unmeasurable', () => {
      setUpRatioMode();
      stubContainerWidth(0);
      component.value = 0.5;
      const valueChangeSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(900));

      expect(valueChangeSpy).toHaveBeenCalledWith(0.5);
    });

    it('ignores pointerup/pointercancel when no drag is in progress', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerUp(fakePointerEvent(600));
      component.onPointerCancel(fakePointerEvent(600));

      expect(valueChangeSpy).not.toHaveBeenCalled();
      expect(resizeEndSpy).not.toHaveBeenCalled();
    });

    it('pointercancel ends the drag without emitting resizeEnd', () => {
      setUpRatioMode();
      stubContainerWidth(1000);
      component.value = 0.5;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(550));
      component.onPointerCancel(fakePointerEvent(550));

      expect(resizeEndSpy).not.toHaveBeenCalled();
      expect(component.isDragging()).toBe(false);
    });

    it('toggles the resize-divider--active class on between pointerdown and pointerup', () => {
      setUpRatioMode();
      stubContainerWidth(1000);

      component.onPointerDown(fakePointerEvent(500));
      fixture.detectChanges();
      expect(byTestId('resize-divider').classList).toContain('resize-divider--active');

      component.onPointerUp(fakePointerEvent(500));
      fixture.detectChanges();
      expect(byTestId('resize-divider').classList).not.toContain('resize-divider--active');
    });

    it('adds is-resizing-panes to document.body on pointerdown and removes it on pointerup', () => {
      setUpRatioMode();
      stubContainerWidth(1000);

      component.onPointerDown(fakePointerEvent(500));
      expect(document.body.classList.contains('is-resizing-panes')).toBe(true);

      component.onPointerUp(fakePointerEvent(500));
      expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
    });

    it('removes is-resizing-panes from document.body on pointercancel too', () => {
      setUpRatioMode();
      stubContainerWidth(1000);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerCancel(fakePointerEvent(500));

      expect(document.body.classList.contains('is-resizing-panes')).toBe(false);
    });

    it('nudges the ratio by the configured step and emits the clamped value via both outputs on ArrowRight', () => {
      setUpRatioMode();
      component.value = 0.5;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onArrowRight();

      expect(valueChangeSpy).toHaveBeenCalledWith(0.52);
      expect(resizeEndSpy).toHaveBeenCalledWith(0.52);
    });

    it('nudges the ratio down and clamps at min on repeated ArrowLeft', () => {
      setUpRatioMode();
      component.value = MIN_EDITOR_PANE_RATIO;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onArrowLeft();

      expect(resizeEndSpy).toHaveBeenCalledWith(MIN_EDITOR_PANE_RATIO);
    });

    it('resets to the configured reset value on dblclick regardless of the current ratio, via both outputs', () => {
      setUpRatioMode();
      component.value = 0.75;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onDblClick();

      expect(valueChangeSpy).toHaveBeenCalledWith(DEFAULT_EDITOR_PANE_RATIO);
      expect(resizeEndSpy).toHaveBeenCalledWith(DEFAULT_EDITOR_PANE_RATIO);
    });
  });

  describe('pixel mode', () => {
    it('renders raw pixel ARIA attributes (not percentages)', () => {
      setUpPixelMode();
      component.value = 300;
      fixture.detectChanges();

      const root = byTestId('pixel-resize-divider');
      expect(root.getAttribute('aria-valuenow')).toBe('300');
      expect(root.getAttribute('aria-valuemin')).toBe(String(MIN_SIDE_PANEL_WIDTH_PX));
      expect(root.getAttribute('aria-valuemax')).toBe(String(MAX_SIDE_PANEL_WIDTH_PX));
      expect(root.getAttribute('aria-label')).toBe('Resize side panel');
    });

    it('maps a pointer delta directly to a pixel delta, without any container width lookup', () => {
      setUpPixelMode();
      component.value = 260;
      const valueChangeSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(600));

      // +100px of pointer travel is +100px of width, no scaling involved.
      expect(valueChangeSpy).toHaveBeenCalledWith(360);
    });

    it('clamps drags to the [min, max] pixel bounds', () => {
      setUpPixelMode();
      component.value = 260;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerUp(fakePointerEvent(-1500));
      expect(resizeEndSpy).toHaveBeenLastCalledWith(MIN_SIDE_PANEL_WIDTH_PX);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerUp(fakePointerEvent(5000));
      expect(resizeEndSpy).toHaveBeenLastCalledWith(MAX_SIDE_PANEL_WIDTH_PX);
    });

    it('nudges by the configured 16px step on ArrowRight, via both outputs', () => {
      setUpPixelMode();
      component.value = 260;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onArrowRight();

      expect(valueChangeSpy).toHaveBeenCalledWith(276);
      expect(resizeEndSpy).toHaveBeenCalledWith(276);
    });

    it('nudges down by 16px on ArrowLeft and clamps at the minimum width', () => {
      setUpPixelMode();
      component.value = MIN_SIDE_PANEL_WIDTH_PX + 10;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onArrowLeft();

      expect(resizeEndSpy).toHaveBeenCalledWith(MIN_SIDE_PANEL_WIDTH_PX);
    });

    it('resets to the default side panel width on dblclick, via both outputs', () => {
      setUpPixelMode();
      component.value = 420;
      const valueChangeSpy = jest.fn();
      const resizeEndSpy = jest.fn();
      component.valueChange.subscribe(valueChangeSpy);
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onDblClick();

      expect(valueChangeSpy).toHaveBeenCalledWith(DEFAULT_SIDE_PANEL_WIDTH_PX);
      expect(resizeEndSpy).toHaveBeenCalledWith(DEFAULT_SIDE_PANEL_WIDTH_PX);
    });

    it('pointercancel does not persist a half-finished width', () => {
      setUpPixelMode();
      component.value = 260;
      const resizeEndSpy = jest.fn();
      component.resizeEnd.subscribe(resizeEndSpy);

      component.onPointerDown(fakePointerEvent(500));
      component.onPointerMove(fakePointerEvent(550));
      component.onPointerCancel(fakePointerEvent(550));

      expect(resizeEndSpy).not.toHaveBeenCalled();
      expect(component.isDragging()).toBe(false);
    });
  });
});
