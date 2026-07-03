import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * End-to-end pass over the Documents panel's virtual folder tree: create a
 * folder from the panel header, save a document into it via the save
 * dialog's destination select, prove the nesting (hidden while collapsed,
 * visible once expanded), rename the folder (expansion must survive, since
 * it is keyed by folder id, not name), and finally delete the folder --
 * whose cascade must take the contained document with it.
 *
 * The test creates its own folder and document; deleting the folder IS the
 * cleanup (the backend cascade removes the document), with a try/finally
 * best-effort fallback so repeated local runs against a reused dev server
 * stay tidy even if an assertion fails midway.
 */
test.describe('documents folder tree', () => {
  test('folders nest, expand, rename, and cascade-delete their documents', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderName = uniqueDocumentName(testInfo, 'folder');
    const renamedFolderName = uniqueDocumentName(testInfo, 'folder-renamed');
    const documentName = uniqueDocumentName(testInfo, 'doc');

    // Tracks whichever folder name currently exists on the server, so the
    // finally block can clean up (cascade included) wherever the test stopped.
    let folderToCleanUp: string | null = null;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Create a root folder from the panel header.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderName);
      await editorPage.documentsPanel.expectFolderListed(folderName);
      folderToCleanUp = folderName;

      // Collapse the panel again: open() toggles, and the panel only
      // refreshes its tree on the closed->open transition, so the reopen
      // after the save below must start from closed.
      await editorPage.documentsPanel.toggle.click();
      await expect(editorPage.documentsPanel.root).toBeHidden();

      // Save the editor's content into that folder via the dialog's select.
      await editorPage.editor.replaceAllText(
        '@startuml\nAlice -> Bob : filed\n@enduml'
      );
      await editorPage.toolbar.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.selectFolder(folderName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // The just-saved document is the active one, so opening the panel
      // auto-reveals it (D-009): its folder comes back expanded. Collapsing
      // hides the document; re-expanding reveals it again.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.expectFolderListed(folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      await editorPage.documentsPanel.toggleFolder(folderName);
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);
      await editorPage.documentsPanel.toggleFolder(folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      // Renaming the folder keeps it expanded (expansion is keyed by id),
      // so the document stays visible under the new name.
      await editorPage.documentsPanel.renameFolder(folderName, renamedFolderName);
      folderToCleanUp = renamedFolderName;
      await editorPage.documentsPanel.expectFolderListed(renamedFolderName);
      await editorPage.documentsPanel.expectFolderNotListed(folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      // Deleting the folder cascades to the document inside it.
      await editorPage.documentsPanel.deleteFolder(renamedFolderName);
      await editorPage.documentsPanel.expectFolderNotListed(renamedFolderName);
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);
      folderToCleanUp = null;
    } finally {
      if (folderToCleanUp) {
        try {
          // open() toggles, so only click it when the panel is actually
          // closed -- a mid-test failure can leave it open.
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteFolder(folderToCleanUp);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });
});
