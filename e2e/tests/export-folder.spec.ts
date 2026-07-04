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
 * fenced blocks, markdown documents inlined verbatim, headings mirroring
 * the folder hierarchy. First waitForEvent('download') in this suite.
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

      // ...and a markdown document in the nested subfolder. Alt+N starts a
      // fresh document so the next Save opens a create dialog; the editor is
      // clean right after saving, so no discard confirm appears.
      await page.keyboard.press('Alt+KeyN');
      await expect.poll(async () => (await editorPage.editor.getValue()).trim()).toBe('');
      await editorPage.editor.replaceAllText(MD_CONTENT);
      await editorPage.fileMenu.openSaveDialog();
      await editorPage.saveDialog.typeName(mdDocName);
      await editorPage.saveDialog.selectKind('markdown');
      await editorPage.saveDialog.selectFolder(`    ${subfolderName}`);
      await editorPage.saveDialog.confirmSave();
      await expect(editorPage.saveDialog.root).toBeHidden();

      // Export the top folder: a download named "<folder>.md" arrives.
      const download = await editorPage.documentsPanel.exportFolder(folderName);
      expect(download.suggestedFilename()).toBe(`${folderName}.md`);

      const savedPath = testInfo.outputPath('exported.md');
      await download.saveAs(savedPath);
      const markdown = await readFile(savedPath, 'utf-8');

      // Headings mirror the hierarchy: H1 folder, H2 subfolder.
      expect(markdown).toContain(`# ${folderName}`);
      expect(markdown).toContain(`## ${subfolderName}`);

      // The PlantUML document is a ```plantuml fence wrapping its source
      // verbatim (export normalizes line endings to LF)...
      expect(markdown).toContain('```plantuml\n' + PUML_CONTENT + '\n```');

      // ...while the markdown document is inlined directly under its H3
      // heading (subfolder is H2, its documents one deeper) — no fence.
      expect(markdown).toContain(`### ${mdDocName}\n\n${MD_CONTENT}`);
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
