import { test, expect } from '@playwright/test';
import { openExplorerWithTree, readOpfsFile } from '../utils/opfs-fixture';
import { normalizeEol } from '../utils/normalize-eol';

const ORIGINAL_CONTENT = ['@startuml', 'Alice -> Bob : hello', '@enduml'].join('\n');
const EDITED_CONTENT = [
  '@startuml',
  'Alice -> Bob : hello',
  'Bob --> Alice : saved straight to disk via Ctrl+S',
  '@enduml',
].join('\n');

test.describe('editing and saving an Explorer-opened file', () => {
  test('Ctrl+S writes the edited content straight back to the real (OPFS) file, with no dialog', async ({
    page,
  }) => {
    const editorPage = await openExplorerWithTree(page, { 'diagram.puml': ORIGINAL_CONTENT });
    await editorPage.explorerPanel.openFile('diagram.puml');

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(ORIGINAL_CONTENT);

    await editorPage.editor.replaceAllText(EDITED_CONTENT);

    // No save dialog exists to interact with for a disk-backed file --
    // Ctrl+S must silently write directly to the open handle.
    await expect(editorPage.saveDialog.root).toBeHidden();
    await page.keyboard.press('Control+s');
    await expect(editorPage.saveDialog.root).toBeHidden();

    // Prove a REAL disk write happened by re-reading the same OPFS file
    // directly, entirely bypassing the app.
    await expect
      .poll(async () => normalizeEol(await readOpfsFile(page, 'diagram.puml')))
      .toBe(EDITED_CONTENT);
  });

  test('clicking the Save toolbar button also writes straight to disk with no dialog', async ({ page }) => {
    const editorPage = await openExplorerWithTree(page, { 'diagram.puml': ORIGINAL_CONTENT });
    await editorPage.explorerPanel.openFile('diagram.puml');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(ORIGINAL_CONTENT);

    await editorPage.editor.replaceAllText(EDITED_CONTENT);
    await editorPage.toolbar.saveButton.click();

    await expect(editorPage.saveDialog.root).toBeHidden();
    await expect
      .poll(async () => normalizeEol(await readOpfsFile(page, 'diagram.puml')))
      .toBe(EDITED_CONTENT);
  });
});
