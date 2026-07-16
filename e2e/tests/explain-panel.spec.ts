import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { EditorPage } from '../pom/pages/editor.page';
import { OPFS_ROOT_DIR_NAME, installFakeDirectoryPicker, seedOpfsFixtureTree } from '../utils/opfs-fixture';

/**
 * The "Explain This" wizard: a rail toggle opens the fourth exclusive side
 * panel, where picking a local folder (native directory picker, faked onto
 * OPFS exactly like the Explorer specs) and confirming generates an
 * LLM-ready markdown prompt -- aggregated GetFiles-style by the backend --
 * that loads a compact prompt into the editor and makes the aggregated source
 * blocks available as a separate markdown download.
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

  test('generates an offline explain prompt and source attachment from a picked folder', async ({
    page,
  }, testInfo) => {
    await installFakeDirectoryPicker(page);
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'], {
      origin: 'http://localhost:4200',
    });

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
    await expect(editorPage.explainPanel.downloadAttachmentButton).toBeVisible();

    // The editor and clipboard receive only the compact prompt, which names
    // the separate attachment the user must upload in the LLM chat.
    const prompt = await editorPage.editor.getValue();
    expect(prompt).toContain('# Explain This');
    expect(prompt).toContain('do not make HTTP calls');
    expect(prompt).toContain('## Overview');
    expect(prompt).toContain('## Class Diagrams');
    expect(prompt).toContain('## Sequence Diagrams');
    expect(prompt).not.toContain('Quiz');
    expect(prompt).not.toContain('architecture-description-style-guide');
    expect(prompt).toContain('`explain-this-files.md` (3 files)');
    expect(prompt).not.toMatch(/^=== FILE:/m);

    await editorPage.explainPanel.copyPromptButton.click();
    await expect(editorPage.explainPanel.copyPromptButton).toHaveText('Copied!');
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()).then((text) => text.replace(/\r\n/g, '\n')))
      .toBe(prompt.replace(/\r\n/g, '\n'));

    // The download contains only GetFiles-style source blocks: PlantUML is
    // fenced correctly, code comments are stripped, and excluded trees stay out.
    const downloadPromise = page.waitForEvent('download');
    await editorPage.explainPanel.downloadAttachmentButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('explain-this-files.md');
    const attachmentPath = testInfo.outputPath('explain-this-files.md');
    await download.saveAs(attachmentPath);
    const attachment = await readFile(attachmentPath, 'utf8');
    expect(attachment).toContain('=== FILE: README.md ===');
    expect(attachment).toContain('=== FILE: src/flow.puml ===');
    expect(attachment).toContain('```plantuml');
    expect(attachment).toContain('const x = 1;');
    expect(attachment).not.toContain('# Explain This');
    expect(attachment).not.toContain('a comment that stripping removes');
    expect(attachment).not.toContain('ignored.ts');

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
