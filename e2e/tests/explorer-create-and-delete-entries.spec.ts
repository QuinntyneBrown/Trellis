import { test, expect } from '@playwright/test';
import { EditorPage } from '../pom/pages/editor.page';
import { installFakeDirectoryPicker, readOpfsFile, seedOpfsFixtureTree, OPFS_ROOT_DIR_NAME } from '../utils/opfs-fixture';
import { normalizeEol } from '../utils/normalize-eol';

const DIAGRAM_CONTENT = ['@startuml', 'actor User', 'User -> System : browse', '@enduml'].join('\n');

test.describe('creating and deleting Explorer files/folders', () => {
  test('creating a file directly in the root adds a row and writes an empty file to disk', async ({ page }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'existing.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await expect(editorPage.explorerPanel.row('existing.puml')).toBeVisible();

    await editorPage.explorerPanel.newFile(OPFS_ROOT_DIR_NAME, 'new-file.puml');

    await expect(editorPage.explorerPanel.row('new-file.puml')).toBeVisible();
    await expect
      .poll(async () => readOpfsFile(page, 'new-file.puml'))
      .toBe('');
  });

  test('creating a folder then a file inside it auto-expands the folder and nests the new file', async ({
    page,
  }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, {});

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();

    await editorPage.explorerPanel.newFolder(OPFS_ROOT_DIR_NAME, 'new-folder');
    await expect(editorPage.explorerPanel.row('new-folder')).toBeVisible();

    await editorPage.explorerPanel.newFile('new-folder', 'nested.puml');

    // Auto-expanded: the nested row shows up without an explicit toggleExpand.
    expect(await editorPage.explorerPanel.isExpanded('new-folder')).toBe(true);
    await expect(editorPage.explorerPanel.row('nested.puml')).toBeVisible();
    await expect
      .poll(async () => readOpfsFile(page, 'new-folder/nested.puml'))
      .toBe('');
  });

  test('deleting a file removes its row and the underlying OPFS file', async ({ page }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'to-delete.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await expect(editorPage.explorerPanel.row('to-delete.puml')).toBeVisible();

    await editorPage.explorerPanel.deleteEntry('to-delete.puml');

    await expect(editorPage.explorerPanel.row('to-delete.puml')).toHaveCount(0);
    await expect(readOpfsFile(page, 'to-delete.puml')).rejects.toThrow();
  });

  test('deleting a non-empty folder recursively removes it and everything nested inside it', async ({ page }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, {
      'folder-to-delete': {
        'inner.puml': DIAGRAM_CONTENT,
        'nested-dir': {
          'deep.puml': DIAGRAM_CONTENT,
        },
      },
    });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await editorPage.explorerPanel.toggleExpand('folder-to-delete');
    await expect(editorPage.explorerPanel.row('inner.puml')).toBeVisible();
    await expect(editorPage.explorerPanel.row('nested-dir')).toBeVisible();

    await editorPage.explorerPanel.deleteEntry('folder-to-delete');

    await expect(editorPage.explorerPanel.row('folder-to-delete')).toHaveCount(0);
    await expect(editorPage.explorerPanel.row('inner.puml')).toHaveCount(0);
    await expect(editorPage.explorerPanel.row('nested-dir')).toHaveCount(0);

    await expect(readOpfsFile(page, 'folder-to-delete/inner.puml')).rejects.toThrow();
    await expect(readOpfsFile(page, 'folder-to-delete/nested-dir/deep.puml')).rejects.toThrow();
  });

  test('creating a file whose name already exists as a sibling shows an error and creates no duplicate', async ({
    page,
  }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'existing.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await expect(editorPage.explorerPanel.row('existing.puml')).toBeVisible();

    await editorPage.explorerPanel.newFile(OPFS_ROOT_DIR_NAME, 'existing.puml');

    await expect(editorPage.explorerPanel.errorBanner).toBeVisible();
    await expect(editorPage.explorerPanel.row('existing.puml')).toHaveCount(1);
    await expect
      .poll(async () => normalizeEol(await readOpfsFile(page, 'existing.puml')))
      .toBe(DIAGRAM_CONTENT);
  });

  test('deleting the file currently open in the editor resets the editor to its blank state', async ({ page }) => {
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'open-then-delete.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await editorPage.explorerPanel.openFile('open-then-delete.puml');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(DIAGRAM_CONTENT);

    await editorPage.explorerPanel.deleteEntry('open-then-delete.puml');

    await expect
      .poll(async () => (await editorPage.editor.getValue()).trim())
      .toBe('');
  });

  test('deleting the currently-open file still resets the editor after its parent directory has been refreshed', async ({
    page,
  }) => {
    // Regression test: FileSystemFileHandle objects are NOT reference-stable
    // across separate directory reads -- every ExplorerPanelComponent
    // refresh of a directory (e.g. from creating a sibling entry) hands back
    // brand-new handle objects for entries that are, on disk, unchanged. A
    // same-instance (===) comparison in EditorPageComponent.onDiskFileDeleted
    // would silently stop matching the moment anything refreshed the open
    // file's parent directory, leaving the editor showing stale content
    // against a handle for a file that no longer exists.
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'open-me.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await editorPage.explorerPanel.openFile('open-me.puml');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(DIAGRAM_CONTENT);

    // Refreshes the same parent directory's children -- replacing every
    // ExplorerTreeNode (and FileSystemFileHandle) under root, including the
    // row for the already-open file, with fresh objects.
    await editorPage.explorerPanel.newFile(OPFS_ROOT_DIR_NAME, 'sibling.puml');
    await expect(editorPage.explorerPanel.row('sibling.puml')).toBeVisible();

    await editorPage.explorerPanel.deleteEntry('open-me.puml');
    await expect(editorPage.explorerPanel.row('open-me.puml')).toHaveCount(0);

    await expect
      .poll(async () => (await editorPage.editor.getValue()).trim())
      .toBe('');
  });

  test('clicking a row action button never also triggers the row\'s own toggle-expand/open-file click behavior', async ({
    page,
  }) => {
    // Direct proof of stopPropagation, not an inference from a converging
    // end state: clicking a file row's Delete button and declining the
    // confirm must never ALSO fire the row's own (click)-driven fileClicked
    // -- which would be observable as this unrelated file's content loading
    // into the editor even though nothing was ever opened.
    await installFakeDirectoryPicker(page);

    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await seedOpfsFixtureTree(page, { 'do-not-open.puml': DIAGRAM_CONTENT });

    await editorPage.explorerPanel.open();
    await editorPage.explorerPanel.openFolder();
    await expect(editorPage.explorerPanel.row('do-not-open.puml')).toBeVisible();

    await editorPage.explorerPanel.deleteEntry('do-not-open.puml', { accept: false });

    // The row must still exist (delete was declined) and the editor must
    // still be blank (fileClicked never fired alongside the Delete click).
    await expect(editorPage.explorerPanel.row('do-not-open.puml')).toBeVisible();
    expect((await editorPage.editor.getValue()).trim()).toBe('');
  });
});
