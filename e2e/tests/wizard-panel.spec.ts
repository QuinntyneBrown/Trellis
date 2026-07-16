import { expect, test } from '@playwright/test';

import { EditorPage } from '../pom/pages/editor.page';
import { normalizeEol } from '../utils/normalize-eol';

/**
 * The Diagram Wizard: a rail toggle opens the fifth exclusive side panel,
 * which walks the user through building a C4 or sequence diagram a step at a
 * time. Every action writes PlantUML into the editor and re-renders the
 * preview; the wizard never reads the editor back.
 *
 * These specs never save a document, so they need no cleanup -- the wizard
 * only ever writes into the scratch buffer.
 */
test.describe('Diagram Wizard', () => {
  test('rail toggle opens and closes the wizard panel exclusively', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    await editorPage.wizardPanel.open();
    await expect(editorPage.wizardPanel.caption).toContainText('Diagram type');
    await expect(editorPage.wizardPanel.backButton).toBeDisabled();
    await expect(editorPage.wizardPanel.nextButton).toBeDisabled();

    // Opening another panel replaces it (shared exclusive side panel slot).
    await editorPage.documentsPanel.open();
    await expect(editorPage.wizardPanel.root).toBeHidden();

    await editorPage.wizardPanel.open();
    await editorPage.wizardPanel.toggle.click();
    await expect(editorPage.wizardPanel.root).toBeHidden();
  });

  test('builds a C4 container diagram step by step, rendering after each addition', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await editorPage.wizardPanel.open();

    // Step 1 -> 2: choose the C4 track.
    await editorPage.wizardPanel.choose('c4');
    await editorPage.wizardPanel.next();

    // Step 2: picking a view seeds the skeleton but must not render an empty
    // diagram -- PlantUML would only answer it with an error.
    await editorPage.wizardPanel.choose('container');
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe('@startuml\n!define RELATIVE_INCLUDE\n!include C4_Container.puml\n@enduml');
    expect(await editorPage.preview.getRenderSequence()).toBe(0);
    expect(await editorPage.preview.isPlaceholderVisible()).toBe(true);

    await editorPage.wizardPanel.next();

    // Step 3: elements. Next stays disabled until at least one exists.
    await expect(editorPage.wizardPanel.nextButton).toBeDisabled();
    await expect(editorPage.wizardPanel.addedEmpty).toBeVisible();

    const seqBefore = await editorPage.preview.getRenderSequence();
    await editorPage.wizardPanel.addElement({
      kind: 'Person',
      name: 'Customer',
      description: 'A customer of the online shop.',
    });
    await editorPage.wizardPanel.addElement({ kind: 'System_Boundary', name: 'Online Shop' });
    await editorPage.wizardPanel.addElement({
      kind: 'Container',
      name: 'Web Application',
      technology: 'Angular',
      description: 'Lets customers browse products and place orders.',
      boundary: 'onlineShop',
    });
    await editorPage.wizardPanel.addElement({
      kind: 'ContainerDb',
      name: 'Database',
      technology: 'SQLite',
      description: 'Stores orders and product data.',
      boundary: 'onlineShop',
    });

    expect(await editorPage.wizardPanel.addedNames()).toEqual([
      'Customer',
      'Online Shop',
      'Web Application',
      'Database',
    ]);
    await expect(editorPage.wizardPanel.nextButton).toBeEnabled();

    // Each addition renders; the counter has moved on.
    await expect.poll(() => editorPage.preview.getRenderSequence()).toBeGreaterThan(seqBefore);

    // Step 4: relationships between the elements just added.
    await editorPage.wizardPanel.next();
    await expect(editorPage.wizardPanel.nextButton).toHaveText('Finish');

    await editorPage.wizardPanel.addRelationship({
      from: 'customer',
      to: 'webApplication',
      label: 'Uses',
      technology: 'HTTPS',
    });
    await editorPage.wizardPanel.addRelationship({
      from: 'webApplication',
      to: 'database',
      label: 'Reads from and writes to',
      technology: 'SQL',
    });

    // The finished document is the seeded "C4 - Container" starter's shape,
    // with ids derived from the names.
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(
        [
          '@startuml',
          '!define RELATIVE_INCLUDE',
          '!include C4_Container.puml',
          '',
          'Person(customer, "Customer", "A customer of the online shop.")',
          '',
          'System_Boundary(onlineShop, "Online Shop") {',
          '  Container(webApplication, "Web Application", "Angular", "Lets customers browse products and place orders.")',
          '  ContainerDb(database, "Database", "SQLite", "Stores orders and product data.")',
          '}',
          '',
          'Rel(customer, webApplication, "Uses", "HTTPS")',
          'Rel(webApplication, database, "Reads from and writes to", "SQL")',
          '@enduml',
        ].join('\n'),
      );

    // It is real PlantUML: the vendored C4 include resolves and it renders.
    await expect(editorPage.preview.root.locator('.diagram-preview__svg svg')).toBeVisible({ timeout: 60_000 });
    expect(await editorPage.preview.isErrorVisible()).toBe(false);

    await editorPage.wizardPanel.next();
    await expect(editorPage.wizardPanel.summary).toContainText('C4 diagram complete.');
  });

  test('builds a sequence diagram, and leaves hand-written content alone', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();

    // Content the wizard did not write must survive untouched.
    await editorPage.editor.replaceAllText("' my own notes");

    await editorPage.wizardPanel.open();
    await editorPage.wizardPanel.choose('sequence');
    await editorPage.wizardPanel.next();

    await editorPage.wizardPanel.addParticipant({ kind: 'actor', name: 'Customer' });
    await editorPage.wizardPanel.addParticipant({ kind: 'participant', name: 'Web App' });

    await editorPage.wizardPanel.next();
    await editorPage.wizardPanel.addMessage({ from: 'Customer', to: 'webApp', label: 'Place order' });
    await editorPage.wizardPanel.addMessage({
      from: 'webApp',
      to: 'Customer',
      arrow: '-->',
      label: 'Order confirmation',
    });

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(
        [
          "' my own notes",
          '',
          '@startuml',
          'actor Customer',
          'participant "Web App" as webApp',
          '',
          'Customer -> webApp : Place order',
          'webApp --> Customer : Order confirmation',
          '@enduml',
        ].join('\n'),
      );

    await expect(editorPage.preview.root.locator('.diagram-preview__svg svg')).toBeVisible({ timeout: 60_000 });
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
  });

  test('removing an added item rewrites the diagram in place', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await editorPage.wizardPanel.open();

    await editorPage.wizardPanel.choose('sequence');
    await editorPage.wizardPanel.next();
    await editorPage.wizardPanel.addParticipant({ kind: 'actor', name: 'Customer' });
    await editorPage.wizardPanel.addParticipant({ kind: 'database', name: 'Order DB' });

    await expect.poll(async () => (await editorPage.editor.getValue()).includes('Order DB')).toBe(true);

    await editorPage.wizardPanel.addedList
      .locator('li', { hasText: 'Order DB' })
      .getByRole('button', { name: 'Remove' })
      .click();

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe('@startuml\nactor Customer\n@enduml');
  });
});
