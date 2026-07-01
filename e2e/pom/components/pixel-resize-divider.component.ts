import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the pixel-native resize divider between the
 * Explorer/Documents side panel and the rest of the editor layout, at
 * [data-testid="pixel-resize-divider"]. Mirrors ResizeDividerComponent's
 * own shape exactly (see ./resize-divider.component.ts) -- pixel units
 * throughout rather than a ratio.
 */
export class PixelResizeDividerComponent {
  private readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = byTestId(page, 'pixel-resize-divider');
  }

  /** Reads the divider's current bounding box; throws if it has none (not visible/rendered). */
  async getBoundingBox(): Promise<{ x: number; y: number; width: number; height: number }> {
    const box = await this.root.boundingBox();
    if (!box) {
      throw new Error(
        'pixel-resize-divider element has no bounding box (is it visible/rendered?).'
      );
    }
    return box;
  }

  /**
   * Drags the divider horizontally by `deltaXPx` pixels from its current
   * center: mouse down at the divider's current center, then a multi-step
   * move to the target x (so more than one pointermove genuinely fires
   * along the way), then mouse up.
   */
  async dragBy(deltaXPx: number): Promise<void> {
    const box = await this.getBoundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const targetX = startX + deltaXPx;

    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    await this.page.mouse.move(targetX, startY, { steps: 8 });
    await this.page.mouse.up();
  }

  /** Double-clicks the divider, resetting the side panel back to its default width. */
  async doubleClick(): Promise<void> {
    await this.root.dblclick();
  }
}
