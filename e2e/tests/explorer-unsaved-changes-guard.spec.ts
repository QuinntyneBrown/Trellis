import { Page, test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { installFakeDirectoryPicker, seedOpfsFixtureTree } from '../utils/opfs-fixture';
import { normalizeEol } from '../utils/normalize-eol';

const CONTENT_A = ['@startuml', 'A -> B : first file', '@enduml'].join('\n');
const CONTENT_B = ['@startuml', 'C -> D : second file', '@enduml'].join('\n');
const UNSAVED_EDIT = ['@startuml', 'A -> B : first file', 'B --> A : not yet saved', '@enduml'].join('\n');

/**
 * Mirrors the exact confirm-dialog testing technique already used
 * elsewhere in this suite (see documents-panel.component.ts's
 * deleteDocument/renameDocument): the app uses a native `window.confirm`
 * dialog rather than an in-DOM affordance, so these tests register a
 * one-shot `page.once('dialog', ...)` handler rather than querying for an
 * inline confirmation element.
 */
test.describe('unsaved-changes guard when opening a different Explorer file', () => {
  async function setUpWithUnsavedEdit(page: Page): Promise<EditorPage> {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'a.puml': CONTENT_A, 'b.puml': CONTENT_B });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await editorPage.explorerPanel.openFile('a.puml');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(CONTENT_A);

    await editorPage.editor.replaceAllText(UNSAVED_EDIT);
    return editorPage;
  }

  test('declining the confirm dialog keeps the unsaved content untouched', async ({ page }) => {
    const editorPage = await setUpWithUnsavedEdit(page);

    page.once('dialog', (dialog) => void dialog.dismiss());
    await editorPage.explorerPanel.openFile('b.puml');

    // Give the (declined) confirm a real chance to have taken effect before
    // asserting the content survived.
    await page.waitForTimeout(300);
    expect(normalizeEol(await editorPage.editor.getValue())).toBe(UNSAVED_EDIT);
  });

  test('accepting the confirm dialog discards the unsaved edits and loads the newly-clicked file', async ({
    page,
  }) => {
    const editorPage = await setUpWithUnsavedEdit(page);

    page.once('dialog', (dialog) => void dialog.accept());
    await editorPage.explorerPanel.openFile('b.puml');

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(CONTENT_B);
  });
});
