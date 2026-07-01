import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * The shared contract only spells out one example template key
 * ('c4-context' / 'C4 - Context'). The Container and Component keys
 * below are a judgment call, following the same kebab-case convention
 * ('c4-container', 'c4-component'); if the backend lands on different
 * keys, only this list needs to change.
 */
const C4_TEMPLATE_KEYS = ['c4-context', 'c4-container', 'c4-component'];

test.describe('template picker - C4 templates', () => {
  for (const key of C4_TEMPLATE_KEYS) {
    test(`selecting the ${key} template loads its content and renders successfully`, async ({
      page,
      request,
    }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Fetch the template directly from the backend so this test
      // verifies against the real source of truth rather than a
      // hardcoded copy of expected content.
      const apiResponse = await request.get(
        `http://localhost:5000/api/templates/${key}`
      );
      expect(apiResponse.ok()).toBe(true);
      const template = await apiResponse.json();
      expect(template.category).toBe('C4');

      await editorPage.toolbar.openTemplatePicker();
      await expect(editorPage.templatePicker.root).toBeVisible();
      await editorPage.templatePicker.selectTemplate(key);
      await expect(editorPage.templatePicker.root).toBeHidden();

      const editorContent = (await editorPage.editor.getValue()).trim();
      expect(editorContent).toBe((template.content as string).trim());

      await editorPage.editor.pressRender();

      await expect
        .poll(() => editorPage.preview.getRenderSequence())
        .toBeGreaterThan(0);
      expect(await editorPage.preview.isErrorVisible()).toBe(false);
    });
  }
});
