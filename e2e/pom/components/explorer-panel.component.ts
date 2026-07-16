import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the Explorer panel: toggle at
 * [data-testid="toolbar-explorer"] (owned by the toolbar, same convention
 * as DocumentsPanelComponent's own toggle), panel root at
 * [data-testid="explorer-panel"], an "Open Folder" button at
 * [data-testid="explorer-open-folder"], a "Reconnect to <folder>" button at
 * [data-testid="explorer-reconnect"], and one
 * [data-testid="file-tree-node"] per tree row (root folder included), each
 * carrying a data-name attribute and, for directories only, a nested
 * [data-testid="file-tree-node-chevron"]. Commands are exposed from the
 * shared text context menu after right-clicking a row or the tree background.
 */
export class ExplorerPanelComponent {
  readonly root: Locator;
  readonly toggle: Locator;
  readonly openFolderButton: Locator;
  readonly reconnectButton: Locator;
  /** The panel's own app-error-banner, rendered with role="alert" whenever errorMessage() is set. */
  readonly errorBanner: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'explorer-panel');
    this.toggle = byTestId(page, 'toolbar-explorer');
    this.openFolderButton = byTestId(page, 'explorer-open-folder');
    this.reconnectButton = byTestId(page, 'explorer-reconnect');
    this.errorBanner = this.root.locator('[role="alert"]');
  }

  /** Opens the Explorer panel via its toolbar rail icon. */
  async open(): Promise<void> {
    if (!(await this.root.isVisible())) {
      await this.toggle.click();
    }
    await expect(this.root).toBeVisible();
  }

  /**
   * Clicks "Open Folder" -- only meaningful once a fake picker has been
   * installed via installFakeDirectoryPicker (see ../../utils/opfs-fixture),
   * since this button otherwise invokes the real native OS directory
   * picker dialog.
   */
  async openFolder(): Promise<void> {
    await this.openFolderButton.click();
  }

  /** Clicks "Reconnect to <folder>" to re-request permission for a restored root handle. */
  async reconnect(): Promise<void> {
    await this.reconnectButton.click();
  }

  /** Locator for a single tree row (root folder or any descendant) by its exact entry name. */
  row(name: string): Locator {
    return this.root.locator(`[data-testid="file-tree-node"][data-name="${name}"]`);
  }

  /** Expands or collapses a directory row by clicking its chevron. */
  async toggleExpand(name: string): Promise<void> {
    await this.row(name).locator('[data-testid="file-tree-node-chevron"]').click();
  }

  /** Clicks a file row, opening its content into the editor. */
  async openFile(name: string): Promise<void> {
    await this.row(name).click();
  }

  /** Whether the given directory row is currently expanded. */
  async isExpanded(name: string): Promise<boolean> {
    return (await this.row(name).getAttribute('aria-expanded')) === 'true';
  }

  /**
   * Whether the given row is currently showing its own per-row loading
   * spinner -- used to distinguish a real (first-time) disk read from a
   * cached re-expand, which never shows this.
   */
  async isRowLoading(name: string): Promise<boolean> {
    return (await this.row(name).locator('[data-testid="file-tree-node-spinner"]').count()) > 0;
  }

  /** Reads the name of the currently-open root folder (the first/root tree row's own name). */
  async getOpenFolderName(): Promise<string> {
    return (await this.root.locator('[data-testid="file-tree-node"]').first().getAttribute('data-name')) ?? '';
  }

  /**
   * Creates a new file inside the directory row named `rowName` through its
   * context-menu command.
   */
  async newFile(rowName: string, entryName: string): Promise<void> {
    await this.runPromptCommand(this.row(rowName), 'new-file', entryName);
  }

  /** Creates a new subdirectory inside the directory row named `rowName`. Analogous to newFile above. */
  async newFolder(rowName: string, entryName: string): Promise<void> {
    await this.runPromptCommand(this.row(rowName), 'new-folder', entryName);
  }

  /**
   * Deletes the row named `rowName` through its context-menu command,
   * accepting (the default) or dismissing depending on `options.accept`.
   */
  async deleteEntry(rowName: string, options?: { accept?: boolean }): Promise<void> {
    const accept = options?.accept ?? true;
    await this.runConfirmCommand(this.row(rowName), 'delete', accept);
  }

  private async runContextCommand(target: Locator, command: string): Promise<void> {
    const page = this.root.page();
    await target.click({ button: 'right' });
    const menu = byTestId(page, 'tree-context-menu');
    await expect(menu).toBeVisible();
    await menu.locator(`[data-command="${command}"]`).dispatchEvent('click');
  }

  private async runPromptCommand(target: Locator, command: string, value: string): Promise<void> {
    const page = this.root.page();
    await page.evaluate((answer) => {
      window.prompt = () => answer;
    }, value);
    await this.runContextCommand(target, command);
  }

  private async runConfirmCommand(target: Locator, command: string, answer: boolean): Promise<void> {
    const page = this.root.page();
    await page.evaluate((shouldConfirm) => {
      window.confirm = () => shouldConfirm;
    }, answer);
    await this.runContextCommand(target, command);
  }
}
