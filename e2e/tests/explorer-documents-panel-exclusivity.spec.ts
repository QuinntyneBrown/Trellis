import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * Covers the unified activity-bar behavior shared by the Explorer and
 * Documents rail icons: they drive one exclusive activeSidePanel selection,
 * not two independently-toggleable panels that could ever be open
 * simultaneously.
 */
test.describe('Explorer/Documents activity-bar exclusivity', () => {
  test('opening Explorer then clicking Documents swaps the panel content and moves the selected-state indicator', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explorerPanel.open();
    await expect(editorPage.explorerPanel.root).toBeVisible();
    await expect(editorPage.explorerPanel.toggle).toHaveClass(/rail-button--active/);
    await expect(editorPage.documentsPanel.toggle).not.toHaveClass(/rail-button--active/);

    await editorPage.documentsPanel.open();

    // Documents is now showing, Explorer's own tree content is not.
    await expect(editorPage.documentsPanel.root).toBeVisible();
    await expect(editorPage.explorerPanel.root).toBeHidden();

    // The selected-state indicator moved from Explorer to Documents.
    await expect(editorPage.documentsPanel.toggle).toHaveClass(/rail-button--active/);
    await expect(editorPage.explorerPanel.toggle).not.toHaveClass(/rail-button--active/);
  });

  test('clicking the currently-active icon a second time collapses the panel back to closed', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explorerPanel.open();
    await expect(editorPage.explorerPanel.root).toBeVisible();

    await editorPage.explorerPanel.toggle.click();

    await expect(editorPage.explorerPanel.root).toBeHidden();
    await expect(editorPage.documentsPanel.root).toBeHidden();
    await expect(editorPage.explorerPanel.toggle).not.toHaveClass(/rail-button--active/);
  });
});
