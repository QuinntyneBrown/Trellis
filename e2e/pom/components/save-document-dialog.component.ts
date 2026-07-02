import { Locator, Page } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the save-document modal:
 * root at [data-testid="save-dialog"], name input at
 * [data-testid="save-dialog-name"], destination-folder select at
 * [data-testid="save-dialog-folder"], confirm button at
 * [data-testid="save-dialog-confirm"], cancel button at
 * [data-testid="save-dialog-cancel"].
 */
export class SaveDocumentDialogComponent {
  readonly root: Locator;
  readonly nameInput: Locator;
  readonly folderSelect: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'save-dialog');
    this.nameInput = byTestId(page, 'save-dialog-name');
    this.folderSelect = byTestId(page, 'save-dialog-folder');
    this.confirmButton = byTestId(page, 'save-dialog-confirm');
    this.cancelButton = byTestId(page, 'save-dialog-cancel');
  }

  /** Clears the name field and types the given name. */
  async typeName(name: string): Promise<void> {
    await this.nameInput.fill('');
    await this.nameInput.fill(name);
  }

  /**
   * Picks the destination folder by its visible label. CAVEAT: nested
   * folders' option labels are nbsp-indented (four per depth level), so
   * label-matching is only clean for root-level folders -- select nested
   * ones by value (the folder id) if a test ever needs to.
   */
  async selectFolder(label: string): Promise<void> {
    await this.folderSelect.selectOption({ label });
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
