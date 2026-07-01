import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the template picker dropdown/panel:
 * toggle at [data-testid="template-picker-toggle"] (owned by the
 * toolbar), panel root at [data-testid="template-picker"], and one
 * option per template at [data-testid="template-option-KEY"].
 */
export class TemplatePickerComponent {
  readonly root: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'template-picker');
  }

  /** Whether the picker panel is currently open/visible. */
  async isOpen(): Promise<boolean> {
    return this.root.isVisible();
  }

  /** Locator for a single template option by its API key, e.g. 'c4-context'. */
  option(key: string): Locator {
    return byTestId(this.root.page(), `template-option-${key}`);
  }

  /**
   * Selects the template with the given key and confirms the insertion.
   * The picker exposes no separate "confirm" control beyond the option
   * itself, so clicking the option is both the selection and the
   * confirmation: it applies the template's content to the editor and
   * closes the panel.
   */
  async selectTemplate(key: string): Promise<void> {
    await this.option(key).click();
  }
}
