import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

const DIAGRAM = ['@startuml', 'Alice -> Bob : render me', '@enduml'].join('\n');

/**
 * Regression test for D-006: refreshing the browser on a document URL must
 * leave the preview showing the rendered diagram, not an error.
 *
 * The failure mode is a startup race: the route-driven document fetch
 * resolves before the SignalR hub connection has finished starting, so the
 * automatic render of the loaded content used to be invoked against a
 * not-yet-connected hub and surface as a render error -- which then sat in
 * the preview until the user manually pressed Ctrl+Enter.
 */
test.describe('preview renders after reload', () => {
  test('reloading a document URL auto-renders the diagram without an error and without a manual Ctrl+Enter', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const documentName = uniqueDocumentName(testInfo, 'reload-render');
    let documentSaved = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      await editorPage.editor.replaceAllText(DIAGRAM);
      await editorPage.toolbar.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentSaved = true;

      // Refresh on the /editor/{id} URL the save just established.
      await page.reload();
      await editorPage.waitForAppReady();

      // The loaded document auto-renders: a result must arrive on its own...
      await expect
        .poll(() => editorPage.preview.getRenderSequence(), { timeout: 15_000 })
        .toBeGreaterThan(0);

      // ...and it must be the rendered diagram, not the D-006 connection
      // error that used to require a manual Ctrl+Enter to clear.
      expect(await editorPage.preview.isErrorVisible()).toBe(false);
      expect(await editorPage.preview.getRenderedFingerprint()).not.toBe('');
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
