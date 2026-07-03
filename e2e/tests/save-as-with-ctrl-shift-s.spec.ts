import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

const ORIGINAL = ['@startuml', 'Alice -> Bob : original', '@enduml'].join('\n');

/**
 * Regression test for D-008: Ctrl+Shift+S is "Save As". It must ALWAYS open
 * the save dialog (name + destination folder) and confirming must always
 * create a NEW document -- never silently overwrite the open one, which is
 * exactly what used to happen: the keydown handler ignored the Shift
 * modifier, so with a document id present the template content quick-saved
 * over the open document.
 */
test.describe('Save As with Ctrl+Shift+S', () => {
  test('opens the name+folder dialog and saves a NEW document, leaving the original untouched', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const originalName = uniqueDocumentName(testInfo, 'save-as-original');
    const copyName = uniqueDocumentName(testInfo, 'save-as-copy');
    const cleanup: string[] = [];

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Save an original document so the editor holds a document id.
      await editorPage.editor.replaceAllText(ORIGINAL);
      await editorPage.toolbar.openSaveDialog();
      await editorPage.saveDialog.typeName(originalName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      cleanup.push(originalName);

      // Load a template over it -- the D-008 trap state. (No discard
      // confirm fires: the document was just saved, nothing is unsaved.)
      await editorPage.templatesPanel.open();
      await editorPage.templatesPanel.applyTemplate('Sequence Diagram');

      // Ctrl+Shift+S: the save dialog must appear, with the destination
      // folder select visible (Save As always creates a new document).
      await page.keyboard.press('Control+Shift+KeyS');
      await expect(editorPage.saveDialog.root).toBeVisible();
      await expect(editorPage.saveDialog.folderSelect).toBeVisible();

      await editorPage.saveDialog.typeName(copyName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      cleanup.push(copyName);

      // The copy is the now-open document (title bar tracks it)...
      await expect(page.locator('[data-testid="title-bar-title"]')).toHaveText(`${copyName} — Trellis`);

      // ...both documents exist, and the original's content is untouched.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.expectDocumentListed(originalName);
      await editorPage.documentsPanel.expectDocumentListed(copyName);

      await editorPage.documentsPanel.openDocument(originalName);
      await expect
        .poll(async () => normalizeEol(await editorPage.editor.getValue()))
        .toBe(ORIGINAL);
    } finally {
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        for (const name of cleanup) {
          await editorPage.documentsPanel.deleteDocument(name);
        }
      } catch {
        // Best-effort cleanup only; never mask the original test result.
      }
    }
  });
});
