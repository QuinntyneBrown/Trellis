import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the Monaco editor instance hosted inside
 * [data-testid="monaco-editor"].
 *
 * Monaco virtualizes its rendered lines, so the DOM only ever contains a
 * partial, viewport-dependent slice of the true text. Any assertion that
 * needs the *actual* full buffer content MUST go through getValue(),
 * which reaches into the page's global `monaco` object rather than
 * scraping rendered `.view-line` elements.
 *
 * All text entry goes through the real keyboard (page.keyboard.type),
 * never Locator.fill(), so that Monaco's own key bindings, IME handling
 * and editor state stay in the same code path a real user would exercise.
 */
export class MonacoEditorComponent {
  private readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = byTestId(page, 'monaco-editor');
  }

  /**
   * Waits until Monaco has actually booted and attached an editor
   * instance to `window.monaco`. Interactions performed before this
   * (typing, focusing, reading values) can be flaky immediately after
   * navigation since Monaco initializes asynchronously.
   */
  async waitForReady(): Promise<void> {
    await this.page.waitForFunction(() => {
      const globalMonaco = (window as unknown as { monaco?: any }).monaco;
      return !!globalMonaco?.editor?.getEditors?.()?.length;
    });
  }

  /** Clicks into the editor's text surface to give it keyboard focus. */
  async focus(): Promise<void> {
    await this.root.click();
  }

  /** Selects all current text in the focused editor via Ctrl+A. */
  async selectAll(): Promise<void> {
    await this.focus();
    await this.page.keyboard.press('Control+A');
  }

  /** Types the given text through the real keyboard, character by character. */
  async typeText(text: string): Promise<void> {
    await this.page.keyboard.type(text);
  }

  /**
   * Replaces the entire current buffer with `text`: focuses the editor,
   * selects everything, deletes the selection, then types the replacement.
   *
   * The explicit Delete step matters for the empty-string case in
   * particular: `page.keyboard.type('')` sends zero keystrokes, so without
   * first deleting the selection, "replacing" with '' would leave the
   * original content completely untouched (still selected, but present).
   */
  async replaceAllText(text: string): Promise<void> {
    await this.selectAll();
    await this.page.keyboard.press('Delete');
    await this.typeText(text);
  }

  /** Triggers a render via the app's Ctrl+Enter keyboard shortcut. */
  async pressRender(): Promise<void> {
    await this.focus();
    await this.page.keyboard.press('Control+Enter');
  }

  /**
   * Reads the true buffer content directly from Monaco's in-memory model
   * via `window.monaco.editor.getEditors()[0].getValue()`. This is the
   * only reliable way to read the full document text, since Monaco only
   * renders the lines currently in (or near) the viewport to the DOM.
   */
  async getValue(): Promise<string> {
    return this.page.evaluate(() => {
      const globalMonaco = (window as unknown as { monaco?: any }).monaco;
      if (!globalMonaco) {
        throw new Error(
          'window.monaco is not available on the page; cannot read editor value.'
        );
      }
      const editors = globalMonaco.editor.getEditors();
      if (!editors || editors.length === 0) {
        throw new Error('No Monaco editor instances found via getEditors().');
      }
      return editors[0].getValue() as string;
    });
  }
}
