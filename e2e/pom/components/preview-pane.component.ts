import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the diagram preview pane at
 * [data-testid="preview-pane"].
 *
 * The pane exposes a data-render-seq counter attribute that increments by
 * exactly one every time a new render result (success OR failure) is
 * applied. That counter is the primary, robust tool for asserting "did
 * the preview actually update" without having to diff SVG markup (which
 * can be large, and whose exact byte content is an implementation
 * detail we should not overfit tests to).
 */
export class PreviewPaneComponent {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'preview-pane');
  }

  /**
   * Returns a short, comparable fingerprint of whatever is currently
   * rendered in the preview: the outer HTML of an inline <svg> if one is
   * present, otherwise the `src` of a rendered <img>, otherwise an empty
   * string. Two renders of different content should produce different
   * fingerprints; this is a supporting signal alongside
   * getRenderSequence(), which is the primary "did it update" check.
   */
  async getRenderedFingerprint(): Promise<string> {
    const svg = this.root.locator('svg').first();
    if (await svg.count()) {
      return svg.evaluate((el) => el.outerHTML);
    }

    const img = this.root.locator('img').first();
    if (await img.count()) {
      return (await img.getAttribute('src')) ?? '';
    }

    return '';
  }

  /** Whether the "no render yet" placeholder is currently visible. */
  async isPlaceholderVisible(): Promise<boolean> {
    return byTestId(this.root.page(), 'preview-placeholder').isVisible();
  }

  /** Whether the error banner is currently visible. */
  async isErrorVisible(): Promise<boolean> {
    return byTestId(this.root.page(), 'preview-error').isVisible();
  }

  /** Reads the text content of the error banner. */
  async getErrorMessage(): Promise<string> {
    const errorBanner = byTestId(this.root.page(), 'preview-error');
    return (await errorBanner.textContent())?.trim() ?? '';
  }

  /**
   * Reads the pane's data-render-seq attribute as a number. This is the
   * primary tool for asserting that the preview actually re-rendered:
   * it increments by exactly one for every applied render result,
   * success or failure alike.
   */
  async getRenderSequence(): Promise<number> {
    const raw = await this.root.getAttribute('data-render-seq');
    if (raw === null) {
      throw new Error(
        'preview-pane element is missing its data-render-seq attribute.'
      );
    }
    const value = Number(raw);
    if (Number.isNaN(value)) {
      throw new Error(`data-render-seq value "${raw}" is not a number.`);
    }
    return value;
  }
}
