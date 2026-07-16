import {
  applyWizardDiagram,
  buildC4Diagram,
  buildSequenceDiagram,
  deriveId,
  deriveParticipantId,
} from './build-wizard-plantuml';
import { C4Element, C4Relationship, SequenceMessage, SequenceParticipant } from './wizard-model';

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
    it('reproduces the structure of the seeded "Sequence Diagram" starter', () => {
      const participants: SequenceParticipant[] = [
        { id: 'Customer', kind: 'actor', name: 'Customer' },
        { id: 'webApp', kind: 'participant', name: 'Web App' },
        { id: 'orderService', kind: 'participant', name: 'Order Service' },
        { id: 'orderDb', kind: 'database', name: 'Order DB' },
      ];
      const messages: SequenceMessage[] = [
        { fromId: 'Customer', toId: 'webApp', arrow: '->', label: 'Place order' },
        { fromId: 'webApp', toId: 'orderService', arrow: '->', label: 'POST /orders' },
        { fromId: 'orderService', toId: 'orderDb', arrow: '->', label: 'Insert order' },
        { fromId: 'orderDb', toId: 'orderService', arrow: '-->', label: 'Order id' },
        { fromId: 'orderService', toId: 'webApp', arrow: '-->', label: '201 Created' },
        { fromId: 'webApp', toId: 'Customer', arrow: '-->', label: 'Order confirmation' },
      ];

      expect(buildSequenceDiagram(participants, messages)).toBe(
        [
          '@startuml',
          'actor Customer',
          'participant "Web App" as webApp',
          'participant "Order Service" as orderService',
          'database "Order DB" as orderDb',
          '',
          'Customer -> webApp : Place order',
          'webApp -> orderService : POST /orders',
          'orderService -> orderDb : Insert order',
          'orderDb --> orderService : Order id',
          'orderService --> webApp : 201 Created',
          'webApp --> Customer : Order confirmation',
          '@enduml',
        ].join('\n'),
      );
    });

    it('writes participants with no messages yet, and no trailing blank line', () => {
      expect(buildSequenceDiagram([{ id: 'Customer', kind: 'actor', name: 'Customer' }], [])).toBe(
        ['@startuml', 'actor Customer', '@enduml'].join('\n'),
      );
    });

    it('emits the async arrow verbatim', () => {
      const participants: SequenceParticipant[] = [
        { id: 'A', kind: 'participant', name: 'A' },
        { id: 'B', kind: 'participant', name: 'B' },
      ];

      expect(
        buildSequenceDiagram(participants, [{ fromId: 'A', toId: 'B', arrow: '->>', label: 'Fire' }]),
      ).toContain('A ->> B : Fire');
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
