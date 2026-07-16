import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the application (hamburger) menu at the top of the
 * activity rail, vscode.dev-style: hamburger trigger at
 * [data-testid="rail-hamburger"], File entry at
 * [data-testid="rail-menu-file"] whose submenu carries the commands at
 * [data-testid="rail-menu-item-new" | "-save" | "-upload"]. The whole menu
 * closes after every command click.
 */
export class FileMenuComponent {
  readonly hamburger: Locator;
  readonly fileEntry: Locator;
  readonly newItem: Locator;
  readonly saveItem: Locator;
  readonly uploadItem: Locator;

  constructor(page: Page) {
    this.hamburger = byTestId(page, 'rail-hamburger');
    this.fileEntry = byTestId(page, 'rail-menu-file');
    this.newItem = byTestId(page, 'rail-menu-item-new');
    this.saveItem = byTestId(page, 'rail-menu-item-save');
    this.uploadItem = byTestId(page, 'rail-menu-item-upload');
  }

  /** Opens the hamburger menu and expands the File submenu. */
  async open(): Promise<void> {
    await this.hamburger.click();
    await expect(this.fileEntry).toBeVisible();
    await this.fileEntry.click();
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
