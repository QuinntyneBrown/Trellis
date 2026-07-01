import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';
import { uniqueDocumentName } from '../utils/unique-name';

const DIAGRAM = [
  '@startuml',
  'actor Client',
  'participant Server',
  'Client -> Server : save me',
  'Server --> Client : saved',
  '@enduml',
].join('\n');

test.describe('save and reopen a document', () => {
  test('saves a diagram, lists it, and reopening it restores and re-renders the exact content', async ({
    page,
  }, testInfo) => {
    const documentName = uniqueDocumentName(testInfo, 'save-reopen');
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.editor.replaceAllText(DIAGRAM);
    await editorPage.editor.pressRender();
    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBeGreaterThan(0);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);

    // Save the diagram under a name unique to this test run.
    await editorPage.toolbar.openSaveDialog();
    await expect(editorPage.saveDialog.root).toBeVisible();
    await editorPage.saveDialog.typeName(documentName);
    await editorPage.saveDialog.confirmSave();
    await expect(editorPage.saveDialog.root).toBeHidden();

    // Confirm it is listed in the documents panel.
    await editorPage.documentsPanel.open();
    await editorPage.documentsPanel.expectDocumentListed(documentName);

    // Clear the editor locally so reopening proves a genuine server
    // round trip rather than retained client state.
    await editorPage.editor.replaceAllText('');
    expect((await editorPage.editor.getValue()).trim()).toBe('');

    const seqBeforeReopen = await editorPage.preview.getRenderSequence();

    await editorPage.documentsPanel.openDocument(documentName);

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(DIAGRAM);

    // Reopening also re-renders the restored content.
    await expect
      .poll(() => editorPage.preview.getRenderSequence())
      .toBeGreaterThan(seqBeforeReopen);
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
  });
});
