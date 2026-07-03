import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

const NBSP_INDENT = '    ';

/**
 * Regression test for D-009: refreshing while editing a document that lives
 * inside a NESTED folder must bring the Documents panel back with that
 * document's ancestor folders expanded, so the active row (D-004 highlight)
 * is actually visible -- the VS Code reveal-active-file idiom. Expansion
 * state used to start empty after a reload, leaving the active document
 * hidden inside collapsed folders.
 */
test.describe('reveal the active document after reload', () => {
  test('the nested folder chain is expanded and the active row visible after a refresh', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const parentName = uniqueDocumentName(testInfo, 'reveal-parent');
    const childName = uniqueDocumentName(testInfo, 'reveal-child');
    const documentName = uniqueDocumentName(testInfo, 'reveal-doc');
    let parentExists = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Nested destination: parent folder with a subfolder inside.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(parentName);
      parentExists = true;
      await editorPage.documentsPanel.createSubfolder(parentName, childName);
      await editorPage.documentsPanel.expectFolderListed(childName);

      // Save the document straight into the nested subfolder (its option
      // label is nbsp-indented one level in the save dialog's select).
      await editorPage.editor.replaceAllText('@startuml\nAlice -> Bob : reveal\n@enduml');
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.selectFolder(`${NBSP_INDENT}${childName}`);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // Refresh: the panel comes back open (D-005) and must have expanded
      // the parent AND child folders so the active document row is visible
      // and highlighted -- collapsed folders don't render children at all,
      // so visibility of the row IS the proof of the reveal.
      await page.reload();
      await editorPage.waitForAppReady();

      await expect(editorPage.documentsPanel.root).toBeVisible();
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      await editorPage.documentsPanel.expectDocumentActive(documentName);
      await expect(editorPage.documentsPanel.folder(parentName)).toHaveAttribute('aria-expanded', 'true');
      await expect(editorPage.documentsPanel.folder(childName)).toHaveAttribute('aria-expanded', 'true');
    } finally {
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        if (parentExists) {
          // Deleting the parent cascades to the subfolder and the document.
          await editorPage.documentsPanel.deleteFolder(parentName);
        }
      } catch {
        // Best-effort cleanup only; never mask the original test result.
      }
    }
  });
});
