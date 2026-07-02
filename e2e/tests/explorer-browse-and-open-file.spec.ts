import { test, expect } from '@playwright/test';
import { openExplorerWithTree } from '../utils/opfs-fixture';
import { normalizeEol } from '../utils/normalize-eol';

const DIAGRAM_CONTENT = ['@startuml', 'actor User', 'User -> System : browse', '@enduml'].join('\n');

const TREE = {
  'readme.txt': 'not a diagram',
  docs: {
    'architecture.puml': DIAGRAM_CONTENT,
  },
};

test.describe('browsing a local folder and opening a file from the Explorer', () => {
  test('expanding a directory lists its children, and clicking a .puml file loads its content into the editor', async ({
    page,
  }) => {
    const editorPage = await openExplorerWithTree(page, TREE);

    // The root's own two children (a directory and a file), sorted
    // directories-before-files.
    await expect(editorPage.explorerPanel.row('docs')).toBeVisible();
    await expect(editorPage.explorerPanel.row('readme.txt')).toBeVisible();
    await expect(editorPage.explorerPanel.row('architecture.puml')).toHaveCount(0);

    await editorPage.explorerPanel.toggleExpand('docs');
    await expect(editorPage.explorerPanel.row('architecture.puml')).toBeVisible();

    await editorPage.explorerPanel.openFile('architecture.puml');

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(DIAGRAM_CONTENT);
  });

  test('collapsing and re-expanding the same directory never re-reads disk a second time', async ({ page }) => {
    const editorPage = await openExplorerWithTree(page, TREE);

    await editorPage.explorerPanel.toggleExpand('docs');
    await expect(editorPage.explorerPanel.row('architecture.puml')).toBeVisible();
    expect(await editorPage.explorerPanel.isExpanded('docs')).toBe(true);

    // Collapse.
    await editorPage.explorerPanel.toggleExpand('docs');
    await expect(editorPage.explorerPanel.row('architecture.puml')).toBeHidden();
    expect(await editorPage.explorerPanel.isExpanded('docs')).toBe(false);

    // Re-expand: children are already cached in the tree model, so no
    // second disk read (listChildren) should ever occur -- observable here
    // as the child row appearing without the directory ever flashing its
    // own per-row loading spinner.
    await editorPage.explorerPanel.toggleExpand('docs');
    await expect(editorPage.explorerPanel.row('architecture.puml')).toBeVisible();
    expect(await editorPage.explorerPanel.isRowLoading('docs')).toBe(false);
  });
});
