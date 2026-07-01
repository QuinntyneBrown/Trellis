import * as fs from 'node:fs';
import * as path from 'node:path';
import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

const MALFORMED_PATH = path.resolve(
  __dirname,
  '../fixtures/invalid/malformed-syntax.puml'
);

const VALID_FIX = '@startuml\nactor User\nUser -> System : do the thing\n@enduml';

test.describe('syntax error handling', () => {
  test('shows an error banner for malformed syntax without crashing, then clears on a valid render', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    const malformedContent = fs.readFileSync(MALFORMED_PATH, 'utf8');

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.editor.replaceAllText(malformedContent);
    const seqBeforeErrorRender = await editorPage.preview.getRenderSequence();
    await editorPage.editor.pressRender();

    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBe(seqBeforeErrorRender + 1);

    expect(await editorPage.preview.isErrorVisible()).toBe(true);
    const errorMessage = await editorPage.preview.getErrorMessage();
    expect(errorMessage.length).toBeGreaterThan(0);

    // The app must not crash or blank out on bad input.
    expect(pageErrors).toEqual([]);
    await expect(editorPage.byTestId('editor-page')).toBeVisible();
    await expect(editorPage.editor.root).toBeVisible();

    // Fixing the syntax and re-rendering clears the error.
    const seqBeforeFixRender = await editorPage.preview.getRenderSequence();
    await editorPage.editor.replaceAllText(VALID_FIX);
    await editorPage.editor.pressRender();

    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBe(seqBeforeFixRender + 1);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);

    const fingerprint = await editorPage.preview.getRenderedFingerprint();
    expect(fingerprint.length).toBeGreaterThan(0);

    expect(pageErrors).toEqual([]);
  });
});
