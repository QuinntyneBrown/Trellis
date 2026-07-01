import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

import {
  DEFAULT_SIDE_PANEL_WIDTH_PX,
  MAX_SIDE_PANEL_WIDTH_PX,
  MIN_SIDE_PANEL_WIDTH_PX,
} from '../side-panel-width.constants';
import { clampWidthPx } from './clamp-width';

/** Fixed pixel step applied per arrow-key nudge (see onArrowLeft/onArrowRight). */
const KEYBOARD_STEP_PX = 16;

/** CSS class toggled on `document.body` for the duration of an active drag; see styles.scss. */
const RESIZING_BODY_CLASS = 'is-resizing-panes';

/**
 * VS Code-sash-style draggable divider between the Explorer/Documents side
 * panel and the rest of the editor layout -- pixel-native sibling of
 * ResizeDividerComponent (which drives the editor/preview split as a ratio
 * instead).
 *
 * Deliberately a "dumb", fully controlled component: it has no idea what
 * sits on either side of it, and no idea widths get persisted anywhere. It
 * only converts pointer/keyboard gestures into pixel widths (clamped to
 * [minWidthPx, maxWidthPx]) and emits them -- the parent (EditorPageComponent)
 * owns what the width actually drives and whether/when it gets persisted.
 *
 * Unlike ResizeDividerComponent, no container width lookup is needed here:
 * the side panel's width is an absolute pixel value, not a fraction of its
 * container, so a pointer delta in px is *directly* a width delta in px.
 *
 * Uses native Pointer Events with setPointerCapture rather than manual
 * document-level mousemove/mouseup listeners -- see ResizeDividerComponent's
 * own doc comment for the full rationale, which applies here unchanged.
 */
@Component({
  selector: 'app-pixel-resize-divider',
  standalone: true,
  imports: [],
  templateUrl: './pixel-resize-divider.component.html',
  styleUrl: './pixel-resize-divider.component.scss',
})
export class PixelResizeDividerComponent {
  @Input() widthPx = DEFAULT_SIDE_PANEL_WIDTH_PX;
  @Input() minWidthPx = MIN_SIDE_PANEL_WIDTH_PX;
  @Input() maxWidthPx = MAX_SIDE_PANEL_WIDTH_PX;

  /** Fires continuously during an in-progress drag/nudge -- drives live layout only. */
  @Output() readonly widthChange = new EventEmitter<number>();
  /** Fires exactly once per completed gesture -- the only event the parent should ever persist on. */
  @Output() readonly resizeEnd = new EventEmitter<number>();

  /** True between pointerdown and pointerup/pointercancel; drives the --active visual state. */
  readonly isDragging = signal(false);

  private dragStartClientX = 0;
  private dragStartWidthPx = DEFAULT_SIDE_PANEL_WIDTH_PX;

  get ariaValueNow(): number {
    return Math.round(this.widthPx);
  }

  get ariaValueMin(): number {
    return Math.round(this.minWidthPx);
  }

  get ariaValueMax(): number {
    return Math.round(this.maxWidthPx);
  }

  onPointerDown(event: PointerEvent): void {
    this.isDragging.set(true);
    this.dragStartClientX = event.clientX;
    this.dragStartWidthPx = this.widthPx;

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
    this.widthChange.emit(this.widthFromClientX(event.clientX));
  }

  onPointerUp(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    const finalWidthPx = this.widthFromClientX(event.clientX);
    this.endDrag(event);
    this.widthChange.emit(finalWidthPx);
    this.resizeEnd.emit(finalWidthPx);
  }

  onPointerCancel(event: PointerEvent): void {
    if (!this.isDragging()) {
      return;
    }
    // A cancelled gesture is not a *completed* one -- unlike pointerup, this
    // deliberately does not emit resizeEnd, so a drag interrupted mid-way
    // (e.g. by an OS/browser gesture) never persists a half-finished width.
    this.endDrag(event);
  }

  onArrowLeft(): void {
    this.nudge(-KEYBOARD_STEP_PX);
  }

  onArrowRight(): void {
    this.nudge(KEYBOARD_STEP_PX);
  }

  onDblClick(): void {
    this.widthChange.emit(DEFAULT_SIDE_PANEL_WIDTH_PX);
    this.resizeEnd.emit(DEFAULT_SIDE_PANEL_WIDTH_PX);
  }

  private nudge(deltaPx: number): void {
    // Each nudge is a complete, discrete change in its own right (not part
    // of a longer gesture), so unlike widthChange during a drag, it is
    // emitted via both outputs immediately.
    const newWidthPx = clampWidthPx(this.widthPx + deltaPx, this.minWidthPx, this.maxWidthPx);
    this.widthChange.emit(newWidthPx);
    this.resizeEnd.emit(newWidthPx);
  }

  private widthFromClientX(clientX: number): number {
    // The side panel is the pane to the LEFT of this divider (the same role
    // the editor pane plays relative to the existing ratio divider) -- a
    // rightward drag (positive delta) grows it, a leftward drag shrinks it.
    const delta = clientX - this.dragStartClientX;
    return clampWidthPx(this.dragStartWidthPx + delta, this.minWidthPx, this.maxWidthPx);
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
