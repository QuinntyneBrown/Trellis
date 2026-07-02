import { Component, ElementRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';

import { clamp } from './clamp';

/** CSS class toggled on `document.body` for the duration of an active drag; see styles.scss. */
const RESIZING_BODY_CLASS = 'is-resizing-panes';

/**
 * VS Code-sash-style draggable divider between two panes. The editor page
 * uses one instance for the editor/preview split (a 0..1 ratio of the panes'
 * container) and one for the side panel edge (a raw pixel width) -- the only
 * behavioral difference between the two is `scaleToContainerWidth`.
 *
 * Deliberately a "dumb", fully controlled component: it has no idea what
 * sits on either side of it, and no idea values get persisted anywhere. It
 * only converts pointer/keyboard gestures into clamped values and emits
 * them -- the parent owns what the value actually drives and whether/when
 * it gets persisted.
 *
 * Uses native Pointer Events with setPointerCapture rather than manual
 * document-level mousemove/mouseup listeners: once the pointer is captured,
 * this element keeps receiving pointermove/pointerup even when the cursor
 * strays outside its own (intentionally narrow) bounds, and there is no
 * listener-cleanup bookkeeping that could leak if a drag were interrupted
 * (e.g. by a route change).
 */
@Component({
  selector: 'app-resize-divider',
  standalone: true,
  imports: [],
  templateUrl: './resize-divider.component.html',
  styleUrl: './resize-divider.component.scss',
})
export class ResizeDividerComponent {
  private readonly elementRef = inject(ElementRef<HTMLElement>);

  /** The current value: a 0..1 ratio when `scaleToContainerWidth` is true, raw pixels otherwise. */
  @Input({ required: true }) value!: number;
  @Input({ required: true }) min!: number;
  @Input({ required: true }) max!: number;
  /** Applied per arrow-key nudge, in the same unit as `value`. */
  @Input({ required: true }) step!: number;
  /** The value emitted (via both outputs) when the divider is double-clicked. */
  @Input({ required: true }) resetValue!: number;
  @Input({ required: true }) ariaLabel!: string;
  /** Rendered as data-testid, so each divider instance stays independently addressable in e2e. */
  @Input({ required: true }) testId!: string;
  /**
   * When true, pointer deltas are divided by the parent element's width, so
   * `value` is a fraction of the container rather than a pixel count.
   */
  @Input() scaleToContainerWidth = false;

  /** Fires continuously during an in-progress drag/nudge -- drives live layout only. */
  @Output() readonly valueChange = new EventEmitter<number>();
  /** Fires exactly once per completed gesture -- the only event the parent should ever persist on. */
  @Output() readonly resizeEnd = new EventEmitter<number>();

  /** True between pointerdown and pointerup/pointercancel; drives the --active visual state. */
  readonly isDragging = signal(false);

  private dragStartClientX = 0;
  private dragStartValue = 0;

  // ARIA values are percentages in ratio mode and raw pixel counts otherwise.
  get ariaValueNow(): number {
    return Math.round(this.scaleToContainerWidth ? this.value * 100 : this.value);
  }

  get ariaValueMin(): number {
    return Math.round(this.scaleToContainerWidth ? this.min * 100 : this.min);
  }

  get ariaValueMax(): number {
    return Math.round(this.scaleToContainerWidth ? this.max * 100 : this.max);
  }

  onPointerDown(event: PointerEvent): void {
    this.isDragging.set(true);
    this.dragStartClientX = event.clientX;
    this.dragStartValue = this.value;

    // Captured on whatever element actually received the pointerdown (the
    // root divider or its wider inner grab area) -- either way it's this
    // component's own element, so subsequent pointermove/pointerup are
    // redirected here regardless of how far the pointer strays.
    (event.target as Element).setPointerCapture(event.pointerId);
    document.body.classList.add(RESIZING_BODY_CLASS);
  }

  onPointerMove(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    this.valueChange.emit(this.valueFromClientX(event.clientX));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    const finalValue = this.valueFromClientX(event.clientX);
    this.endDrag(event);
    this.valueChange.emit(finalValue);
    this.resizeEnd.emit(finalValue);
  }

  onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    // A cancelled gesture is not a *completed* one -- unlike pointerup, this
    // deliberately does not emit resizeEnd, so a drag interrupted mid-way
    // (e.g. by an OS/browser gesture) never persists a half-finished value.
    this.endDrag(event);
  }

  onArrowLeft(): void {
    this.nudge(-this.step);
  }

  onArrowRight(): void {
    this.nudge(this.step);
  }

  onDblClick(): void {
    this.valueChange.emit(this.resetValue);
    this.resizeEnd.emit(this.resetValue);
  }

  private nudge(delta: number): void {
    // Each nudge is a complete, discrete change in its own right (not part of
    // a longer gesture), so unlike valueChange during a drag, it is emitted
    // via both outputs immediately.
    const newValue = clamp(this.value + delta, this.min, this.max);
    this.valueChange.emit(newValue);
    this.resizeEnd.emit(newValue);
  }

  private valueFromClientX(clientX: number): number {
    let delta = clientX - this.dragStartClientX;

    if (this.scaleToContainerWidth) {
      // The divider's own parent is the flex row whose width the ratio is a
      // fraction of -- not window width, which would be wrong the moment any
      // sibling (e.g. the side panel) also occupies space in that row. When
      // the container is unmeasurable, the delta is 0 rather than garbage.
      const containerWidth = this.elementRef.nativeElement.parentElement?.getBoundingClientRect().width ?? 0;
      delta = containerWidth > 0 ? delta / containerWidth : 0;
    }

    return clamp(this.dragStartValue + delta, this.min, this.max);
  }

  private endDrag(event: PointerEvent): void {
    // Defensive: releasing a capture that was already released (e.g. by the
    // browser itself around a pointercancel) can throw, and that must never
    // prevent the drag-state/body-class cleanup below.
    try {
      (event.target as Element).releasePointerCapture(event.pointerId);
    } catch {
      // Intentionally ignored -- see comment above.
    }
    this.isDragging.set(false);
    document.body.classList.remove(RESIZING_BODY_CLASS);
  }
}
