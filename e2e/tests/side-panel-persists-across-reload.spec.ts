import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

const DIAGRAM = ['@startuml', 'Alice -> Bob : persist me', '@enduml'].join('\n');

/**
 * Regression test for D-005: the open side panel must survive a browser
 * refresh. The pane sizes already persist across reloads via
 * EditorLayoutPreferencesService; the Documents/Explorer panel choice is
 * part of the same layout and losing it on refresh reads as the UI
 * breaking -- especially right after opening a document, when the panel
 * (kept open since D-004) silently vanishes.
 */
test.describe('side panel persists across reload', () => {
  test('the Documents panel stays open, with the active document still marked, after a refresh', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const documentName = uniqueDocumentName(testInfo, 'persist');
    let documentSaved = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Save a document, then open it from the Documents panel.
      await editorPage.editor.replaceAllText(DIAGRAM);
      await editorPage.toolbar.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentSaved = true;

      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.openDocument(documentName);
      await expect(editorPage.documentsPanel.root).toBeVisible();
      await editorPage.documentsPanel.expectDocumentActive(documentName);

      // Refresh the browser: the whole layout must come back as it was.
      await page.reload();
      await editorPage.waitForAppReady();

      // The document itself reloads from the URL...
      await expect
        .poll(async () => normalizeEol(await editorPage.editor.getValue()))
        .toBe(DIAGRAM);

      // ...and the Documents panel is still open with the same document
      // marked active (D-005: this is what used to break).
      await expect(editorPage.documentsPanel.root).toBeVisible();
      await editorPage.documentsPanel.expectDocumentActive(documentName);
    } finally {
      if (documentSaved) {
        try {
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteDocument(documentName);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });
});
