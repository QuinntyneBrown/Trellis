import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * Bonus test beyond the required behaviors: renaming and deleting a
 * saved document updates and removes it from the documents panel. This
 * test creates its own document and is responsible for deleting it
 * again, via a try/finally best-effort cleanup, so repeated local runs
 * against a reused dev server (reuseExistingServer) stay tidy even if
 * an assertion above the cleanup step fails.
 */
test.describe('documents list management', () => {
  test('renaming and deleting a saved document updates and removes it from the panel', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const originalName = uniqueDocumentName(testInfo, 'original');
    const renamedName = uniqueDocumentName(testInfo, 'renamed');

    // Tracks whichever name currently exists on the server, so the
    // finally block below can clean up regardless of where the test
    // stopped.
    let nameToCleanUp: string | null = null;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      await editorPage.editor.replaceAllText(
        '@startuml\nAlice -> Bob : ping\n@enduml'
      );
      await editorPage.toolbar.openSaveDialog();
      await editorPage.saveDialog.typeName(originalName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      nameToCleanUp = originalName;

      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.expectDocumentListed(originalName);

      await editorPage.documentsPanel.renameDocument(originalName, renamedName);
      nameToCleanUp = renamedName;

      await editorPage.documentsPanel.expectDocumentListed(renamedName);
      await editorPage.documentsPanel.expectDocumentNotListed(originalName);

      await editorPage.documentsPanel.deleteDocument(renamedName);
      await editorPage.documentsPanel.expectDocumentNotListed(renamedName);
      nameToCleanUp = null;
    } finally {
      if (nameToCleanUp) {
        try {
          await editorPage.documentsPanel.open();
          await editorPage.documentsPanel.deleteDocument(nameToCleanUp);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });
});
