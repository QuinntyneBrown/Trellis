import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

/**
 * End-to-end pass over moving documents between folders in the Documents
 * panel -- both interactions: dragging a document row onto a folder row (or
 * onto the tree's empty space to target the root), and the keyboard-friendly
 * "Move to Folder…" dialog.
 *
 * Auto-expansion is the visibility proof throughout: collapsed folders don't
 * render their children at all, so a document being visible right after a
 * move means the panel really did pre-expand the destination folder.
 *
 * Each test creates its own folder(s) and document; deleting the folder
 * cascades to anything left inside it, and the finally blocks sweep up
 * whatever the test's end state leaves at the root.
 */
test.describe('moving documents between folders', () => {
  test('drag and drop moves a document into a folder and back to the root', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderName = uniqueDocumentName(testInfo, 'move-folder');
    const documentName = uniqueDocumentName(testInfo, 'move-doc');
    let folderExists = false;
    let documentAtRoot = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Save a document at the root.
      await editorPage.editor.replaceAllText('@startuml\nAlice -> Bob : moved\n@enduml');
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentAtRoot = true;

      // Create the destination folder.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderName);
      await editorPage.documentsPanel.expectFolderListed(folderName);
      folderExists = true;
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      // Drag the document onto the folder: it disappears from the root and
      // reappears under the (auto-expanded) destination.
      await editorPage.documentsPanel.moveDocumentToFolder(documentName, folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      documentAtRoot = false;

      // Collapsing the folder hides the document -- proof it now lives inside.
      await editorPage.documentsPanel.toggleFolder(folderName);
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);

      // Re-expand and drag it back out to the root: it must stay visible
      // even with the folder collapsed again.
      await editorPage.documentsPanel.toggleFolder(folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      await editorPage.documentsPanel.moveDocumentToRoot(documentName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      documentAtRoot = true;
      await editorPage.documentsPanel.toggleFolder(folderName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      // Cleanup inside the test body so assertions cover it.
      await editorPage.documentsPanel.deleteFolder(folderName);
      folderExists = false;
      await editorPage.documentsPanel.deleteDocument(documentName);
      documentAtRoot = false;
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);
    } finally {
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        if (folderExists) {
          await editorPage.documentsPanel.deleteFolder(folderName);
        }
        if (documentAtRoot) {
          await editorPage.documentsPanel.deleteDocument(documentName);
        }
      } catch {
        // Best-effort cleanup only; never mask the original test result.
      }
    }
  });

  test('the Move to Folder dialog moves a document into a nested subfolder', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const parentName = uniqueDocumentName(testInfo, 'parent');
    const childName = uniqueDocumentName(testInfo, 'child');
    const documentName = uniqueDocumentName(testInfo, 'dialog-doc');
    let parentExists = false;
    let documentAtRoot = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      await editorPage.editor.replaceAllText('@startuml\nAlice -> Bob : dialog\n@enduml');
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();
      documentAtRoot = true;

      // Nested destination: parent folder with a subfolder inside.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(parentName);
      parentExists = true;
      await editorPage.documentsPanel.createSubfolder(parentName, childName);
      await editorPage.documentsPanel.expectFolderListed(childName);

      // Move via the dialog, picking the nbsp-indented nested option by name.
      await editorPage.documentsPanel.moveDocumentViaDialog(documentName, childName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      documentAtRoot = false;

      // Collapsing the subfolder hides the document -- it lives inside child,
      // not merely under the (already expanded) parent.
      await editorPage.documentsPanel.toggleFolder(childName);
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);

      // Moving it back to the root via the dialog's "(No folder)" option.
      await editorPage.documentsPanel.toggleFolder(childName);
      await editorPage.documentsPanel.moveDocumentViaDialog(documentName, null);
      await editorPage.documentsPanel.toggleFolder(childName);
      await editorPage.documentsPanel.expectDocumentListed(documentName);
      documentAtRoot = true;

      await editorPage.documentsPanel.deleteFolder(parentName);
      parentExists = false;
      await editorPage.documentsPanel.deleteDocument(documentName);
      documentAtRoot = false;
    } finally {
      try {
        if (!(await editorPage.documentsPanel.root.isVisible())) {
          await editorPage.documentsPanel.open();
        }
        if (parentExists) {
          await editorPage.documentsPanel.deleteFolder(parentName);
        }
        if (documentAtRoot) {
          await editorPage.documentsPanel.deleteDocument(documentName);
        }
      } catch {
        // Best-effort cleanup only; never mask the original test result.
      }
    }
  });

  test('dropping a document onto its current folder is a harmless no-op', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderName = uniqueDocumentName(testInfo, 'noop-folder');
    const documentName = uniqueDocumentName(testInfo, 'noop-doc');
    let folderExists = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Save the document directly into the folder this time.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderName);
      folderExists = true;
      // The panel only refreshes on the closed->open transition, so close it
      // before saving and reopen after.
      await editorPage.documentsPanel.toggle.click();
      await expect(editorPage.documentsPanel.root).toBeHidden();

      await editorPage.editor.replaceAllText('@startuml\nAlice -> Bob : noop\n@enduml');
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(documentName);
      await editorPage.saveDialog.selectFolder(folderName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // The just-saved document is the active one, so opening the panel
      // auto-reveals it (D-009): its folder is already expanded.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      // Dropping onto the folder it already lives in: still listed exactly
      // once, still inside the folder.
      await editorPage.documentsPanel.moveDocumentToFolder(documentName, folderName);
      await expect(editorPage.documentsPanel.item(documentName)).toHaveCount(1);
      await editorPage.documentsPanel.expectDocumentListed(documentName);

      await editorPage.documentsPanel.deleteFolder(folderName);
      folderExists = false;
      await editorPage.documentsPanel.expectDocumentNotListed(documentName);
    } finally {
      try {
        if (folderExists) {
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteFolder(folderName);
        }
      } catch {
        // Best-effort cleanup only; never mask the original test result.
      }
    }
  });
});
