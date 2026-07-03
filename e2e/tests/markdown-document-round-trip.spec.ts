import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';
import { uniqueDocumentName } from '../utils/unique-name';

const MARKDOWN = ['# Hello Markdown', '', 'A **bold** claim and a list:', '', '- alpha', '- beta'].join('\n');

/**
 * D-010: documents can be Markdown as well as PlantUML. A markdown document
 * is created via the save dialog's Type select, renders as prose in the
 * preview through the same pipeline behaviors PlantUML enjoys (Ctrl+Enter,
 * and auto-render after a reload with NO manual re-render), and carries an
 * MD badge in the Documents panel tree.
 */
test.describe('markdown document round trip', () => {
  test('create via Type select, render as prose, auto-render after reload, MD badge in the tree', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const documentName = uniqueDocumentName(testInfo, 'md-doc');
    let documentSaved = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      await editorPage.editor.replaceAllText(MARKDOWN);

      // The save dialog offers a Type select for new documents; pick Markdown.
      await editorPage.fileMenu.openSaveDialog();
      await expect(editorPage.saveDialog.kindSelect).toBeVisible();
      await editorPage.saveDialog.selectKind('markdown');
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentSaved = true;

      // Ctrl+Enter renders the markdown as prose -- an <h1>, not an error.
      const seqBefore = await editorPage.preview.getRenderSequence();
      await editorPage.editor.pressRender();
      await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(seqBefore);
      expect(await editorPage.preview.isErrorVisible()).toBe(false);
      const markdownPane = byTestId(page, 'preview-markdown');
      await expect(markdownPane).toBeVisible();
      await expect(markdownPane.locator('h1')).toHaveText('Hello Markdown');

      // Reload on /editor/{id}: the markdown auto-renders with NO manual
      // Ctrl+Enter -- the same D-006 parity PlantUML documents have.
      await page.reload();
      await editorPage.waitForAppReady();
      await expect
        .poll(() => editorPage.preview.getRenderSequence(), { timeout: 15_000 })
        .toBeGreaterThan(0);
      expect(await editorPage.preview.isErrorVisible()).toBe(false);
      await expect(byTestId(page, 'preview-markdown').locator('h1')).toHaveText('Hello Markdown');

      // The Documents panel marks the document as markdown.
      if (!(await editorPage.documentsPanel.root.isVisible())) {
        await editorPage.documentsPanel.open();
      }
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      await expect(
        editorPage.documentsPanel.item(documentName).locator('[data-testid="document-kind-badge"]'),
      ).toBeVisible();
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
