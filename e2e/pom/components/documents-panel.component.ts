import { Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the saved-documents panel:
 * toggle at [data-testid="documents-panel-toggle"] (owned by the
 * toolbar), panel root at [data-testid="documents-panel"], and one
 * [data-testid="document-item"] per document, each carrying a
 * data-document-name attribute and nested
 * [data-testid="document-item-open" | "document-item-delete" | "document-item-rename"]
 * action buttons scoped within that item.
 *
 * INTEGRATION NOTE: the shared contract does not define a data-testid
 * for whatever confirmation surface appears when deleting/renaming
 * (only for the buttons that trigger those actions). The real
 * implementation uses native `window.confirm` / `window.prompt`
 * dialogs rather than an inline DOM affordance, so `deleteDocument`
 * and `renameDocument` below register a one-shot Playwright `dialog`
 * handler (which otherwise auto-dismisses with no listener attached,
 * silently no-op'ing the action) instead of querying for an in-row
 * `<input>`.
 */
export class DocumentsPanelComponent {
  readonly root: Locator;
  readonly toggle: Locator;

  constructor(page: Page) {
    this.root = byTestId(page, 'documents-panel');
    this.toggle = byTestId(page, 'documents-panel-toggle');
  }

  /** Opens the documents panel via its toolbar toggle. */
  async open(): Promise<void> {
    await this.toggle.click();
    await expect(this.root).toBeVisible();
  }

  /** Locator for a single document-item row by its exact document name. */
  item(name: string): Locator {
    return this.root.locator(
      `[data-testid="document-item"][data-document-name="${name}"]`
    );
  }

  /** Asserts a document with the given name is listed in the panel. */
  async expectDocumentListed(name: string): Promise<void> {
    await expect(this.item(name)).toBeVisible();
  }

  /** Asserts a document with the given name is NOT listed in the panel. */
  async expectDocumentNotListed(name: string): Promise<void> {
    await expect(this.item(name)).toHaveCount(0);
  }

  /** Clicks the "open" action for the document with the given name. */
  async openDocument(name: string): Promise<void> {
    const row = this.item(name);
    await byTestId(row, 'document-item-open').click();
  }

  /**
   * Clicks the "delete" action for the document with the given name and
   * accepts the native `window.confirm` dialog it triggers. See the
   * class-level INTEGRATION NOTE above.
   */
  async deleteDocument(name: string): Promise<void> {
    const row = this.item(name);
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept());
    await byTestId(row, 'document-item-delete').click();
  }

  /**
   * Renames the document currently named `oldName` to `newName` by
   * accepting the native `window.prompt` dialog triggered by
   * document-item-rename with the new name. See the class-level
   * INTEGRATION NOTE above.
   */
  async renameDocument(oldName: string, newName: string): Promise<void> {
    const row = this.item(oldName);
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(newName));
    await byTestId(row, 'document-item-rename').click();
  }
}
