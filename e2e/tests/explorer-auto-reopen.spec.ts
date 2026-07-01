import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { OPFS_ROOT_DIR_NAME, seedIndexedDbRootHandle, seedOpfsFixtureTree } from '../utils/opfs-fixture';

/**
 * Deliberately does NOT call installFakeDirectoryPicker anywhere in this
 * spec: the whole point is to prove the auto-reopen path never calls
 * pickDirectory()/window.showDirectoryPicker() at all. If it ever
 * regressed to do so, the real (unpatched) native picker dialog would open
 * and this test would hang/time out rather than silently passing.
 */
test.describe('auto-reopening a previously-picked folder on load', () => {
  test('a folder handle seeded directly into IndexedDB auto-reopens on reload, tree and all, without ever clicking Open Folder', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await seedIndexedDbRootHandle(page);
    await seedOpfsFixtureTree(page, { 'notes.puml': '@startuml\nnote "restored" as N\n@enduml' });

    await page.reload();
    await expect(editorPage.byTestId('editor-page')).toBeVisible();
    await editorPage.editor.waitForReady();

    await editorPage.explorerPanel.open();

    // The tree is already populated -- no "Open Folder" button was ever
    // needed, and no "Reconnect" prompt either (OPFS handles are always
    // already permission-granted).
    await expect(editorPage.explorerPanel.openFolderButton).toBeHidden();
    await expect(editorPage.explorerPanel.reconnectButton).toBeHidden();
    await expect(editorPage.explorerPanel.row('notes.puml')).toBeVisible();
    expect(await editorPage.explorerPanel.getOpenFolderName()).toBe(OPFS_ROOT_DIR_NAME);
  });
});
