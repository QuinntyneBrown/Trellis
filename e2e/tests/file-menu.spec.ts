import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';

/**
 * The application menu lives behind the hamburger at the top of the
 * activity rail, vscode.dev-style: the hamburger opens a flyout with
 * File / Edit / View / Help entries, and File's submenu carries the New,
 * Save, and Upload commands (with Alt+N and Ctrl+U keyboard shortcuts;
 * Alt+N rather than Ctrl+N because browsers reserve Ctrl+N at the browser
 * level, so pages never receive it).
 */
test.describe('Application (hamburger) menu', () => {
  test('opens with File/Edit/View/Help entries, a File submenu with honest shortcut labels, and working actions', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // The hamburger opens the flyout with the four menu entries.
    const hamburger = byTestId(page, 'rail-hamburger');
    await hamburger.click();
    const fileEntry = byTestId(page, 'rail-menu-file');
    await expect(fileEntry).toBeVisible();
    await expect(page.locator('.editor-toolbar__menu-entry')).toHaveText([
      /File/,
      /Edit/,
      /View/,
      /Help/,
    ]);

    // Expanding File shows the three commands.
    await fileEntry.click();
    const newItem = byTestId(page, 'rail-menu-item-new');
    const saveItem = byTestId(page, 'rail-menu-item-save');
    const uploadItem = byTestId(page, 'rail-menu-item-upload');
    await expect(newItem).toBeVisible();
    await expect(saveItem).toBeVisible();
    await expect(uploadItem).toBeVisible();

    // Shortcut labels are honest: Alt+N (Ctrl+N is browser-reserved).
    await expect(newItem).toContainText('Alt+N');
    await expect(saveItem).toContainText('Ctrl+S');
    await expect(uploadItem).toContainText('Ctrl+U');

    // Clicking into the editor is an outside click -- the whole menu closes.
    await editorPage.editor.replaceAllText('@startuml\nA -> B\n@enduml');
    await expect(saveItem).toBeHidden();
    await expect(fileEntry).toBeHidden();

    // File > Save opens the save dialog and the menu closes.
    await hamburger.click();
    await fileEntry.click();
    await saveItem.click();
    await expect(byTestId(page, 'rail-menu-item-save')).toBeHidden();
    await expect(editorPage.saveDialog.root).toBeVisible();
    await editorPage.saveDialog.cancel();
    await expect(editorPage.saveDialog.root).toBeHidden();

    // Alt+N triggers New: the unsaved-changes confirm fires; accepting it
    // clears the editor.
    page.once('dialog', (dialog) => void dialog.accept());
    await page.keyboard.press('Alt+KeyN');
    await expect.poll(async () => (await editorPage.editor.getValue()).trim()).toBe('');

    // Ctrl+U triggers Upload: the hidden file input is clicked, which
    // surfaces as a native file chooser.
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Control+KeyU');
    const fileChooser = await fileChooserPromise;
    expect(fileChooser).toBeTruthy();
  });
});
