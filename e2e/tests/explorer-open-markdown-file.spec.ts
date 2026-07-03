import { test, expect } from '@playwright/test';
import { openExplorerWithTree } from '../utils/opfs-fixture';

const DISK_MARKDOWN = '# Hello from disk\n\n- item one\n- item two';

/**
 * D-010, requirement (2): a markdown file selected from the file explorer
 * renders in the preview just like PlantUML content does -- automatically on
 * open (no manual Ctrl+Enter), through the markdown pipeline (prose, not a
 * PlantUML syntax error), and re-renders on Ctrl+Enter after an edit.
 */
test.describe('opening a markdown file from the Explorer', () => {
  test('auto-renders the markdown as prose and re-renders on Ctrl+Enter', async ({ page }) => {
    const editorPage = await openExplorerWithTree(page, {
      'notes.md': DISK_MARKDOWN,
    });

    const seqBefore = await editorPage.preview.getRenderSequence();
    await editorPage.explorerPanel.openFile('notes.md');

    // The markdown auto-renders as prose -- an <h1>, not a render error.
    await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(seqBefore);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
    await expect(editorPage.preview.markdownPane()).toBeVisible();
    await expect(editorPage.preview.markdownPane().locator('h1')).toHaveText('Hello from disk');
    await expect(editorPage.preview.markdownPane().locator('li')).toHaveCount(2);

    // Editing and pressing Ctrl+Enter re-renders through the same pipeline.
    const seqAfterOpen = await editorPage.preview.getRenderSequence();
    await editorPage.editor.replaceAllText('# Edited heading');
    await editorPage.editor.pressRender();
    await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(seqAfterOpen);
    await expect(editorPage.preview.markdownPane().locator('h1')).toHaveText('Edited heading');
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
  });
});
