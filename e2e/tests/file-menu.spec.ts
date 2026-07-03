import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';

/**
 * D-012: the title bar's File menu is functional — New, Save, and Upload
 * live there as commands (moved off the rail), with Alt+N and Ctrl+U
 * keyboard shortcuts. (Alt+N rather than Ctrl+N: browsers reserve Ctrl+N
 * at the browser level, so pages never receive it.) Written with raw
 * testids before the implementation exists — confirmed red.
 */
test.describe('File menu', () => {
  test('opens with New/Save/Upload commands, honest shortcut labels, and working actions', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // The File trigger opens a dropdown with the three commands.
    await byTestId(page, 'title-bar-menu-file').click();
    const newItem = byTestId(page, 'title-bar-menu-item-new');
    const saveItem = byTestId(page, 'title-bar-menu-item-save');
    const uploadItem = byTestId(page, 'title-bar-menu-item-upload');
    await expect(newItem).toBeVisible();
    await expect(saveItem).toBeVisible();
    await expect(uploadItem).toBeVisible();

    // Shortcut labels are honest: Alt+N (Ctrl+N is browser-reserved).
    await expect(newItem).toContainText('Alt+N');
    await expect(saveItem).toContainText('Ctrl+S');
    await expect(uploadItem).toContainText('Ctrl+U');

    // Clicking into the editor is an outside click -- the menu closes.
    await editorPage.editor.replaceAllText('@startuml\nA -> B\n@enduml');
    await expect(saveItem).toBeHidden();

    // File > Save opens the save dialog and the menu closes.
    await byTestId(page, 'title-bar-menu-file').click();
    await saveItem.click();
    await expect(byTestId(page, 'title-bar-menu-item-save')).toBeHidden();
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
