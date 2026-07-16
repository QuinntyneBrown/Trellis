import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the Templates side panel: toggle at
 * [data-testid="templates-panel-toggle"] (owned by the toolbar), panel root
 * at [data-testid="templates-panel"], and one
 * [data-testid="template-item"] per template carrying a data-template-name
 * attribute. Rows have no inline action buttons: clicking a row applies it,
 * and update/rename/delete live in the shared right-click context menu
 * (plus New Template from a background right-click on the list), driven
 * with the explorer POM's runContextCommand idiom.
 *
 * INTEGRATION NOTE: mutations use native `window.prompt`/`window.confirm`.
 * The header createTemplate answers the real dialog via a one-shot
 * Playwright `dialog` handler; the menu-driven helpers stub
 * window.prompt/window.confirm on the page instead (explorer POM
 * convention). The stubs persist for the page's lifetime, so call
 * createTemplate BEFORE any menu-driven helper on the same page -- a
 * stubbed prompt never raises the dialog event the handler waits for.
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

  /** Applies the template into the editor by clicking its row. The panel stays open. */
  async applyTemplate(name: string): Promise<void> {
    await this.item(name).click();
  }

  /** Applies the template into the editor via its row's context-menu Apply command. */
  async applyTemplateViaMenu(name: string): Promise<void> {
    await this.runContextCommand(this.item(name), 'apply');
  }

  /** Creates a template from the current editor content via the header button, answering the name prompt. */
  async createTemplate(name: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(name));
    await byTestId(this.root, 'templates-new-template').click();
  }

  /** Overwrites the template with the current editor buffer via the context menu, accepting the confirm. */
  async updateFromEditor(name: string): Promise<void> {
    await this.runConfirmCommand(this.item(name), 'update', true);
  }

  /** Renames the template via the context menu, answering the seeded prompt with `newName`. */
  async renameTemplate(oldName: string, newName: string): Promise<void> {
    await this.runPromptCommand(this.item(oldName), 'rename', newName);
  }

  /** Deletes the template via the context menu, accepting the confirm. */
  async deleteTemplate(name: string): Promise<void> {
    await this.runConfirmCommand(this.item(name), 'delete', true);
  }

  /**
   * Creates a template from the current editor content via the list
   * background's context menu. Right-clicks near the list's bottom-left
   * corner -- rows fill from the top, so that spot is reliably empty
   * (the list container stretches to the panel's full height).
   */
  async createTemplateViaBackgroundMenu(name: string): Promise<void> {
    const list = byTestId(this.root, 'templates-list');
    const box = await list.boundingBox();
    if (!box) {
      throw new Error('templates-list is not visible');
    }
    const position = { x: Math.min(24, box.width / 2), y: box.height - 8 };
    await this.runPromptCommand(list, 'new-template', name, position);
  }

  private async runContextCommand(
    target: Locator,
    command: string,
    position?: { x: number; y: number },
  ): Promise<void> {
    const page = this.root.page();
    await target.click({ button: 'right', position });
    const menu = byTestId(page, 'tree-context-menu');
    await expect(menu).toBeVisible();
    await menu.locator(`[data-command="${command}"]`).dispatchEvent('click');
  }

  private async runPromptCommand(
    target: Locator,
    command: string,
    value: string,
    position?: { x: number; y: number },
  ): Promise<void> {
    const page = this.root.page();
    await page.evaluate((answer) => {
      window.prompt = () => answer;
    }, value);
    await this.runContextCommand(target, command, position);
  }

  private async runConfirmCommand(target: Locator, command: string, answer: boolean): Promise<void> {
    const page = this.root.page();
    await page.evaluate((shouldConfirm) => {
      window.confirm = () => shouldConfirm;
    }, answer);
    await this.runContextCommand(target, command);
  }
}
