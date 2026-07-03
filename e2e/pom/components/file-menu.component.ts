import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the title bar's File menu (D-012): trigger at
 * [data-testid="title-bar-menu-file"], dropdown items at
 * [data-testid="title-bar-menu-item-new" | "-save" | "-upload"]. The menu
 * closes after every item click.
 */
export class FileMenuComponent {
  readonly trigger: Locator;
  readonly newItem: Locator;
  readonly saveItem: Locator;
  readonly uploadItem: Locator;

  constructor(page: Page) {
    this.trigger = byTestId(page, 'title-bar-menu-file');
    this.newItem = byTestId(page, 'title-bar-menu-item-new');
    this.saveItem = byTestId(page, 'title-bar-menu-item-save');
    this.uploadItem = byTestId(page, 'title-bar-menu-item-upload');
  }

  /** Opens the File menu. */
  async open(): Promise<void> {
    await this.trigger.click();
    await expect(this.saveItem).toBeVisible();
  }

  /** File > New. */
  async clickNew(): Promise<void> {
    await this.open();
    await this.newItem.click();
  }

  /** File > Save -- a silent disk write for disk-backed files, otherwise the save dialog. */
  async clickSave(): Promise<void> {
    await this.open();
    await this.saveItem.click();
  }

  /** File > Save for a document that needs naming: opens the save dialog. */
  async openSaveDialog(): Promise<void> {
    await this.clickSave();
  }

  /** File > Upload -- opens the native file chooser via the hidden input. */
  async clickUpload(): Promise<void> {
    await this.open();
    await this.uploadItem.click();
  }
}
