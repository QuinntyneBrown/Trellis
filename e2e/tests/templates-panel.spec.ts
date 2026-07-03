import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';

/**
 * D-011: the Templates rail icon opens a Templates explorer SIDE PANEL
 * (like Documents) instead of the old pop-out picker. Written with raw
 * testids (before the POM exists) and confirmed red against the pop-out
 * implementation.
 */
test.describe('templates side panel', () => {
  test('the rail icon opens the panel, seeded templates are listed, and applying keeps the panel open', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // The Templates rail button is a panel toggle with the active state.
    const toggle = byTestId(page, 'templates-panel-toggle');
    await toggle.click();
    await expect(byTestId(page, 'templates-panel')).toBeVisible();
    await expect(toggle).toHaveClass(/rail-button--active/);

    // The six starters are seeded rows.
    const sequenceRow = page.locator('[data-testid="template-item"][data-template-name="Sequence Diagram"]');
    await expect(sequenceRow).toBeVisible();

    // Applying a template loads its content into the editor -- and unlike
    // the old pop-out, the panel STAYS open.
    await sequenceRow.click();
    await expect.poll(async () => await editorPage.editor.getValue()).toContain('@startuml');
    await expect(byTestId(page, 'templates-panel')).toBeVisible();
    await expect(toggle).toHaveClass(/rail-button--active/);
  });
});
