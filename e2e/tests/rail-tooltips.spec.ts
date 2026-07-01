import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * The toolbar was redesigned into a VS Code-style vertical icon rail:
 * every rail button (RailButtonComponent) reveals a tooltip on
 * hover/focus whose text is exactly the button's label, with a
 * parenthetical keyboard shortcut appended when one exists. Save is the
 * one rail button with a shortcut (Ctrl+S); New has none.
 */
test.describe('rail button tooltips', () => {
  test('Save shows its keyboard shortcut and New shows a plain label', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const saveTooltip = editorPage.toolbar.tooltipFor(editorPage.toolbar.saveButton);
    const newTooltip = editorPage.toolbar.tooltipFor(editorPage.toolbar.newButton);

    // Neither tooltip is visible before either button is hovered.
    await expect(saveTooltip).toBeHidden();
    await expect(newTooltip).toBeHidden();

    await editorPage.toolbar.saveButton.hover();
    await expect(saveTooltip).toBeVisible();
    await expect(saveTooltip).toHaveText('Save (Ctrl+S)');

    await editorPage.toolbar.newButton.hover();
    await expect(newTooltip).toBeVisible();
    await expect(newTooltip).toHaveText('New');
  });
});
