import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the title bar's Quick Open command center: at rest a
 * pill at [data-testid="title-bar-command-center"]; activated (pill click or
 * Ctrl+P) a combobox input at [data-testid="quick-open-input"] over an
 * anchored results dropdown.
 *
 * The pill and the input are alternates of the same slot -- exactly one is
 * in the DOM at a time -- so assertions here use visibility of whichever
 * side a step expects.
 */
export class QuickOpenComponent {
  readonly pill: Locator;
  readonly input: Locator;
  readonly dropdown: Locator;
  readonly rows: Locator;
  readonly empty: Locator;
  readonly activeRow: Locator;

  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
    this.pill = byTestId(page, 'title-bar-command-center');
    this.input = byTestId(page, 'quick-open-input');
    this.dropdown = byTestId(page, 'quick-open-dropdown');
    this.rows = byTestId(page, 'quick-open-row');
    this.empty = byTestId(page, 'quick-open-empty');
    this.activeRow = page.locator('[data-testid="quick-open-row"][aria-selected="true"]');
  }

  /** Opens by clicking the pill and waits for the input to take focus. */
  async openWithClick(): Promise<void> {
    await this.pill.click();
    await expect(this.input).toBeFocused();
  }

  /** Opens with the Ctrl+P shortcut (works regardless of current focus). */
  async openWithShortcut(): Promise<void> {
    await this.page.keyboard.press('ControlOrMeta+p');
    await expect(this.input).toBeFocused();
  }

  /** Types a query; fill() fires a single input event, matching the (input) binding. */
  async search(text: string): Promise<void> {
    await this.input.fill(text);
  }

  row(label: string): Locator {
    return this.page.locator(`[data-testid="quick-open-row"][data-option-label="${label}"]`);
  }

  /** Activates the currently active row with Enter. */
  async chooseActive(): Promise<void> {
    await this.input.press('Enter');
  }

  /** Dismisses with Escape and waits for the pill to return with focus. */
  async dismiss(): Promise<void> {
    await this.input.press('Escape');
    await expect(this.pill).toBeVisible();
    await expect(this.pill).toBeFocused();
  }
}
