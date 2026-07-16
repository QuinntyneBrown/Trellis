import { Download, Locator, Page, expect } from '@playwright/test';
import { byTestId } from '../base.page';

/**
 * Component object for the saved-documents panel:
 * toggle at [data-testid="documents-panel-toggle"] (owned by the
 * toolbar), panel root at [data-testid="documents-panel"], and one
 * [data-testid="document-item"] per document, each carrying a
 * data-document-name attribute. Row actions are text commands in the shared
 * context menu opened by right-clicking a row.
 *
 * INTEGRATION NOTE: the shared contract does not define a data-testid
 * for whatever confirmation surface appears when deleting/renaming
 * (only for the buttons that trigger those actions). The real
 * implementation uses native `window.confirm` / `window.prompt`
 * dialogs rather than an inline DOM affordance. Chromium pauses the input
 * protocol while one opens from a context-menu click, so the helpers below
 * replace those native functions in the page before selecting the command.
 * This still drives the real right-click menu and application handlers while
 * keeping native browser UI outside the assertion surface.
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
    if (!(await this.root.isVisible())) {
      await this.toggle.click();
    }
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
    await this.runContextCommand(this.item(name), 'open');
  }

  /**
   * Asserts the given document row is marked as the one currently open in
   * the editor (aria-current, mirrored by the row's active highlight).
   */
  async expectDocumentActive(name: string): Promise<void> {
    await expect(this.item(name)).toHaveAttribute('aria-current', 'true');
  }

  /**
   * Clicks the "delete" action for the document with the given name and
   * accepts the native `window.confirm` dialog it triggers. See the
   * class-level INTEGRATION NOTE above.
   */
  async deleteDocument(name: string): Promise<void> {
    const row = this.item(name);
    await this.runConfirmCommand(row, 'delete', true);
  }

  /**
   * Renames the document currently named `oldName` to `newName` by
   * answering the native `window.prompt` dialog triggered by
   * document-item-rename with the new name. See the class-level
   * INTEGRATION NOTE above.
   */
  async renameDocument(oldName: string, newName: string): Promise<void> {
    const row = this.item(oldName);
    await this.runPromptCommand(row, 'rename', newName);
  }

  // ---- Virtual folder tree -------------------------------------------------
  // Folder rows live at [data-testid="document-folder"] with a
  // data-folder-name attribute. The tree background hosts root-level
  // commands. All folder
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
    await this.runPromptCommand(byTestId(this.root, 'documents-tree'), 'new-folder', name);
  }

  /**
   * Creates a subfolder inside the folder named `parentName` via its row's
   * New Folder button.
   */
  async createSubfolder(parentName: string, name: string): Promise<void> {
    const row = this.folder(parentName);
    await this.runPromptCommand(row, 'new-folder', name);
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
    await this.runPromptCommand(row, 'rename', newName);
  }

  /**
   * Deletes the folder with the given name, asserting the native confirm
   * actually carries the cascade warning ("...and everything inside it")
   * before accepting it -- deleting a folder deletes its contents too, and
   * the warning wording is part of the product contract.
   */
  async deleteFolder(name: string): Promise<void> {
    const row = this.folder(name);
    const message = await this.runConfirmCommand(row, 'delete', true);
    expect(message).toContain('and everything inside it');
  }

  /**
   * Exports a folder as markdown via the folder row's Export action and the
   * confirmation dialog it opens ([data-testid="export-folder-dialog"], with
   * an "include excluded documents" checkbox), returning the browser
   * Download the confirm triggers (the suite's first waitForEvent('download')
   * usage). Callers assert suggestedFilename() and read the content via
   * download.saveAs into testInfo.outputPath -- never a real Downloads
   * directory.
   */
  async exportFolder(name: string, options: { includeExcluded?: boolean } = {}): Promise<Download> {
    const page = this.root.page();
    await this.runContextCommand(this.folder(name), 'export');

    const dialog = byTestId(page, 'export-folder-dialog');
    await expect(dialog).toBeVisible();
    if (options.includeExcluded) {
      await byTestId(dialog, 'export-folder-dialog-include-excluded').check();
    }

    const downloadPromise = page.waitForEvent('download');
    await byTestId(dialog, 'export-folder-dialog-confirm').click();
    await expect(dialog).toBeHidden();
    return downloadPromise;
  }

  /**
   * Flips whether folder exports omit the document with the given name via
   * its row's toggle button. The excluded state surfaces as a
   * [data-testid="document-excluded-badge"] chip on the row.
   */
  async toggleExportExclusion(name: string): Promise<void> {
    await this.runContextCommand(this.item(name), 'toggle-export');
  }

  /** Asserts the document row carries the "no export" badge. */
  async expectDocumentExcludedFromExport(name: string): Promise<void> {
    await expect(byTestId(this.item(name), 'document-excluded-badge')).toBeVisible();
  }

  // ---- Scoping the tree to a folder -------------------------------------------
  // Any folder row can become the tree's temporary root via its
  // [data-testid="document-folder-scope"] button. While scoped, a
  // [data-testid="documents-scope-bar"] renders between the header and the
  // tree with [data-testid="documents-scope-name"] (carrying data-folder-name),
  // [data-testid="documents-scope-up"], and [data-testid="documents-scope-clear"].

  /** The scope bar shown only while the tree is scoped to a folder. */
  get scopeBar(): Locator {
    return byTestId(this.root, 'documents-scope-bar');
  }

  /** Scopes the tree to the folder with the given name via its row button. */
  async scopeToFolder(name: string): Promise<void> {
    await this.runContextCommand(this.folder(name), 'scope');
    await expect(this.scopeBar).toBeVisible();
  }

  /** Asserts the tree is currently scoped to the folder with the given name. */
  async expectScopedTo(name: string): Promise<void> {
    await expect(byTestId(this.root, 'documents-scope-name')).toHaveAttribute('data-folder-name', name);
  }

  /** Asserts no scope is active (the scope bar is absent). */
  async expectNotScoped(): Promise<void> {
    await expect(this.scopeBar).toHaveCount(0);
  }

  /** Scopes up one level via the scope bar (clears the scope when it sits at the root). */
  async scopeUp(): Promise<void> {
    await byTestId(this.scopeBar, 'documents-scope-up').click();
  }

  /** Clears the scope entirely via the scope bar's "Show all documents" button. */
  async clearScope(): Promise<void> {
    await byTestId(this.scopeBar, 'documents-scope-clear').click();
    await expect(this.scopeBar).toHaveCount(0);
  }

  // ---- Moving documents ------------------------------------------------------
  // Document rows are native HTML5 drag sources; folder rows and the tree
  // container ([data-testid="documents-tree"], whose empty space below the
  // last row is the move-to-root zone -- root of the scope while one is
  // active) are drop targets. Playwright's
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
    await this.runContextCommand(this.item(docName), 'move');

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

  private async runConfirmCommand(target: Locator, command: string, answer: boolean): Promise<string> {
    const page = this.root.page();
    await page.evaluate((shouldConfirm) => {
      (window as Window & { trellisContextConfirmMessage?: string }).trellisContextConfirmMessage = undefined;
      window.confirm = (message) => {
        (window as Window & { trellisContextConfirmMessage?: string }).trellisContextConfirmMessage = message;
        return shouldConfirm;
      };
    }, answer);
    await this.runContextCommand(target, command);
    await page.waitForFunction(() => {
      return (window as Window & { trellisContextConfirmMessage?: string }).trellisContextConfirmMessage !== undefined;
    });
    return page.evaluate(() => {
      return (window as Window & { trellisContextConfirmMessage?: string }).trellisContextConfirmMessage ?? '';
    });
  }
}
