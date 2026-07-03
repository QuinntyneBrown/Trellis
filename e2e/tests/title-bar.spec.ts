import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { byTestId } from '../pom/base.page';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * The VS Code-style top title bar (D-007): command-center pill tracking the
 * open document's name, and the functional primary-sidebar layout toggle.
 * The menus, panel/secondary toggles, and window controls are static chrome
 * in this first pass, so only their presence/labels are asserted.
 */
test.describe('title bar', () => {
  test('shows the document name and toggles the side panel', async ({ page }, testInfo) => {
    const editorPage = new EditorPage(page);
    const documentName = uniqueDocumentName(testInfo, 'title');
    let documentSaved = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      const title = byTestId(page, 'title-bar-title');
      await expect(byTestId(page, 'title-bar')).toBeVisible();
      await expect(title).toHaveText('Untitled diagram — Trellis');

      // Saving under a real name flows straight into the command center.
      await editorPage.editor.replaceAllText('@startuml\nAlice -> Bob : title\n@enduml');
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentSaved = true;
      await expect(title).toHaveText(`${documentName} — Trellis`);

      // The sidebar layout toggle opens the Documents panel (nothing was
      // open yet this session), fills itself, then closes it again.
      const sidebarToggle = byTestId(page, 'title-bar-sidebar-toggle');
      await expect(sidebarToggle).not.toHaveClass(/title-bar__layout-toggle--active/);

      await sidebarToggle.click();
      await expect(editorPage.documentsPanel.root).toBeVisible();
      await expect(sidebarToggle).toHaveClass(/title-bar__layout-toggle--active/);

      await sidebarToggle.click();
      await expect(editorPage.documentsPanel.root).toBeHidden();
      await expect(sidebarToggle).not.toHaveClass(/title-bar__layout-toggle--active/);
    } finally {
      if (documentSaved) {
        try {
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteDocument(documentName);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });
});
