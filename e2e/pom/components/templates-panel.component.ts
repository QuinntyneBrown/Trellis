import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the Templates side panel: toggle at
 * [data-testid="templates-panel-toggle"] (owned by the toolbar), panel root
 * at [data-testid="templates-panel"], and one
 * [data-testid="template-item"] per template carrying a data-template-name
 * attribute with nested apply/update/rename/delete action buttons.
 *
 * INTEGRATION NOTE: like the Documents panel, create/rename use native
 * `window.prompt` and update/delete use native `window.confirm`, so the
 * mutating helpers below register a one-shot Playwright `dialog` handler
 * (dialogs auto-dismiss with no listener attached, silently no-op'ing the
 * action).
 */
export class TemplatesPanelComponent {
  readonly root: Locator;
  readonly toggle: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'templates-panel');
    this.toggle = byTestId(page, 'templates-panel-toggle');
  }

  /** Opens the templates panel via its toolbar toggle. */
  async open(): Promise<void> {
    await this.toggle.click();
    await expect(this.root).toBeVisible();
  }

  /** Locator for a single template row by its exact name. */
  item(name: string): Locator {
    return this.root.locator(`[data-testid="template-item"][data-template-name="${name}"]`);
  }

  /** Asserts a template with the given name is listed in the panel. */
  async expectTemplateListed(name: string): Promise<void> {
    await expect(this.item(name)).toBeVisible();
  }

  /** Asserts a template with the given name is NOT listed in the panel. */
  async expectTemplateNotListed(name: string): Promise<void> {
    await expect(this.item(name)).toHaveCount(0);
  }

  /** Applies the template into the editor via its row's Apply action. The panel stays open. */
  async applyTemplate(name: string): Promise<void> {
    await byTestId(this.item(name), 'template-item-apply').click();
  }

  /** Creates a template from the current editor content, answering the name prompt. */
  async createTemplate(name: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(name));
    await byTestId(this.root, 'templates-new-template').click();
  }

  /** Overwrites the template's content with the current editor buffer, accepting the confirm. */
  async updateFromEditor(name: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept());
    await byTestId(this.item(name), 'template-item-update').click();
  }

  /** Renames the template currently named `oldName` to `newName` via its prompt. */
  async renameTemplate(oldName: string, newName: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(newName));
    await byTestId(this.item(oldName), 'template-item-rename').click();
  }

  /** Deletes the template with the given name, accepting the confirm. */
  async deleteTemplate(name: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept());
    await byTestId(this.item(name), 'template-item-delete').click();
  }
}
