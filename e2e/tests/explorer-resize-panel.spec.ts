import { Page, test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

test.describe('resizing the Explorer/Documents side panel via the pixel divider', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Clears any width persisted by a previous test/run first, the same way
    // resize-editor-preview-panes.spec.ts already does for the ratio
    // divider's own persisted preference -- see that spec for why this is
    // NOT done via page.addInitScript(() => localStorage.clear()).
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('dragging the divider grows the side panel by roughly the drag amount, and the width survives a reload', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explorerPanel.open();

    const widthBefore = (await editorPage.explorerPanel.root.boundingBox())!.width;

    await editorPage.sidePanelDivider.dragBy(80);

    const widthAfterDrag = (await editorPage.explorerPanel.root.boundingBox())!.width;
    // Roughly matches the drag amount -- generous tolerance for rounding.
    expect(widthAfterDrag - widthBefore).toBeGreaterThan(50);
    expect(widthAfterDrag - widthBefore).toBeLessThan(110);

    await page.reload();
    await expect(editorPage.byTestId('editor-page')).toBeVisible();
    await editorPage.editor.waitForReady();

    // activeSidePanel itself isn't persisted (only the width is) -- reopen
    // the panel to observe the restored width.
    await editorPage.explorerPanel.open();

    const widthAfterReload = (await editorPage.explorerPanel.root.boundingBox())!.width;
    expect(Math.abs(widthAfterReload - widthAfterDrag)).toBeLessThan(5);
  });

  test('double-clicking the divider resets the panel back to its default width', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explorerPanel.open();

    const widthBefore = (await editorPage.explorerPanel.root.boundingBox())!.width;
    await editorPage.sidePanelDivider.dragBy(120);
    const widthAfterDrag = (await editorPage.explorerPanel.root.boundingBox())!.width;
    expect(Math.abs(widthAfterDrag - widthBefore)).toBeGreaterThan(20);

    await editorPage.sidePanelDivider.doubleClick();

    const widthAfterReset = (await editorPage.explorerPanel.root.boundingBox())!.width;
    // The default (260px) should be restored, well away from the dragged width.
    expect(Math.abs(widthAfterReset - widthAfterDrag)).toBeGreaterThan(20);
  });
});
