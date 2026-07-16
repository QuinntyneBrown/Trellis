import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { OPFS_ROOT_DIR_NAME, installFakeDirectoryPicker, seedOpfsFixtureTree } from '../utils/opfs-fixture';

/**
 * The "Explain This" wizard: a rail toggle opens the fourth exclusive side
 * panel, where picking a local folder (native directory picker, faked onto
 * OPFS exactly like the Explorer specs) and confirming generates an
 * LLM-ready markdown prompt -- aggregated GetFiles-style by the backend --
 * that loads into the editor as an unsaved markdown document and renders
 * in the preview pane, with a copy-to-clipboard button in the panel.
 */
test.describe('Explain This wizard', () => {
  test('rail toggle opens and closes the Explain panel exclusively', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explainPanel.open();
    await expect(editorPage.explainPanel.urlInput).toBeVisible();
    await expect(editorPage.explainPanel.confirmButton).toBeDisabled();

    // Opening another panel replaces it (shared exclusive side panel slot).
    await editorPage.documentsPanel.open();
    await expect(editorPage.explainPanel.root).toBeHidden();

    await editorPage.explainPanel.open();
    await editorPage.explainPanel.toggle.click();
    await expect(editorPage.explainPanel.root).toBeHidden();
  });

  test('generates a prompt from a picked folder, loads it into the editor, and renders the markdown', async ({
    page,
  }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, {
      'README.md': '# Fixture repo',
      src: {
        'flow.puml': '@startuml\nA -> B\n@enduml',
        'main.ts': '// a comment that stripping removes\nconst x = 1;',
      },
      node_modules: {
        'ignored.ts': 'const ignored = true;',
      },
    });

    await editorPage.explainPanel.open();
    await editorPage.explainPanel.pickFolderButton.click();
    await expect(editorPage.explainPanel.selection).toContainText(OPFS_ROOT_DIR_NAME);

    const seqBefore = await editorPage.preview.getRenderSequence();
    await editorPage.explainPanel.confirmButton.click();
    await expect(editorPage.explainPanel.result).toBeVisible();
    await expect(editorPage.explainPanel.result).toContainText('3 files');
    await expect(editorPage.explainPanel.copyPromptButton).toBeVisible();

    // The generated prompt is now the editor buffer: gist-derived sections,
    // the mandated style guide, GetFiles-style delimiters, plantuml fencing,
    // comment stripping, and the node_modules exclusion.
    const prompt = await editorPage.editor.getValue();
    expect(prompt).toContain('# Explain This');
    expect(prompt).toContain('https://github.com/QuinntyneBrown/architecture-description-style-guide');
    expect(prompt).toContain('=== FILE: README.md ===');
    expect(prompt).toContain('=== FILE: src/flow.puml ===');
    expect(prompt).toContain('```plantuml');
    expect(prompt).toContain('const x = 1;');
    expect(prompt).not.toContain('a comment that stripping removes');
    expect(prompt).not.toContain('ignored.ts');

    // And it renders through the markdown preview pipeline.
    await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(seqBefore);
    await expect(editorPage.preview.markdownPane()).toBeVisible();
    await expect(editorPage.preview.markdownPane().locator('h1')).toHaveText('Explain This');
  });

  test('surfaces the backend validation message for a non-GitHub/GitLab URL', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.explainPanel.open();
    await editorPage.explainPanel.urlInput.fill('https://example.com/owner/repo');
    await editorPage.explainPanel.confirmButton.click();

    await expect(editorPage.explainPanel.error).toContainText('Only GitHub and GitLab URLs are supported.');
    await expect(editorPage.explainPanel.result).toBeHidden();
  });
});
