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

    // The automatic-lifelines default marks the call and its reply (++/--).
    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(
        [
          "' my own notes",
          '',
          '@startuml',
          '!pragma teoz true',
          'skinparam defaultFontSize 10',
          '',
          'actor Customer',
          'participant "Web App" as webApp',
          '',
          'Customer -> webApp ++ : Place order',
          'webApp --> Customer -- : Order confirmation',
          '@enduml',
        ].join('\n'),
      );

    await expect(editorPage.preview.root.locator('.diagram-preview__svg svg')).toBeVisible({ timeout: 60_000 });
    expect(await editorPage.preview.isErrorVisible()).toBe(false);
  });

  test('builds a feature-rich sequence: title, boxes, groups, replies and lifelines', async ({ page }) => {
    const editorPage = new EditorPage(page);
    await editorPage.goto();
    await editorPage.waitForAppReady();
    await editorPage.wizardPanel.open();

    await editorPage.wizardPanel.choose('sequence');
    await editorPage.wizardPanel.next();

    // Title, a colored participant, and a nested pair of boxes.
    await editorPage.wizardPanel.setTitle('Checkout');
    await editorPage.wizardPanel.addParticipant({ kind: 'actor', name: 'Customer', color: 'EEE' });
    await editorPage.wizardPanel.addBox({ name: 'Shop', color: 'LightBlue' });
    await editorPage.wizardPanel.addBox({ name: 'Backend', parent: 'Shop' });
    await editorPage.wizardPanel.addParticipant({ name: 'Web App', box: 'Shop' });
    await editorPage.wizardPanel.addParticipant({ name: 'API', box: 'Backend' });
    await editorPage.wizardPanel.next();

    // Two calls, then their replies generated from the selection.
    await editorPage.wizardPanel.addMessage({ from: 'Customer', to: 'webApp', label: 'Place order' });
    await editorPage.wizardPanel.addMessage({ from: 'webApp', to: 'API', label: 'POST /orders' });
    const rows = editorPage.wizardPanel.stepRows;
    await editorPage.wizardPanel.selectStep(rows.nth(0));
    await editorPage.wizardPanel.selectStep(rows.nth(1), ['ControlOrMeta']);
    await editorPage.wizardPanel.openStepContextMenu(rows.nth(1));
    await editorPage.wizardPanel.chooseStepCommand('reverse-replies');
    await expect(rows).toHaveCount(4);

    // A section, then an alt with a branch per fulfilment outcome; the alt is
    // never closed -- the generator closes it. Inserted blocks chain after the
    // selected row, so the cursor is moved by clicking where needed.
    await editorPage.wizardPanel.selectStep(rows.nth(3));
    await editorPage.wizardPanel.insertBlock({ kind: 'divider', label: 'Fulfilment' });
    await editorPage.wizardPanel.insertBlock({ kind: 'alt', label: 'in stock' });
    await editorPage.wizardPanel.addMessage({ from: 'webApp', to: 'Customer', arrow: '->>', label: 'Dispatch notice' });
    await editorPage.wizardPanel.selectStep(rows.nth(6));
    await editorPage.wizardPanel.insertBlock({ kind: 'else', label: 'backorder' });
    await editorPage.wizardPanel.addMessage({ from: 'webApp', to: 'Customer', arrow: '->>', label: 'Backorder ETA' });
    await editorPage.wizardPanel.selectStep(rows.nth(8));
    await editorPage.wizardPanel.insertBlock({ kind: 'activate', participant: 'Customer' });
    await editorPage.wizardPanel.insertBlock({ kind: 'deactivate', participant: 'Customer' });

    // Drag the section divider up above the replies.
    await editorPage.wizardPanel.dragStepTo(rows.nth(4), rows.nth(2), 'above');

    await expect
      .poll(async () => normalizeEol(await editorPage.editor.getValue()))
      .toBe(
        [
          '@startuml',
          '!pragma teoz true',
          'skinparam defaultFontSize 10',
          'title Checkout',
          '',
          'actor Customer #EEE',
          'box "Shop" #LightBlue',
          '  participant "Web App" as webApp',
          '  box "Backend"',
          '    participant API',
          '  end box',
          'end box',
          '',
          'Customer -> webApp ++ : Place order',
          'webApp -> API ++ : POST /orders',
          '== Fulfilment ==',
          'API --> webApp --',
          'webApp --> Customer --',
          'alt in stock',
          '  webApp ->> Customer : Dispatch notice',
          'else backorder',
          '  webApp ->> Customer : Backorder ETA',
          '  activate Customer',
          '  deactivate Customer',
          'end',
          '@enduml',
        ].join('\n'),
      );

    // The whole teoz feature set renders: nested boxes, activation marks,
    // the section and the auto-closed alt.
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
      .toBe('@startuml\n!pragma teoz true\nskinparam defaultFontSize 10\n\nactor Customer\n@enduml');
  });
});
