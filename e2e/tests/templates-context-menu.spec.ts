import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * The templates panel's right-click context menu: every row action plus
 * background New Template, driven end-to-end. Uses unique names with
 * try/finally cleanup and never mutates the six seeded starters: the local
 * dev server database persists across runs.
 */
test.describe('templates context menu', () => {
  test('menu-driven template CRUD round trip', async ({ page, request }, testInfo) => {
    const editorPage = new EditorPage(page);
    const name = uniqueDocumentName(testInfo, 'tpl-menu');
    const renamed = uniqueDocumentName(testInfo, 'tpl-menu-renamed');
    let existingName: string | null = null;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Create a template from the current editor content via the list
      // background's context menu.
      const originalContent = '@startuml' + String.fromCharCode(10) + 'A -> B : v1' + String.fromCharCode(10) + '@enduml';
      await editorPage.editor.replaceAllText(originalContent);
      await editorPage.templatesPanel.open();
      await editorPage.templatesPanel.createTemplateViaBackgroundMenu(name);
      await editorPage.templatesPanel.expectTemplateListed(name);
      existingName = name;

      // Rename it via its row's context menu.
      await editorPage.templatesPanel.renameTemplate(name, renamed);
      await editorPage.templatesPanel.expectTemplateListed(renamed);
      await editorPage.templatesPanel.expectTemplateNotListed(name);
      existingName = renamed;

      // Update its content from a changed editor buffer via the menu.
      const updatedContent = '@startuml' + String.fromCharCode(10) + 'A -> B : v2 updated' + String.fromCharCode(10) + '@enduml';
      await editorPage.editor.replaceAllText(updatedContent);
      await editorPage.templatesPanel.updateFromEditor(renamed);

      // Blank the editor, then applying via the menu proves the update took.
      await editorPage.editor.replaceAllText('');
      await editorPage.templatesPanel.applyTemplateViaMenu(renamed);
      await expect
        .poll(async () => normalizeEol(await editorPage.editor.getValue()).trim())
        .toBe(normalizeEol(updatedContent).trim());

      // Delete it via the menu -- gone from the panel AND server-side.
      await editorPage.templatesPanel.deleteTemplate(renamed);
      await editorPage.templatesPanel.expectTemplateNotListed(renamed);
      existingName = null;

      const listResponse = await request.get('http://localhost:5000/api/templates');
      const summaries = (await listResponse.json()) as Array<{ name: string }>;
      expect(summaries.some((t) => t.name === renamed)).toBe(false);
    } finally {
      if (existingName) {
        try {
          if (!(await editorPage.templatesPanel.root.isVisible())) {
            await editorPage.templatesPanel.open();
          }
          await editorPage.templatesPanel.deleteTemplate(existingName);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });

  // Regression for the change-detection feedback loop that used to wedge
  // the tab at 100% CPU while a context menu was open (a fresh items array
  // per change-detection pass kept re-triggering the menu's reposition
  // microtask). Read-only against a seeded starter, so no cleanup needed.
  test('the page stays responsive while a context menu is open', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await editorPage.templatesPanel.open();

    await editorPage.templatesPanel.item('Sequence Diagram').click({ button: 'right' });
    const menu = byTestId(page, 'tree-context-menu');
    await expect(menu).toBeVisible();

    // Pre-fix, the microtask loop starves the event loop and this never
    // resolves: setTimeout and requestAnimationFrame both need the main
    // thread to leave the microtask-drain phase.
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(() => requestAnimationFrame(resolve), 250)),
    );

    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();

    // Typing still lands in the editor -- the page is genuinely live.
    const probeContent = '@startuml' + String.fromCharCode(10) + 'A -> B : still alive' + String.fromCharCode(10) + '@enduml';
    await editorPage.editor.replaceAllText(probeContent);
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()).trim())
      .toBe(normalizeEol(probeContent).trim());
  });
});
