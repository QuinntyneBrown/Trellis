import { Page, test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';

/**
 * `.editor-page__body`'s own width is never queried directly (that would
 * mean a raw CSS selector living in a spec file, the one thing the POM
 * layer exists to avoid) -- it's reconstructed as the sum of the editor
 * pane, divider, and preview pane bounding boxes, all of which are already
 * exposed as data-testid locators. Per the research this feature was built
 * against, both the monaco-editor and preview-pane elements size themselves
 * to exactly 100% of their own pane wrapper, so their bounding boxes are a
 * faithful proxy for the panes' actual widths.
 */
async function getContainerWidth(editorPage: EditorPage): Promise<number> {
  const [editorBox, dividerBox, previewBox] = await Promise.all([
    editorPage.editor.root.boundingBox(),
    editorPage.divider.getBoundingBox(),
    editorPage.preview.root.boundingBox(),
  ]);
  expect(editorBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  return editorBox!.width + dividerBox.width + previewBox!.width;
}

test.describe('resize editor/preview panes via the divider', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    // Clears any ratio persisted by a previous test/run so every test below
    // starts from the same deterministic default split rather than whatever
    // a previous test/run last left behind.
    //
    // Deliberately NOT done via page.addInitScript(() => localStorage.clear()):
    // an init script is attached for the lifetime of the page and re-runs
    // before *every* subsequent navigation, including the in-test
    // page.reload() in "the chosen ratio survives a page reload" below --
    // which would silently wipe out the very ratio that reload is supposed
    // to prove is still persisted. Instead, load the app's origin once,
    // clear storage, then reload so the first "real" boot each test
    // observes already sees a clean slate, with nothing left attached to
    // interfere with any reload a test performs later.
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('hovering the divider shows a col-resize cursor', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.divider.root.hover();

    const cursor = await editorPage.divider.root.evaluate((el) => getComputedStyle(el).cursor);
    expect(cursor).toBe('col-resize');
  });

  test('dragging the divider grows the editor pane and shrinks the preview pane accordingly', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const editorBoxBefore = await editorPage.editor.root.boundingBox();
    const previewBoxBefore = await editorPage.preview.root.boundingBox();
    expect(editorBoxBefore).not.toBeNull();
    expect(previewBoxBefore).not.toBeNull();

    // Dragging right grows the editor pane at the preview pane's expense.
    await editorPage.divider.dragBy(150);

    const editorBoxAfter = await editorPage.editor.root.boundingBox();
    const previewBoxAfter = await editorPage.preview.root.boundingBox();
    expect(editorBoxAfter).not.toBeNull();
    expect(previewBoxAfter).not.toBeNull();

    expect(editorBoxAfter!.width).toBeGreaterThan(editorBoxBefore!.width);
    expect(previewBoxAfter!.width).toBeLessThan(previewBoxBefore!.width);
  });

  test('an extreme drag stays clamped at the configured ratio bounds rather than collapsing a pane to zero', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const containerWidth = await getContainerWidth(editorPage);

    // Attempt to drag the divider far past the right edge of the container:
    // this must clamp at MAX_EDITOR_PANE_RATIO (0.8) rather than collapsing
    // the preview pane to (near) zero.
    await editorPage.divider.dragBy(containerWidth * 2);

    const previewBoxAfterMaxDrag = await editorPage.preview.root.boundingBox();
    expect(previewBoxAfterMaxDrag).not.toBeNull();
    expect(previewBoxAfterMaxDrag!.width).toBeGreaterThan(containerWidth * 0.15);

    // Attempt to drag far past the left edge: same guarantee in reverse,
    // clamped at MIN_EDITOR_PANE_RATIO (0.2) rather than collapsing the
    // editor pane to (near) zero.
    await editorPage.divider.dragBy(-containerWidth * 4);

    const editorBoxAfterMinDrag = await editorPage.editor.root.boundingBox();
    expect(editorBoxAfterMinDrag).not.toBeNull();
    expect(editorBoxAfterMinDrag!.width).toBeGreaterThan(containerWidth * 0.15);
  });

  test('the chosen ratio survives a page reload', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const editorBoxBefore = await editorPage.editor.root.boundingBox();
    expect(editorBoxBefore).not.toBeNull();

    await editorPage.divider.dragBy(120);

    const editorBoxAfterDrag = await editorPage.editor.root.boundingBox();
    expect(editorBoxAfterDrag).not.toBeNull();
    expect(editorBoxAfterDrag!.width).toBeGreaterThan(editorBoxBefore!.width);

    await page.reload();
    await expect(editorPage.byTestId('editor-page')).toBeVisible();
    await editorPage.editor.waitForReady();

    const editorBoxAfterReload = await editorPage.editor.root.boundingBox();
    expect(editorBoxAfterReload).not.toBeNull();
    // A small tolerance for layout rounding -- the important guarantee is
    // that this is close to the post-drag width, not back at the original.
    expect(Math.abs(editorBoxAfterReload!.width - editorBoxAfterDrag!.width)).toBeLessThan(5);
  });

  test('double-clicking the divider resets the split back to 50/50 regardless of prior position', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    const containerWidth = await getContainerWidth(editorPage);

    await editorPage.divider.dragBy(150);
    const editorBoxAfterDrag = await editorPage.editor.root.boundingBox();
    expect(editorBoxAfterDrag).not.toBeNull();
    // Sanity check the drag actually moved the split away from 50/50 before
    // relying on the reset below to prove anything.
    expect(Math.abs(editorBoxAfterDrag!.width - containerWidth / 2)).toBeGreaterThan(20);

    await editorPage.divider.doubleClick();

    const editorBoxAfterReset = await editorPage.editor.root.boundingBox();
    expect(editorBoxAfterReset).not.toBeNull();
    expect(Math.abs(editorBoxAfterReset!.width - containerWidth / 2)).toBeLessThan(containerWidth * 0.05);
  });
});
