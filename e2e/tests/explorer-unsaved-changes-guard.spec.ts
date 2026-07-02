import { Page, test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { openExplorerWithTree } from '../utils/opfs-fixture';
import { normalizeEol } from '../utils/normalize-eol';

const CONTENT_A = ['@startuml', 'A -> B : first file', '@enduml'].join('\n');
const CONTENT_B = ['@startuml', 'C -> D : second file', '@enduml'].join('\n');
const UNSAVED_EDIT = ['@startuml', 'A -> B : first file', 'B --> A : not yet saved', '@enduml'].join('\n');

/**
 * The app uses a native `window.confirm` dialog rather than an in-DOM
 * affordance, so these tests handle Playwright `dialog` events rather than
 * querying for an inline confirmation element. The decline test awaits the
 * dialog explicitly (waitForEvent registered BEFORE the click) so it fails
 * loudly if the confirm guard is ever removed -- window.confirm returns
 * synchronously, so once the dialog has been dismissed the decline path has
 * already run and the content can be asserted immediately, no sleep needed.
 */
test.describe('unsaved-changes guard when opening a different Explorer file', () => {
  async function setUpWithUnsavedEdit(page: Page): Promise<EditorPage> {
    const editorPage = await openExplorerWithTree(page, { 'a.puml': CONTENT_A, 'b.puml': CONTENT_B });
    await editorPage.explorerPanel.openFile('a.puml');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(CONTENT_A);

    await editorPage.editor.replaceAllText(UNSAVED_EDIT);
    return editorPage;
  }

  test('declining the confirm dialog keeps the unsaved content untouched', async ({ page }) => {
    const editorPage = await setUpWithUnsavedEdit(page);

    // Registered before the click; once pending, the dialog MUST be handled
    // (as it is below) or later page.evaluate calls would hang.
    const dialogPromise = page.waitForEvent('dialog');
    await editorPage.explorerPanel.openFile('b.puml');
    await (await dialogPromise).dismiss();

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
