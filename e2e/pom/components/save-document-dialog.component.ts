import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the save-document modal:
 * root at [data-testid="save-dialog"], name input at
 * [data-testid="save-dialog-name"], confirm button at
 * [data-testid="save-dialog-confirm"], cancel button at
 * [data-testid="save-dialog-cancel"].
 */
export class SaveDocumentDialogComponent {
  readonly root: Locator;
  readonly nameInput: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'save-dialog');
    this.nameInput = byTestId(page, 'save-dialog-name');
    this.confirmButton = byTestId(page, 'save-dialog-confirm');
    this.cancelButton = byTestId(page, 'save-dialog-cancel');
  }

  /** Clears the name field and types the given name. */
  async typeName(name: string): Promise<void> {
    await this.nameInput.fill('');
    await this.nameInput.fill(name);
  }

  /** Confirms the save. */
  async confirmSave(): Promise<void> {
    await this.confirmButton.click();
  }

  /** Cancels the dialog without saving. */
  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }
}
