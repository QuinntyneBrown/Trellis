import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * The rail buttons reveal their tooltips on hover (RailButtonComponent's
 * opacity/visibility mechanism). Targets the panel toggles -- the rail's
 * remaining buttons since New/Save/Upload moved into the File menu (D-012).
 */
test.describe('rail button tooltips', () => {
  test('hovering a rail toggle reveals its tooltip; unhovered tooltips stay hidden', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const documentsTooltip = editorPage.toolbar.tooltipFor(editorPage.toolbar.documentsPanelToggle);
    const templatesTooltip = editorPage.toolbar.tooltipFor(editorPage.toolbar.templatesPanelToggle);

    await expect(documentsTooltip).toBeHidden();
    await expect(templatesTooltip).toBeHidden();

    await editorPage.toolbar.documentsPanelToggle.hover();
    await expect(documentsTooltip).toBeVisible();
    await expect(documentsTooltip).toHaveText('Documents');
    await expect(templatesTooltip).toBeHidden();

    await editorPage.toolbar.templatesPanelToggle.hover();
    await expect(templatesTooltip).toBeVisible();
    await expect(templatesTooltip).toHaveText('Templates');
  });
});
