import { test, expect } from '@playwright/test';
import { byTestId } from '../pom/base.page';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * The command center's Quick Open (vscode.dev's idiom): the title-bar pill
 * (or Ctrl+P from anywhere, including while Monaco has focus) swaps to a
 * fuzzy-search input over the saved documents; a '>' prefix lists commands.
 *
 * The command test uses a panel toggle -- the cheapest observable command --
 * so it needs no cleanup; the document test seeds and deletes its own docs.
 */
test.describe('Quick Open', () => {
  test('the pill opens the search, Escape restores the pill with focus, an outside click dismisses', async ({
    page,
  }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.quickOpen.openWithClick();
    await expect(editorPage.quickOpen.dropdown).toBeVisible();
    await expect(byTestId(page, 'title-bar-title')).toBeHidden();

    await editorPage.quickOpen.dismiss();
    await expect(byTestId(page, 'title-bar-title')).toHaveText('Untitled diagram — Trellis');

    // Reopen, then dismiss by pressing outside: the pill returns but focus
    // deliberately does not.
    await editorPage.quickOpen.openWithClick();
    await editorPage.preview.root.click();
    await expect(editorPage.quickOpen.pill).toBeVisible();
  });

  test('Ctrl+P under Monaco focus fuzzy-finds a saved document and Enter opens it', async ({ page }, testInfo) => {
    const editorPage = new EditorPage(page);
    // Two docs so the test proves RANKING, not just listing. Both unique
    // names embed the sanitized test title, so almost any query is a loose
    // subsequence of both -- the meaningful assertion is that the contiguous
    // "decoy" word puts the decoy on top, not that the other row vanishes.
    const decoy = uniqueDocumentName(testInfo, 'qopen-decoy');
    const needle = uniqueDocumentName(testInfo, 'qopen-needle');
    const saved: string[] = [];

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // First doc through the ordinary save dialog...
      await editorPage.editor.replaceAllText(`@startuml\nAlice -> Bob : ${decoy}\n@enduml`);
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(decoy);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      saved.push(decoy);

      // ...and the second via Save As, which ALWAYS creates a new document.
      // A plain second save would just rename the (now open) first one, and
      // the search would have only a single document to find.
      await editorPage.editor.replaceAllText(`@startuml\nAlice -> Bob : ${needle}\n@enduml`);
      await editorPage.editor.focus();
      await page.keyboard.press('ControlOrMeta+Shift+s');
      await editorPage.saveDialog.typeName(needle);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      saved.push(needle);

      // The needle was saved last, so it owns the title; opening the decoy
      // through the search observably changes it.
      await expect(byTestId(page, 'title-bar-title')).toHaveText(`${needle} — Trellis`);

      // The shortcut must arrive even while Monaco owns focus.
      await editorPage.editor.focus();
      await editorPage.quickOpen.openWithShortcut();

      await editorPage.quickOpen.search('decoy');
      await expect(editorPage.quickOpen.row(decoy)).toBeVisible();
      await expect(editorPage.quickOpen.row(decoy).locator('.quick-open__hit').first()).toBeVisible();
      // The fuzzy ranking puts the contiguous match on top as the active row.
      await expect(editorPage.quickOpen.activeRow).toHaveAttribute('data-option-label', decoy);

      await editorPage.quickOpen.chooseActive();
      await expect(byTestId(page, 'title-bar-title')).toHaveText(`${decoy} — Trellis`);
      await expect(page).toHaveURL(/\/editor\//);
      await expect.poll(async () => await editorPage.editor.getValue()).toContain(decoy);
    } finally {
      for (const name of saved) {
        try {
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteDocument(name);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });

  test('a ">" prefix lists commands and Enter runs the chosen one', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.quickOpen.openWithClick();
    await editorPage.quickOpen.search('>');
    await expect(editorPage.quickOpen.row('Save')).toBeVisible();
    await expect(editorPage.quickOpen.row('New Document')).toBeVisible();

    await editorPage.quickOpen.search('>wizard');
    await expect(editorPage.quickOpen.row('Toggle Diagram Wizard Panel')).toBeVisible();
    await editorPage.quickOpen.chooseActive();

    await expect(editorPage.wizardPanel.root).toBeVisible();
    await expect(editorPage.quickOpen.pill).toBeVisible();
  });
});
