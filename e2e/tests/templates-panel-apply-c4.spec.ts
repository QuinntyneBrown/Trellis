import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * The three C4 starters are migration-seeded templates. Applying each from
 * the Templates side panel loads the source-of-truth content (fetched from
 * the API by id -- the list endpoint deliberately carries no content) into
 * the editor and renders cleanly. Unlike the old pop-out picker, the panel
 * STAYS OPEN after applying.
 */
const C4_TEMPLATE_NAMES = ['C4 - Context', 'C4 - Container', 'C4 - Component'];

test.describe('templates panel - applying C4 templates', () => {
  for (const name of C4_TEMPLATE_NAMES) {
    test(`applying "${name}" loads its content and renders successfully`, async ({ page, request }) => {
      const editorPage = new EditorPage(page);
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Source of truth: list by name, then fetch the full template by id.
      const listResponse = await request.get('http://localhost:5000/api/templates');
      expect(listResponse.ok()).toBe(true);
      const summaries = (await listResponse.json()) as Array<{ id: string; name: string }>;
      const summary = summaries.find((t) => t.name === name);
      expect(summary).toBeDefined();

      const fullResponse = await request.get(`http://localhost:5000/api/templates/${summary!.id}`);
      expect(fullResponse.ok()).toBe(true);
      const template = (await fullResponse.json()) as { content: string };

      await editorPage.templatesPanel.open();
      await editorPage.templatesPanel.applyTemplate(name);

      // The panel stays open -- it is a side panel, not a pop-out.
      await expect(editorPage.templatesPanel.root).toBeVisible();

      await expect
        .poll(async () => (await editorPage.editor.getValue()).trim())
        .toBe(template.content.trim());

      await editorPage.editor.pressRender();

      await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(0);
      expect(await editorPage.preview.isErrorVisible()).toBe(false);
    });
  }
});
