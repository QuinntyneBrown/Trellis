import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * Full CRUD round trip over user-created templates (D-011). Uses unique
 * names with try/finally cleanup and never mutates the six seeded starters:
 * the local dev server database persists across runs.
 */
test.describe('template CRUD', () => {
  test('create from editor, rename, update from editor, apply, delete', async ({ page, request }, testInfo) => {
    const editorPage = new EditorPage(page);
    const name = uniqueDocumentName(testInfo, 'tpl');
    const renamed = uniqueDocumentName(testInfo, 'tpl-renamed');
    let existingName: string | null = null;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Create a template from the current editor content.
      const originalContent = '@startuml' + String.fromCharCode(10) + 'A -> B : v1' + String.fromCharCode(10) + '@enduml';
      await editorPage.editor.replaceAllText(originalContent);
      await editorPage.templatesPanel.open();
      await editorPage.templatesPanel.createTemplate(name);
      await editorPage.templatesPanel.expectTemplateListed(name);
      existingName = name;

      // Rename it.
      await editorPage.templatesPanel.renameTemplate(name, renamed);
      await editorPage.templatesPanel.expectTemplateListed(renamed);
      await editorPage.templatesPanel.expectTemplateNotListed(name);
      existingName = renamed;

      // Update its content from a changed editor buffer.
      const updatedContent = '@startuml' + String.fromCharCode(10) + 'A -> B : v2 updated' + String.fromCharCode(10) + '@enduml';
      await editorPage.editor.replaceAllText(updatedContent);
      await editorPage.templatesPanel.updateFromEditor(renamed);

      // Blank the editor, then applying the template proves the update took.
      await editorPage.editor.replaceAllText('');
      await editorPage.templatesPanel.applyTemplate(renamed);
      await expect
        .poll(async () => normalizeEol(await editorPage.editor.getValue()).trim())
        .toBe(normalizeEol(updatedContent).trim());

      // Delete it -- gone from the panel AND server-side.
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
});
