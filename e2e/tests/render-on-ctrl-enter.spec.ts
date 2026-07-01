import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

const VALID_DIAGRAM_ONE = '@startuml\nAlice -> Bob : hello\n@enduml';
const VALID_DIAGRAM_TWO = '@startuml\nAlice -> Bob : hello\nBob --> Alice : hi back\n@enduml';

test.describe('render on Ctrl+Enter', () => {
  test('renders on Ctrl+Enter, ignores mere selection, and re-renders on the next Ctrl+Enter', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const initialSeq = await editorPage.preview.getRenderSequence();

    // Typing a small valid diagram and pressing Ctrl+Enter renders it.
    await editorPage.editor.replaceAllText(VALID_DIAGRAM_ONE);
    await editorPage.editor.pressRender();

    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBe(initialSeq + 1);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
    expect(await editorPage.preview.isPlaceholderVisible()).toBe(false);
    const fingerprintAfterFirstRender = await editorPage.preview.getRenderedFingerprint();
    expect(fingerprintAfterFirstRender.length).toBeGreaterThan(0);

    const seqAfterFirstRender = await editorPage.preview.getRenderSequence();

    // Typing more text and merely selecting it (mouseup) WITHOUT pressing
    // Ctrl+Enter must leave the render sequence completely unchanged.
    await editorPage.editor.focus();
    await editorPage.editor.typeText('\n\' just a comment, not rendered yet');
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(250, 220);
    await page.mouse.up();

    // Give the app a real chance to (incorrectly) react before asserting
    // nothing happened.
    await page.waitForTimeout(1_000);
    expect(await editorPage.preview.getRenderSequence()).toBe(seqAfterFirstRender);

    // A subsequent Ctrl+Enter renders the new content and increments
    // the sequence again.
    await editorPage.editor.replaceAllText(VALID_DIAGRAM_TWO);
    await editorPage.editor.pressRender();

    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBe(seqAfterFirstRender + 1);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);

    const fingerprintAfterSecondRender = await editorPage.preview.getRenderedFingerprint();
    expect(fingerprintAfterSecondRender).not.toBe(fingerprintAfterFirstRender);
  });
});
