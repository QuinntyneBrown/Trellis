import {
  applyWizardDiagram,
  buildC4Diagram,
  buildSequenceDiagram,
  deriveId,
  deriveParticipantId,
} from './build-wizard-plantuml';
import {
  C4Element,
  C4Relationship,
  SequenceBox,
  SequenceDiagramModel,
  SequenceParticipant,
  SequenceStep,
} from './wizard-model';

/**
 * Pins the wizard's generation rules. These are the substance of the feature:
 * a user who never learns PlantUML is trusting this file to write it
 * correctly, so the shapes are asserted against the seeded starter templates
 * (Persistence/Migrations/20260703123408_AddTemplates.cs) the wizard is meant
 * to be able to reproduce.
 */
describe('build-wizard-plantuml', () => {
  function element(overrides: Partial<C4Element> & Pick<C4Element, 'id' | 'kind' | 'name'>): C4Element {
    return { technology: '', description: '', boundaryId: null, ...overrides };
  }

  describe('deriveId', () => {
    it('camel-cases a display name into a PlantUML identifier', () => {
      expect(deriveId('Customer', [])).toBe('customer');
      expect(deriveId('Web Application', [])).toBe('webApplication');
      expect(deriveId('API Application', [])).toBe('apiApplication');
      expect(deriveId('Order DB', [])).toBe('orderDb');
    });

    it('treats every run of punctuation as a word break, then camel-cases what is left', () => {
      // 'E-mail' is two words by this rule, hence eMail -- unlovely but
      // deterministic, and the id is never shown to the person who typed the
      // name.
      expect(deriveId('E-mail System', [])).toBe('eMailSystem');
      expect(deriveId('  Payments   (v2) ', [])).toBe('paymentsV2');
    });

    it('de-duplicates against ids already in use rather than colliding', () => {
      expect(deriveId('Database', ['database'])).toBe('database2');
      expect(deriveId('Database', ['database', 'database2'])).toBe('database3');
    });

    it('falls back to a usable identifier for names that slug to nothing or start with a digit', () => {
      expect(deriveId('***', [])).toBe('item');
      expect(deriveId('2nd Service', [])).toBe('n2ndService');
    });
  });

  describe('deriveParticipantId', () => {
    it('keeps a bare-identifier name as its own reference, so no alias is needed', () => {
      expect(deriveParticipantId('Customer', [])).toBe('Customer');
    });

    it('derives an alias only when the name cannot be referenced bare', () => {
      expect(deriveParticipantId('Web App', [])).toBe('webApp');
      expect(deriveParticipantId('Order Service', [])).toBe('orderService');
      expect(deriveParticipantId('Order DB', [])).toBe('orderDb');
    });

    it('derives an alias when the bare name is already taken', () => {
      expect(deriveParticipantId('Customer', ['Customer'])).toBe('customer');
    });
  });

  describe('buildC4Diagram', () => {
    it('writes the four-line skeleton before anything has been added', () => {
      expect(buildC4Diagram('Container', [], [])).toBe(
        ['@startuml', '!define RELATIVE_INCLUDE', '!include C4_Container.puml', '@enduml'].join('\n'),
      );
    });

    it('includes the vendored file matching the chosen view', () => {
      expect(buildC4Diagram('Context', [], [])).toContain('!include C4_Context.puml');
      expect(buildC4Diagram('Component', [], [])).toContain('!include C4_Component.puml');
      expect(buildC4Diagram('Dynamic', [], [])).toContain('!include C4_Dynamic.puml');
      expect(buildC4Diagram('Deployment', [], [])).toContain('!include C4_Deployment.puml');
    });

    it('reproduces the structure of the seeded "C4 - Container" starter', () => {
      const elements: C4Element[] = [
        element({
          id: 'customer',
          kind: 'Person',
          name: 'Customer',
          description: 'A customer of the online shop.',
        }),
        element({ id: 'onlineShop', kind: 'System_Boundary', name: 'Online Shop' }),
        element({
          id: 'webApplication',
          kind: 'Container',
          name: 'Web Application',
          technology: 'Angular',
          description: 'Lets customers browse products and place orders.',
          boundaryId: 'onlineShop',
        }),
        element({
          id: 'apiApplication',
          kind: 'Container',
          name: 'API Application',
          technology: 'ASP.NET Core',
          description: "Serves the shop's REST and real-time API.",
          boundaryId: 'onlineShop',
        }),
        element({
          id: 'database',
          kind: 'ContainerDb',
          name: 'Database',
          technology: 'SQLite',
          description: 'Stores orders and product data.',
          boundaryId: 'onlineShop',
        }),
      ];
      const relationships: C4Relationship[] = [
        { fromId: 'customer', toId: 'webApplication', label: 'Uses', technology: 'HTTPS' },
        { fromId: 'webApplication', toId: 'apiApplication', label: 'Calls', technology: 'JSON/HTTPS' },
        { fromId: 'apiApplication', toId: 'database', label: 'Reads from and writes to', technology: 'SQL' },
      ];

      expect(buildC4Diagram('Container', elements, relationships)).toBe(
        [
          '@startuml',
          '!define RELATIVE_INCLUDE',
          '!include C4_Container.puml',
          '',
          'Person(customer, "Customer", "A customer of the online shop.")',
          '',
          'System_Boundary(onlineShop, "Online Shop") {',
          '  Container(webApplication, "Web Application", "Angular", "Lets customers browse products and place orders.")',
          '  Container(apiApplication, "API Application", "ASP.NET Core", "Serves the shop\'s REST and real-time API.")',
          '  ContainerDb(database, "Database", "SQLite", "Stores orders and product data.")',
          '}',
          '',
          'Rel(customer, webApplication, "Uses", "HTTPS")',
          'Rel(webApplication, apiApplication, "Calls", "JSON/HTTPS")',
          'Rel(apiApplication, database, "Reads from and writes to", "SQL")',
          '@enduml',
        ].join('\n'),
      );
    });

    it('keeps consecutive root elements together, the way the Context starter reads', () => {
      const elements: C4Element[] = [
        element({ id: 'customer', kind: 'Person', name: 'Customer', description: 'A customer.' }),
        element({ id: 'shop', kind: 'System', name: 'Online Shop', description: 'The shop.' }),
        element({ id: 'email', kind: 'System_Ext', name: 'E-mail System', description: 'Sends mail.' }),
      ];

      expect(buildC4Diagram('Context', elements, [])).toBe(
        [
          '@startuml',
          '!define RELATIVE_INCLUDE',
          '!include C4_Context.puml',
          '',
          'Person(customer, "Customer", "A customer.")',
          'System(shop, "Online Shop", "The shop.")',
          'System_Ext(email, "E-mail System", "Sends mail.")',
          '@enduml',
        ].join('\n'),
      );
    });

    it('omits the technology argument for kinds whose macro does not take one', () => {
      const elements: C4Element[] = [
        element({ id: 'customer', kind: 'Person', name: 'Customer', technology: 'ignored', description: 'A customer.' }),
      ];

      expect(buildC4Diagram('Context', elements, [])).toContain('Person(customer, "Customer", "A customer.")');
    });

    it('holds the technology slot open when a Container has a description but no technology', () => {
      const elements: C4Element[] = [
        element({ id: 'web', kind: 'Container', name: 'Web', description: 'Serves pages.' }),
      ];

      // Dropping the empty slot would make PlantUML read the description as the technology.
      expect(buildC4Diagram('Container', elements, [])).toContain('Container(web, "Web", "", "Serves pages.")');
    });

    it('drops empty optional arguments entirely when nothing follows them', () => {
      const elements: C4Element[] = [element({ id: 'web', kind: 'Container', name: 'Web' })];

      expect(buildC4Diagram('Container', elements, [])).toContain('Container(web, "Web")');
    });

    it('omits the technology from a relationship that has none', () => {
      const relationships: C4Relationship[] = [{ fromId: 'a', toId: 'b', label: 'Uses', technology: '' }];

      expect(buildC4Diagram('Context', [], relationships)).toContain('Rel(a, b, "Uses")');
    });

    it('folds embedded double quotes so a typed quote cannot break the macro', () => {
      const elements: C4Element[] = [
        element({ id: 'web', kind: 'System', name: 'The "Big" System', description: 'It is "big".' }),
      ];

      expect(buildC4Diagram('Context', elements, [])).toContain(
        `System(web, "The 'Big' System", "It is 'big'.")`,
      );
    });

    it('nests each element under its own boundary and leaves unclaimed ones at the root', () => {
      const elements: C4Element[] = [
        element({ id: 'shopA', kind: 'System_Boundary', name: 'Shop A' }),
        element({ id: 'webA', kind: 'Container', name: 'Web A', boundaryId: 'shopA' }),
        element({ id: 'shopB', kind: 'System_Boundary', name: 'Shop B' }),
        element({ id: 'webB', kind: 'Container', name: 'Web B', boundaryId: 'shopB' }),
        element({ id: 'loose', kind: 'System', name: 'Loose' }),
      ];

      expect(buildC4Diagram('Container', elements, [])).toBe(
        [
          '@startuml',
          '!define RELATIVE_INCLUDE',
          '!include C4_Container.puml',
          '',
          'System_Boundary(shopA, "Shop A") {',
          '  Container(webA, "Web A")',
          '}',
          '',
          'System_Boundary(shopB, "Shop B") {',
          '  Container(webB, "Web B")',
          '}',
          '',
          'System(loose, "Loose")',
          '@enduml',
        ].join('\n'),
      );
    });
  });

  describe('buildSequenceDiagram', () => {
    // Every sequence diagram opens with these three lines: teoz because the
    // generator leans on it (nested boxes, same-line activation marks), the
    // font size as the wizard's house style.
    const PREAMBLE = ['@startuml', '!pragma teoz true', 'skinparam defaultFontSize 10'];

    function participant(
      overrides: Partial<SequenceParticipant> & Pick<SequenceParticipant, 'id' | 'name'>,
    ): SequenceParticipant {
      return { kind: 'participant', color: '', boxId: null, ...overrides };
    }

    function box(overrides: Partial<SequenceBox> & Pick<SequenceBox, 'id' | 'name'>): SequenceBox {
      return { color: '', parentId: null, ...overrides };
    }

    let stepIds = 0;
    function msg(fromId: string, toId: string, arrow: '->' | '-->' | '->>' = '->', label = ''): SequenceStep {
      return { id: `s${(stepIds += 1)}`, kind: 'message', fromId, toId, arrow, label };
    }

    function model(overrides: Partial<SequenceDiagramModel>): SequenceDiagramModel {
      return { title: '', autoLifelines: false, boxes: [], participants: [], steps: [], ...overrides };
    }

    const ab = [participant({ id: 'A', name: 'A' }), participant({ id: 'B', name: 'B' })];

    it('writes the teoz preamble and nothing else around a lone participant', () => {
      expect(
        buildSequenceDiagram(model({ participants: [participant({ id: 'Customer', kind: 'actor', name: 'Customer' })] })),
      ).toBe([...PREAMBLE, '', 'actor Customer', '@enduml'].join('\n'));
    });

    it('emits a trimmed title right after the preamble, and none when blank', () => {
      expect(buildSequenceDiagram(model({ title: '  Checkout flow  ', participants: ab }))).toBe(
        [...PREAMBLE, 'title Checkout flow', '', 'participant A', 'participant B', '@enduml'].join('\n'),
      );
      expect(buildSequenceDiagram(model({ title: '   ', participants: ab }))).not.toContain('title');
    });

    it('reproduces the seeded "Sequence Diagram" starter flow, now with automatic lifelines', () => {
      const participants = [
        participant({ id: 'Customer', kind: 'actor', name: 'Customer' }),
        participant({ id: 'webApp', name: 'Web App' }),
        participant({ id: 'orderService', name: 'Order Service' }),
        participant({ id: 'orderDb', kind: 'database', name: 'Order DB' }),
      ];
      const steps = [
        msg('Customer', 'webApp', '->', 'Place order'),
        msg('webApp', 'orderService', '->', 'POST /orders'),
        msg('orderService', 'orderDb', '->', 'Insert order'),
        msg('orderDb', 'orderService', '-->', 'Order id'),
        msg('orderService', 'webApp', '-->', '201 Created'),
        msg('webApp', 'Customer', '-->', 'Order confirmation'),
      ];

      expect(buildSequenceDiagram(model({ autoLifelines: true, participants, steps }))).toBe(
        [
          ...PREAMBLE,
          '',
          'actor Customer',
          'participant "Web App" as webApp',
          'participant "Order Service" as orderService',
          'database "Order DB" as orderDb',
          '',
          'Customer -> webApp ++ : Place order',
          'webApp -> orderService ++ : POST /orders',
          'orderService -> orderDb ++ : Insert order',
          'orderDb --> orderService -- : Order id',
          'orderService --> webApp -- : 201 Created',
          'webApp --> Customer -- : Order confirmation',
          '@enduml',
        ].join('\n'),
      );
    });

    it('omits the " : " for an empty label, with and without an activation mark', () => {
      const output = buildSequenceDiagram(
        model({ autoLifelines: true, participants: ab, steps: [msg('A', 'B'), msg('B', 'A', '-->')] }),
      );

      expect(output).toContain('A -> B ++\n');
      expect(output).toContain('B --> A --\n');
    });

    it('never activates for async or self messages', () => {
      const output = buildSequenceDiagram(
        model({ autoLifelines: true, participants: ab, steps: [msg('A', 'B', '->>', 'Fire'), msg('A', 'A', '->', 'Think')] }),
      );

      expect(output).toContain('A ->> B : Fire');
      expect(output).toContain('A -> A : Think');
    });

    it('deactivates only the innermost activation, unwinding a nested call stack in order', () => {
      const participants = [...ab, participant({ id: 'C', name: 'C' })];
      const steps = [
        msg('A', 'B', '->', 'call'),
        msg('B', 'C', '->', 'call'),
        msg('C', 'B', '-->', 'reply'),
        msg('B', 'A', '-->', 'reply'),
      ];

      expect(buildSequenceDiagram(model({ autoLifelines: true, participants, steps }))).toContain(
        ['A -> B ++ : call', 'B -> C ++ : call', 'C --> B -- : reply', 'B --> A -- : reply'].join('\n'),
      );
    });

    it('leaves a reply unmarked when its sender is not the innermost activation', () => {
      const participants = [...ab, participant({ id: 'C', name: 'C' })];
      const steps = [
        msg('A', 'B', '->', 'call'),
        msg('B', 'C', '->', 'call'),
        // B replies while C is still active: a -- here would not match.
        msg('B', 'A', '-->', 'early reply'),
      ];

      expect(buildSequenceDiagram(model({ autoLifelines: true, participants, steps }))).toContain(
        'B --> A : early reply',
      );
    });

    it('leaves a reply unmarked when nothing is activated at all', () => {
      expect(
        buildSequenceDiagram(model({ autoLifelines: true, participants: ab, steps: [msg('B', 'A', '-->', 'reply')] })),
      ).toContain('B --> A : reply');
    });

    it('emits no activation marks when automatic lifelines are off', () => {
      const output = buildSequenceDiagram(
        model({ participants: ab, steps: [msg('A', 'B', '->', 'call'), msg('B', 'A', '-->', 'reply')] }),
      );

      expect(output).toContain('A -> B : call');
      expect(output).toContain('B --> A : reply');
      expect(output).not.toContain('++');
      expect(output).not.toContain(' --\n');
    });

    it('emits manual lifeline steps whether or not automatic lifelines are on', () => {
      const steps: SequenceStep[] = [
        { id: 'l1', kind: 'lifeline', action: 'activate', participantId: 'B' },
        { id: 'l2', kind: 'lifeline', action: 'deactivate', participantId: 'B' },
      ];

      for (const autoLifelines of [true, false]) {
        const output = buildSequenceDiagram(model({ autoLifelines, participants: ab, steps }));
        expect(output).toContain('activate B');
        expect(output).toContain('deactivate B');
      }
    });

    it('lets a manual deactivate consume an automatic activation, so no unmatched -- follows', () => {
      const steps: SequenceStep[] = [
        msg('A', 'B', '->', 'call'),
        { id: 'l1', kind: 'lifeline', action: 'deactivate', participantId: 'B' },
        msg('B', 'A', '-->', 'reply'),
      ];

      const output = buildSequenceDiagram(model({ autoLifelines: true, participants: ab, steps }));

      expect(output).toContain('A -> B ++ : call');
      expect(output).toContain('deactivate B');
      // B is no longer activated, so the reply must not carry a --.
      expect(output).toContain('B --> A : reply');
    });

    it('emits a divider between the messages around it', () => {
      const steps = [msg('A', 'B', '->', 'browse'), { id: 'd', kind: 'divider', label: 'Checkout' } as SequenceStep, msg('A', 'B', '->', 'pay')];

      expect(buildSequenceDiagram(model({ participants: ab, steps }))).toContain(
        ['A -> B : browse', '== Checkout ==', 'A -> B : pay'].join('\n'),
      );
    });

    it('indents group bodies two spaces per level and hangs else at its group\'s depth', () => {
      const steps: SequenceStep[] = [
        { id: 'g1', kind: 'group-open', groupKind: 'alt', label: 'paid' },
        msg('A', 'B', '->', 'ship'),
        { id: 'g2', kind: 'group-open', groupKind: 'loop', label: 'each item' },
        msg('B', 'A', '-->', 'status'),
        { id: 'g3', kind: 'group-end' },
        { id: 'g4', kind: 'group-else', label: 'unpaid' },
        msg('A', 'B', '->', 'remind'),
        { id: 'g5', kind: 'group-end' },
      ];

      expect(buildSequenceDiagram(model({ participants: ab, steps }))).toContain(
        [
          'alt paid',
          '  A -> B : ship',
          '  loop each item',
          '    B --> A : status',
          '  end',
          'else unpaid',
          '  A -> B : remind',
          'end',
        ].join('\n'),
      );
    });

    it('opens a group without a label as the bare keyword', () => {
      const steps: SequenceStep[] = [
        { id: 'g1', kind: 'group-open', groupKind: 'opt', label: '  ' },
        msg('A', 'B', '->', 'maybe'),
        { id: 'g2', kind: 'group-end' },
      ];

      expect(buildSequenceDiagram(model({ participants: ab, steps }))).toContain(
        ['opt', '  A -> B : maybe', 'end'].join('\n'),
      );
    });

    it('drops an end with no open group instead of emitting an unmatched one', () => {
      const steps: SequenceStep[] = [{ id: 'g1', kind: 'group-end' }, msg('A', 'B', '->', 'call')];

      const output = buildSequenceDiagram(model({ participants: ab, steps }));

      // Split into lines: '@enduml' would satisfy a substring check for 'end'.
      expect(output.split('\n')).not.toContain('end');
      expect(output).toContain('A -> B : call');
    });

    it('drops an else outside any group', () => {
      const steps: SequenceStep[] = [{ id: 'g1', kind: 'group-else', label: 'lost' }, msg('A', 'B', '->', 'call')];

      expect(buildSequenceDiagram(model({ participants: ab, steps }))).not.toContain('else');
    });

    it('closes groups still open at the bottom, innermost first', () => {
      const steps: SequenceStep[] = [
        { id: 'g1', kind: 'group-open', groupKind: 'alt', label: 'outer' },
        { id: 'g2', kind: 'group-open', groupKind: 'opt', label: 'inner' },
        msg('A', 'B', '->', 'call'),
      ];

      expect(buildSequenceDiagram(model({ participants: ab, steps }))).toContain(
        ['alt outer', '  opt inner', '    A -> B : call', '  end', 'end', '@enduml'].join('\n'),
      );
    });

    it('declares a box\'s members inside its block, contiguously, where its first member was added', () => {
      const boxes = [box({ id: 'box-1', name: 'Shop', color: 'LightBlue' })];
      const participants = [
        participant({ id: 'Customer', kind: 'actor', name: 'Customer' }),
        participant({ id: 'web', name: 'web', boxId: 'box-1' }),
        participant({ id: 'Mail', name: 'Mail' }),
        participant({ id: 'api', name: 'api', boxId: 'box-1' }),
      ];

      expect(buildSequenceDiagram(model({ boxes, participants }))).toBe(
        [
          ...PREAMBLE,
          '',
          'actor Customer',
          'box "Shop" #LightBlue',
          '  participant web',
          '  participant api',
          'end box',
          'participant Mail',
          '@enduml',
        ].join('\n'),
      );
    });

    it('nests a child box inside its parent', () => {
      const boxes = [
        box({ id: 'box-1', name: 'Platform' }),
        box({ id: 'box-2', name: 'Backend', color: 'EEE', parentId: 'box-1' }),
      ];
      const participants = [
        participant({ id: 'web', name: 'web', boxId: 'box-1' }),
        participant({ id: 'api', name: 'api', boxId: 'box-2' }),
      ];

      expect(buildSequenceDiagram(model({ boxes, participants }))).toBe(
        [
          ...PREAMBLE,
          '',
          'box "Platform"',
          '  participant web',
          '  box "Backend" #EEE',
          '    participant api',
          '  end box',
          'end box',
          '@enduml',
        ].join('\n'),
      );
    });

    it('appends a box nobody has joined yet, so it is visible as soon as it is created', () => {
      const participants = [participant({ id: 'A', name: 'A' })];

      expect(buildSequenceDiagram(model({ boxes: [box({ id: 'box-1', name: 'Empty' })], participants }))).toBe(
        [...PREAMBLE, '', 'participant A', 'box "Empty"', 'end box', '@enduml'].join('\n'),
      );
    });

    it('colors a participant after its alias, forgiving a pasted leading #', () => {
      const participants = [
        participant({ id: 'o', name: 'o', kind: 'actor', color: 'EEE' }),
        participant({ id: 'webApp', name: 'Web App', color: '#FFAA00' }),
      ];

      const output = buildSequenceDiagram(model({ participants }));

      expect(output).toContain('actor o #EEE');
      expect(output).toContain('participant "Web App" as webApp #FFAA00');
      expect(output).not.toContain('##');
    });
  });

  describe('applyWizardDiagram', () => {
    it('writes the diagram into an empty buffer as-is', () => {
      expect(applyWizardDiagram('', { plantUml: '@startuml\n@enduml', previousPlantUml: null, renderable: false })).toBe(
        '@startuml\n@enduml',
      );
      expect(
        applyWizardDiagram('   \n  ', { plantUml: '@startuml\n@enduml', previousPlantUml: null, renderable: false }),
      ).toBe('@startuml\n@enduml');
    });

    it('replaces the wizard\'s own previous document in place, leaving the rest of the buffer alone', () => {
      const current = 'note before\n\n@startuml\nactor A\n@enduml\n\nnote after';

      expect(
        applyWizardDiagram(current, {
          plantUml: '@startuml\nactor A\nactor B\n@enduml',
          previousPlantUml: '@startuml\nactor A\n@enduml',
          renderable: true,
        }),
      ).toBe('note before\n\n@startuml\nactor A\nactor B\n@enduml\n\nnote after');
    });

    it('appends after existing content the wizard did not write, rather than replacing it', () => {
      expect(
        applyWizardDiagram('@startuml\nmy own diagram\n@enduml\n', {
          plantUml: '@startuml\nactor A\n@enduml',
          previousPlantUml: null,
          renderable: true,
        }),
      ).toBe('@startuml\nmy own diagram\n@enduml\n\n@startuml\nactor A\n@enduml');
    });

    it('appends when its previous document is no longer recognisable, never guessing at a replacement', () => {
      expect(
        applyWizardDiagram('the user rewrote everything', {
          plantUml: '@startuml\nactor A\n@enduml',
          previousPlantUml: '@startuml\n@enduml',
          renderable: true,
        }),
      ).toBe('the user rewrote everything\n\n@startuml\nactor A\n@enduml');
    });

    it('replaces only the first occurrence, so a repeated snippet cannot cascade', () => {
      const current = '@startuml\n@enduml\n\n@startuml\n@enduml';

      expect(
        applyWizardDiagram(current, {
          plantUml: '@startuml\nactor A\n@enduml',
          previousPlantUml: '@startuml\n@enduml',
          renderable: true,
        }),
      ).toBe('@startuml\nactor A\n@enduml\n\n@startuml\n@enduml');
    });
  });
});
