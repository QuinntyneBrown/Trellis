import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

const DIAGRAM = ['@startuml', 'Alice -> Bob : hello', '@enduml'].join('\n');
const DIAGRAM_EDITED = [
  '@startuml',
  'Alice -> Bob : hello',
  'Bob --> Alice : quick-saved via Ctrl+S',
  '@enduml',
].join('\n');

test.describe('save with Ctrl+S', () => {
  test('Ctrl+S quick-saves an already-saved document without opening the save dialog', async ({
    page,
  }, testInfo) => {
    const documentName = uniqueDocumentName(testInfo, 'ctrl-s-quicksave');
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // Establish a real documentId first via the normal toolbar/dialog save
    // flow -- Ctrl+S's quick-save behavior only applies once a document has
    // already been saved at least once.
    await editorPage.editor.replaceAllText(DIAGRAM);
    await editorPage.toolbar.openSaveDialog();
    await expect(editorPage.saveDialog.root).toBeVisible();
    await editorPage.saveDialog.typeName(documentName);
    await editorPage.saveDialog.confirmSave();
    await expect(editorPage.saveDialog.root).toBeHidden();

    // A further edit, then a quick-save via Ctrl+S -- must NOT reopen the
    // save dialog, unlike the very first save above.
    await editorPage.editor.replaceAllText(DIAGRAM_EDITED);
    await page.keyboard.press('Control+s');

    await expect(editorPage.saveDialog.root).toBeHidden();
    // Give the quick-save request a real chance to (incorrectly) pop the
    // dialog open before asserting it never did.
    await page.waitForTimeout(500);
    await expect(editorPage.saveDialog.root).toBeHidden();

    // Confirm the edit was actually persisted server-side (not just held in
    // local editor state): clear the editor locally, then reopen the same
    // document from the documents panel and confirm the restored content
    // matches the post-Ctrl+S edit, proving a genuine round trip.
    await editorPage.editor.replaceAllText('');
    expect((await editorPage.editor.getValue()).trim()).toBe('');

    await editorPage.documentsPanel.open();
    await editorPage.documentsPanel.expectDocumentListed(documentName);
    await editorPage.documentsPanel.openDocument(documentName);

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(DIAGRAM_EDITED);
  });

  test('Ctrl+S opens the save dialog for a brand-new, never-saved document', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await expect(editorPage.saveDialog.root).toBeHidden();

    await editorPage.editor.replaceAllText(DIAGRAM);
    await page.keyboard.press('Control+s');

    // With no documentId yet, there is no name to quick-save with, so
    // Ctrl+S falls back to the same save dialog the toolbar's Save button
    // opens -- it must not silently no-op or throw.
    await expect(editorPage.saveDialog.root).toBeVisible();
  });
});
