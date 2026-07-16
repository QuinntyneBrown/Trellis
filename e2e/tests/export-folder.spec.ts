import { readFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { uniqueDocumentName } from '../utils/unique-name';

const PUML_CONTENT = ['@startuml', 'Alice -> Bob : exported', '@enduml'].join('\n');
const MD_CONTENT = ['# Notes heading', '', 'Some exported *prose*.'].join('\n');

/**
 * D-013: a folder row's Export action aggregates every document in that
 * folder and its descendant folders into one markdown file, downloaded by
 * the browser as "<folder-name>.md" — PlantUML documents as ```plantuml
 * fenced blocks, markdown documents inlined verbatim, with no folder or
 * document names in the output. Export is confirmed through a dialog whose
 * "include excluded" checkbox overrides per-document export exclusions:
 * an excluded document is omitted from a default export and restored by
 * the override. First waitForEvent('download') in this suite.
 */
test.describe('export a folder as markdown', () => {
  test('downloads <folder>.md aggregating the subtree with fenced plantuml and inline markdown', async ({
    page,
  }, testInfo) => {
    const editorPage = new EditorPage(page);
    const folderName = uniqueDocumentName(testInfo, 'export-folder');
    const subfolderName = uniqueDocumentName(testInfo, 'export-sub');
    const pumlDocName = uniqueDocumentName(testInfo, 'export-puml');
    const mdDocName = uniqueDocumentName(testInfo, 'export-md');
    let folderExists = false;

    try {
      await editorPage.goto();
      await editorPage.waitForAppReady();

      // Build the tree: folder with a subfolder inside.
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.createRootFolder(folderName);
      folderExists = true;
      await editorPage.documentsPanel.createSubfolder(folderName, subfolderName);
      await editorPage.documentsPanel.expectFolderListed(subfolderName);

      // A PlantUML document directly in the folder...
      await editorPage.editor.replaceAllText(PUML_CONTENT);
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(pumlDocName);
      await editorPage.saveDialog.selectFolder(folderName);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // ...and a markdown document in the nested subfolder, created blank
      // through the New Document dialog (Alt+N; the editor is clean right
      // after saving, so no discard confirm appears). Nested folder options
      // are nbsp-indented four per depth level. The editor adopts the new
      // blank document when the dialog closes.
      await page.keyboard.press('Alt+KeyN');
      const newDocumentDialog = page.getByTestId('new-document-dialog');
      await expect(newDocumentDialog).toBeVisible();
      await page.getByTestId('new-document-dialog-name').fill(mdDocName);
      await page.getByTestId('new-document-dialog-kind').selectOption('markdown');
      await page
        .getByTestId('new-document-dialog-folder')
        .selectOption({ label: `    ${subfolderName}` });
      await page.getByTestId('new-document-dialog-confirm').click();
      await expect(newDocumentDialog).toBeHidden();

      // Type the markdown content into the adopted blank document and
      // quick-save it (the save dialog updates the existing document).
      await expect.poll(async () => (await editorPage.editor.getValue()).trim()).toBe('');
      await editorPage.editor.replaceAllText(MD_CONTENT);
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // Export the top folder: a download named "<folder>.md" arrives.
      const download = await editorPage.documentsPanel.exportFolder(folderName);
      expect(download.suggestedFilename()).toBe(`${folderName}.md`);

      const savedPath = testInfo.outputPath('exported.md');
      await download.saveAs(savedPath);
      const markdown = await readFile(savedPath, 'utf-8');

      // Folder and document names never appear in the export.
      expect(markdown).not.toContain(folderName);
      expect(markdown).not.toContain(subfolderName);
      expect(markdown).not.toContain(pumlDocName);
      expect(markdown).not.toContain(mdDocName);

      // Only document content is aggregated: the subfolder's markdown
      // document inlined verbatim (no fence) followed by the folder's own
      // PlantUML document as a ```plantuml fence wrapping its source
      // verbatim (export normalizes line endings to LF).
      expect(markdown).toBe(`${MD_CONTENT}\n\n\`\`\`plantuml\n${PUML_CONTENT}\n\`\`\`\n`);

      // Mark the markdown document as excluded from export. The panel is
      // reopened first: the documents were saved from the editor, and the
      // panel only refreshes its cached lists on a closed->open transition.
      // The markdown document is the one open in the editor, so the reveal-
      // active-on-open behavior expands its ancestor folders for us -- an
      // explicit chevron toggle here would race that reveal and collapse
      // the subfolder again.
      await editorPage.documentsPanel.toggle.click();
      await editorPage.documentsPanel.open();
      await editorPage.documentsPanel.expectDocumentListed(mdDocName);
      await editorPage.documentsPanel.toggleExportExclusion(mdDocName);
      await editorPage.documentsPanel.expectDocumentExcludedFromExport(mdDocName);

      // A default export now omits the excluded markdown document...
      const filteredDownload = await editorPage.documentsPanel.exportFolder(folderName);
      const filteredPath = testInfo.outputPath('exported-filtered.md');
      await filteredDownload.saveAs(filteredPath);
      const filteredMarkdown = await readFile(filteredPath, 'utf-8');
      expect(filteredMarkdown).toBe(`\`\`\`plantuml\n${PUML_CONTENT}\n\`\`\`\n`);

      // ...and the dialog's "include excluded" override brings it back.
      const everythingDownload = await editorPage.documentsPanel.exportFolder(folderName, {
        includeExcluded: true,
      });
      const everythingPath = testInfo.outputPath('exported-everything.md');
      await everythingDownload.saveAs(everythingPath);
      const everythingMarkdown = await readFile(everythingPath, 'utf-8');
      expect(everythingMarkdown).toBe(`${MD_CONTENT}\n\n\`\`\`plantuml\n${PUML_CONTENT}\n\`\`\`\n`);
    } finally {
      if (folderExists) {
        try {
          if (!(await editorPage.documentsPanel.root.isVisible())) {
            await editorPage.documentsPanel.open();
          }
          await editorPage.documentsPanel.deleteFolder(folderName);
        } catch {
          // Best-effort cleanup only; never mask the original test result.
        }
      }
    }
  });
});
