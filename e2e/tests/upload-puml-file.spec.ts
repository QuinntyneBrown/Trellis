import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';

const SAMPLE_ONE_PATH = path.resolve(__dirname, '../fixtures/upload/sample-one.puml');
const SAMPLE_TWO_PATH = path.resolve(__dirname, '../fixtures/upload/sample-two.puml');

test.describe('upload a .puml file', () => {
  test('uploading a file loads its exact content, and a second upload fully replaces it', async ({
    page,
  }) => {
    const sampleOneContent = normalizeEol(fs.readFileSync(SAMPLE_ONE_PATH, 'utf8'));
    const sampleTwoContent = normalizeEol(fs.readFileSync(SAMPLE_TWO_PATH, 'utf8'));
    expect(sampleOneContent).not.toBe(sampleTwoContent);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // Editor starts blank in this fresh session.
    expect((await editorPage.editor.getValue()).trim()).toBe('');

    await editorPage.uploadFile(SAMPLE_ONE_PATH);

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(sampleOneContent);

    // Uploading a second, different file must fully replace the prior
    // content, not append to it.
    await editorPage.uploadFile(SAMPLE_TWO_PATH);

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(sampleTwoContent);

    const finalContent = normalizeEol(await editorPage.editor.getValue());
    expect(finalContent).not.toContain(sampleOneContent.trim());
  });
});
