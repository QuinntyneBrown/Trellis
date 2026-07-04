import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

const DIAGRAM = ['@startuml', 'Alice -> Bob : scoped', '@enduml'].join('\n');

/**
 * The Documents panel can be scoped to a single folder: that folder becomes
 * the tree's temporary root (only its subtree renders), a scope bar names it
 * with up/clear affordances, and the scope persists across reloads like the
 * rest of the panel layout.
 */
test.describe('scoping the Documents panel to a folder', () => {
  test('scoping shows only the folder subtree, with working up and clear affordances', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderA = uniqueDocumentName(testInfo, 'scopeA');
    const folderB = uniqueDocumentName(testInfo, 'scopeB');
    const documentName = uniqueDocumentName(testInfo, 'scoped-doc');
    let documentSaved = false;
    let foldersCreated = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Two root folders and a document that lives inside the first.
      await editorPage.editor.replaceAllText(DIAGRAM);
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentSaved = true;

      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderA);
      await editorPage.documentsPanel.expectFolderListed(folderA);
      await editorPage.documentsPanel.createRootFolder(folderB);
      await editorPage.documentsPanel.expectFolderListed(folderB);
      foldersCreated = true;
      await editorPage.documentsPanel.moveDocumentViaDialog(documentName, folderA);

      // Scoped to A: its contents are the whole visible tree; B disappears.
      await editorPage.documentsPanel.scopeToFolder(folderA);
      await editorPage.documentsPanel.expectScopedTo(folderA);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      await editorPage.documentsPanel.expectFolderNotListed(folderB);

      // A sits at the root, so Up clears the scope and everything returns.
      await editorPage.documentsPanel.scopeUp();
      await editorPage.documentsPanel.expectNotScoped();
      await editorPage.documentsPanel.expectFolderListed(folderB);

      // Clear does the same from the dedicated button, and the just-left
      // folder stays expanded so its document remains visible.
      await editorPage.documentsPanel.scopeToFolder(folderA);
      await editorPage.documentsPanel.clearScope();
      await editorPage.documentsPanel.expectFolderListed(folderB);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
    } finally {
      // Best-effort cleanup only; never mask the original test result.
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        if (await editorPage.documentsPanel.scopeBar.isVisible()) {
          await editorPage.documentsPanel.clearScope();
        }
        if (foldersCreated) {
          // Deleting A cascades to the document moved inside it.
          await editorPage.documentsPanel.deleteFolder(folderA);
          await editorPage.documentsPanel.deleteFolder(folderB);
        } else if (documentSaved) {
          await editorPage.documentsPanel.deleteDocument(documentName);
        }
      } catch {
        // Best-effort cleanup only.
      }
    }
  });

  test('the scope persists across a reload', async ({ page }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderA = uniqueDocumentName(testInfo, 'scopeA');
    const folderB = uniqueDocumentName(testInfo, 'scopeB');
    let foldersCreated = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderA);
      await editorPage.documentsPanel.expectFolderListed(folderA);
      await editorPage.documentsPanel.createRootFolder(folderB);
      await editorPage.documentsPanel.expectFolderListed(folderB);
      foldersCreated = true;

      await editorPage.documentsPanel.scopeToFolder(folderA);
      await editorPage.documentsPanel.expectScopedTo(folderA);

      // The panel itself already persists (D-005); the scope must ride along.
      await page.reload();
      await editorPage.waitForAppReady();

      await expect(editorPage.documentsPanel.root).toBeVisible();
      await editorPage.documentsPanel.expectScopedTo(folderA);
      await editorPage.documentsPanel.expectFolderNotListed(folderB);

      await editorPage.documentsPanel.clearScope();
      await editorPage.documentsPanel.expectFolderListed(folderB);
    } finally {
      // Best-effort cleanup only; never mask the original test result.
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        if (await editorPage.documentsPanel.scopeBar.isVisible()) {
          await editorPage.documentsPanel.clearScope();
        }
        if (foldersCreated) {
          await editorPage.documentsPanel.deleteFolder(folderA);
          await editorPage.documentsPanel.deleteFolder(folderB);
        }
      } catch {
        // Best-effort cleanup only.
      }
    }
  });
});
