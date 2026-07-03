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

  // ---- Virtual folder tree -------------------------------------------------
  // Folder rows live at [data-testid="document-folder"] with a
  // data-folder-name attribute and nested
  // [data-testid="document-folder-new-folder" | "document-folder-rename" |
  // "document-folder-delete"] action buttons; the panel header hosts the
  // root-level [data-testid="documents-new-folder"] button. All folder
  // create/rename/delete flows use the same native window.prompt/confirm
  // convention documented in the INTEGRATION NOTE above.

  /** Locator for a single folder row by its exact folder name. */
  folder(name: string): Locator {
    return this.root.locator(
      `[data-testid="document-folder"][data-folder-name="${name}"]`
    );
  }

  /** Asserts a folder with the given name is listed in the panel. */
  async expectFolderListed(name: string): Promise<void> {
    await expect(this.folder(name)).toBeVisible();
  }

  /** Asserts a folder with the given name is NOT listed in the panel. */
  async expectFolderNotListed(name: string): Promise<void> {
    await expect(this.folder(name)).toHaveCount(0);
  }

  /**
   * Creates a root-level folder via the panel header's New Folder button,
   * answering the native window.prompt with the given name.
   */
  async createRootFolder(name: string): Promise<void> {
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(name));
    await byTestId(this.root, 'documents-new-folder').click();
  }

  /**
   * Creates a subfolder inside the folder named `parentName` via its row's
   * New Folder button.
   */
  async createSubfolder(parentName: string, name: string): Promise<void> {
    const row = this.folder(parentName);
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(name));
    await byTestId(row, 'document-folder-new-folder').click();
  }

  /**
   * Expands or collapses a folder by clicking its chevron -- not the row
   * itself, whose center point can land on the row's action buttons at
   * narrow panel widths (the same idiom ExplorerPanelComponent.toggleExpand
   * uses).
   */
  async toggleFolder(name: string): Promise<void> {
    await this.folder(name).locator('[data-testid="document-folder-chevron"]').click();
  }

  /** Renames the folder currently named `oldName` to `newName` via its prompt. */
  async renameFolder(oldName: string, newName: string): Promise<void> {
    const row = this.folder(oldName);
    const page = this.root.page();
    page.once('dialog', (dialog) => void dialog.accept(newName));
    await byTestId(row, 'document-folder-rename').click();
  }

  /**
   * Deletes the folder with the given name, asserting the native confirm
   * actually carries the cascade warning ("...and everything inside it")
   * before accepting it -- deleting a folder deletes its contents too, and
   * the warning wording is part of the product contract.
   */
  async deleteFolder(name: string): Promise<void> {
    const row = this.folder(name);
    const page = this.root.page();
    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('and everything inside it');
      void dialog.accept();
    });
    await byTestId(row, 'document-folder-delete').click();
  }

  // ---- Moving documents ------------------------------------------------------
  // Document rows are native HTML5 drag sources; folder rows and the tree
  // container ([data-testid="documents-tree"], whose empty space below the
  // last row is the move-to-root zone) are drop targets. Playwright's
  // locator.dragTo drives Chromium's real drag pipeline, which is the only
  // configured browser project. If dragTo ever proves flaky, the documented
  // fallback is manual dispatch: create a DataTransfer via
  // page.evaluateHandle(() => new DataTransfer()) and dispatchEvent
  // 'dragstart'/'dragover'/'drop' with it.

  /** Drags the document row onto the folder row, moving the document into that folder. */
  async moveDocumentToFolder(docName: string, folderName: string): Promise<void> {
    await this.item(docName).dragTo(this.folder(folderName));
  }

  /**
   * Drags the document row onto the tree container's empty space below the
   * rows, moving the document to the root. Folder rows stopPropagation on
   * their drag events, so only genuinely-empty space reaches the root zone --
   * hence the explicit targetPosition near the container's bottom edge.
   */
  async moveDocumentToRoot(docName: string): Promise<void> {
    const tree = byTestId(this.root, 'documents-tree');
    const box = await tree.boundingBox();
    if (!box) {
      throw new Error('documents-tree is not visible');
    }
    await this.item(docName).dragTo(tree, {
      targetPosition: { x: Math.min(24, box.width / 2), y: box.height - 8 },
    });
  }

  /**
   * Moves a document via the keyboard-accessible "Move to Folder…" dialog:
   * opens it from the row's move button, picks the destination by folder
   * name (option labels are nbsp-indented per nesting level, so matching
   * strips that indentation), and confirms. Pass null to target the root
   * ("(No folder)").
   */
  async moveDocumentViaDialog(docName: string, folderName: string | null): Promise<void> {
    const page = this.root.page();
    await byTestId(this.item(docName), 'document-item-move').click();

    const dialog = byTestId(page, 'move-document-dialog');
    await expect(dialog).toBeVisible();

    const select = byTestId(dialog, 'move-document-dialog-folder');
    if (folderName === null) {
      await select.selectOption({ label: '(No folder)' });
    } else {
      const value = await select.evaluate((element, name) => {
        const options = Array.from((element as HTMLSelectElement).options);
        const match = options.find((option) => (option.textContent ?? '').replace(/\u00a0/g, '').trim() === name);
        return match?.value ?? null;
      }, folderName);
      if (value === null) {
        throw new Error(`No folder named "${folderName}" in the move dialog`);
      }
      await select.selectOption(value);
    }

    await byTestId(dialog, 'move-document-dialog-confirm').click();
    await expect(dialog).toBeHidden();
  }
}
