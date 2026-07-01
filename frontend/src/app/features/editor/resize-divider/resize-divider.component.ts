import { Component, ElementRef, EventEmitter, Input, Output, inject, signal } from '@angular/core';

import {
  DEFAULT_EDITOR_PANE_RATIO,
  MAX_EDITOR_PANE_RATIO,
  MIN_EDITOR_PANE_RATIO,
} from '../editor-pane-ratio.constants';
import { clampRatio } from './clamp-ratio';

/** Fixed ratio step applied per arrow-key nudge (see onArrowLeft/onArrowRight). */
const KEYBOARD_STEP = 0.02;

/** CSS class toggled on `document.body` for the duration of an active drag; see styles.scss. */
const RESIZING_BODY_CLASS = 'is-resizing-panes';

/**
 * VS Code-sash-style draggable divider between the editor and preview panes.
 *
 * Deliberately a "dumb", fully controlled component: it has no idea it sits
 * between a Monaco editor and a diagram preview, and no idea ratios get
 * persisted anywhere. It only converts pointer/keyboard gestures into ratio
 * numbers (clamped to [minRatio, maxRatio]) and emits them -- the parent
 * (EditorPageComponent) owns what the ratio actually drives and whether/when
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

  @Input() ratio = DEFAULT_EDITOR_PANE_RATIO;
  @Input() minRatio = MIN_EDITOR_PANE_RATIO;
  @Input() maxRatio = MAX_EDITOR_PANE_RATIO;

  /** Fires continuously during an in-progress drag/nudge -- drives live layout only. */
  @Output() readonly ratioChange = new EventEmitter<number>();
  /** Fires exactly once per completed gesture -- the only event the parent should ever persist on. */
  @Output() readonly resizeEnd = new EventEmitter<number>();

  /** True between pointerdown and pointerup/pointercancel; drives the --active visual state. */
  readonly isDragging = signal(false);

  private dragStartClientX = 0;
  private dragStartRatio = DEFAULT_EDITOR_PANE_RATIO;

  get ariaValueNow(): number {
    return Math.round(this.ratio * 100);
  }

  get ariaValueMin(): number {
    return Math.round(this.minRatio * 100);
  }

  get ariaValueMax(): number {
    return Math.round(this.maxRatio * 100);
  }

  onPointerDown(event: PointerEvent): void {
    this.isDragging.set(true);
    this.dragStartClientX = event.clientX;
    this.dragStartRatio = this.ratio;

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
    this.ratioChange.emit(this.ratioFromClientX(event.clientX));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    const finalRatio = this.ratioFromClientX(event.clientX);
    this.endDrag(event);
    this.ratioChange.emit(finalRatio);
    this.resizeEnd.emit(finalRatio);
  }

  onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    // A cancelled gesture is not a *completed* one -- unlike pointerup, this
    // deliberately does not emit resizeEnd, so a drag interrupted mid-way
    // (e.g. by an OS/browser gesture) never persists a half-finished ratio.
    this.endDrag(event);
  }

  onArrowLeft(): void {
    this.nudge(-KEYBOARD_STEP);
  }

  onArrowRight(): void {
    this.nudge(KEYBOARD_STEP);
  }

  onDblClick(): void {
    this.ratioChange.emit(DEFAULT_EDITOR_PANE_RATIO);
    this.resizeEnd.emit(DEFAULT_EDITOR_PANE_RATIO);
  }

  private nudge(delta: number): void {
    // Each nudge is a complete, discrete change in its own right (not part of
    // a longer gesture), so unlike ratioChange during a drag, it is emitted
    // via both outputs immediately.
    const newRatio = clampRatio(this.ratio + delta, this.minRatio, this.maxRatio);
    this.ratioChange.emit(newRatio);
    this.resizeEnd.emit(newRatio);
  }

  private ratioFromClientX(clientX: number): number {
    // The divider's own parent is `.editor-page__body`, the flex row whose
    // width the ratio is a fraction of -- not window width, which would be
    // wrong the moment any sibling (e.g. the documents panel) also occupies
    // space in that row.
    const containerWidth = this.elementRef.nativeElement.parentElement?.getBoundingClientRect().width ?? 0;
    const delta = containerWidth > 0 ? (clientX - this.dragStartClientX) / containerWidth : 0;
    return clampRatio(this.dragStartRatio + delta, this.minRatio, this.maxRatio);
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
