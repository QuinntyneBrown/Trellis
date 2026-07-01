import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

test.describe('editor initial state', () => {
  test('loads with a blank editor, the placeholder preview, and eventually connects', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();

    // Blank editor: no content typed yet.
    await expect(editorPage.editor.root).toBeVisible();
    expect((await editorPage.editor.getValue()).trim()).toBe('');

    // Preview shows its placeholder, not an error, before any render.
    await expect(editorPage.preview.root).toBeVisible();
    expect(await editorPage.preview.isPlaceholderVisible()).toBe(true);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);

    // The render sequence has not advanced yet.
    expect(await editorPage.preview.getRenderSequence()).toBe(0);

    // The realtime connection eventually settles on 'connected'.
    await editorPage.waitForAppReady();
    expect(await editorPage.toolbar.getConnectionStatus()).toBe('connected');
  });
});
