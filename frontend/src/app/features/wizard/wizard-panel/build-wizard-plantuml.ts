import {
  C4DiagramType,
  C4Element,
  C4ElementKind,
  C4Relationship,
  SequenceMessage,
  SequenceParticipant,
  WizardDiagramChange,
} from './wizard-model';

/**
 * Turns the wizard's model into PlantUML. Pure and side-effect free so the
 * generation rules -- which are the whole substance of the feature -- can be
 * pinned by unit tests without a TestBed, the way build-document-tree.ts and
 * clamp.ts are.
 *
 * The output targets the vendored C4-PlantUML and the same shapes the seeded
 * starter templates use (backend/src/Trellis.Api/Persistence/Migrations/
 * 20260703123408_AddTemplates.cs), so a wizard-built diagram and the matching
 * starter are structurally the same document.
 */

/** Each C4 view's vendored include; resolved offline via RELATIVE_INCLUDE. */
const C4_INCLUDES: Record<C4DiagramType, string> = {
  Context: 'C4_Context.puml',
  Container: 'C4_Container.puml',
  Component: 'C4_Component.puml',
  Dynamic: 'C4_Dynamic.puml',
  Deployment: 'C4_Deployment.puml',
};

/**
 * The macros whose signature is (alias, label, techn, descr). The rest are
 * (alias, label, descr) -- passing a technology to those would silently land
 * in the description slot.
 */
const KINDS_WITH_TECHNOLOGY: readonly C4ElementKind[] = ['Container', 'ContainerDb', 'ContainerQueue'];

/** A name that can be referenced bare, with no quoting or alias. */
const BARE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * PlantUML macro arguments are double-quoted with no escape that survives the
 * preprocessor, so an embedded double quote is folded to a single one rather
 * than breaking the line. Users type prose here; they should never see a
 * syntax error because of an apostrophe-shaped choice.
 */
function quote(value: string): string {
  return `"${value.trim().replace(/"/g, "'")}"`;
}

/**
 * Derives a PlantUML identifier from a display name: "Web Application" ->
 * webApplication, de-duplicated against ids already in use.
 *
 * The wizard asks for a name, never an id -- relationships and messages are
 * built from pickers over the added items, so an id is an implementation
 * detail the user has no reason to author. That does mean a wizard-built
 * diagram uses derived ids where the hand-written starter templates use
 * shorter hand-picked ones (`webApplication` vs `web`), which is why the
 * generated document is structurally, not byte-for-byte, identical to them.
 */
export function deriveId(name: string, taken: readonly string[]): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word.length > 0);
  let base = words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join('');

  if (base.length === 0) {
    base = 'item';
  }
  if (/^[0-9]/.test(base)) {
    base = `n${base}`;
  }
  if (!taken.includes(base)) {
    return base;
  }

  let suffix = 2;
  while (taken.includes(`${base}${suffix}`)) {
    suffix += 1;
  }
  return `${base}${suffix}`;
}

/**
 * A participant keeps its own name as its reference when the name is already a
 * bare identifier (`actor Customer`), and only earns an alias when it isn't
 * (`participant "Web App" as webApp`) -- the same split the hand-written
 * sequence starter makes.
 */
export function deriveParticipantId(name: string, taken: readonly string[]): string {
  const trimmed = name.trim();
  if (BARE_IDENTIFIER.test(trimmed) && !taken.includes(trimmed)) {
    return trimmed;
  }
  return deriveId(trimmed, taken);
}

function elementLine(element: C4Element, indent: string): string {
  const args: string[] = [element.id, quote(element.name)];

  if (KINDS_WITH_TECHNOLOGY.includes(element.kind)) {
    // The technology slot must be held open (even empty) whenever a
    // description follows it, or the description would be read as the
    // technology.
    if (element.technology.trim() || element.description.trim()) {
      args.push(quote(element.technology));
    }
  }
  if (element.description.trim()) {
    args.push(quote(element.description));
  }

  return `${indent}${element.kind}(${args.join(', ')})`;
}

function boundaryBlock(boundary: C4Element, elements: readonly C4Element[]): string[] {
  const children = elements.filter((element) => element.boundaryId === boundary.id);
  return [
    `System_Boundary(${boundary.id}, ${quote(boundary.name)}) {`,
    ...children.map((child) => elementLine(child, '  ')),
    '}',
  ];
}

function relationshipLine(relationship: C4Relationship): string {
  const args: string[] = [relationship.fromId, relationship.toId, quote(relationship.label)];
  if (relationship.technology.trim()) {
    args.push(quote(relationship.technology));
  }
  return `Rel(${args.join(', ')})`;
}

/**
 * Root-level elements in add order, with each System_Boundary block separated
 * from its neighbours by a blank line while consecutive plain elements stay
 * together -- the grouping the seeded C4 starters use.
 */
function c4Body(elements: readonly C4Element[]): string[] {
  const segments: string[][] = [];
  let plain: string[] = [];

  for (const element of elements.filter((candidate) => candidate.boundaryId === null)) {
    if (element.kind === 'System_Boundary') {
      if (plain.length > 0) {
        segments.push(plain);
        plain = [];
      }
      segments.push(boundaryBlock(element, elements));
    } else {
      plain.push(elementLine(element, ''));
    }
  }
  if (plain.length > 0) {
    segments.push(plain);
  }

  return segments.flatMap((segment, index) => (index === 0 ? segment : ['', ...segment]));
}

/**
 * The whole C4 document. Called with no elements it yields the four-line
 * skeleton the wizard writes the moment a diagram type is picked, so the user
 * sees the shape of what they are building before they have added anything.
 */
export function buildC4Diagram(
  type: C4DiagramType,
  elements: readonly C4Element[],
  relationships: readonly C4Relationship[],
): string {
  const lines: string[] = ['@startuml', '!define RELATIVE_INCLUDE', `!include ${C4_INCLUDES[type]}`];

  const body = c4Body(elements);
  if (body.length > 0) {
    lines.push('', ...body);
  }
  if (relationships.length > 0) {
    lines.push('', ...relationships.map(relationshipLine));
  }

  lines.push('@enduml');
  return lines.join('\n');
}

export function buildSequenceDiagram(
  participants: readonly SequenceParticipant[],
  messages: readonly SequenceMessage[],
): string {
  const lines: string[] = ['@startuml'];

  for (const participant of participants) {
    lines.push(
      participant.id === participant.name
        ? `${participant.kind} ${participant.name}`
        : `${participant.kind} ${quote(participant.name)} as ${participant.id}`,
    );
  }
  if (messages.length > 0) {
    lines.push('', ...messages.map((message) => `${message.fromId} ${message.arrow} ${message.toId} : ${message.label.trim()}`));
  }

  lines.push('@enduml');
  return lines.join('\n');
}

/**
 * Splices the wizard's new document over the one it last wrote.
 *
 * This is what keeps the wizard one-way without making it destructive. It
 * never inspects the buffer for meaning -- it only looks for the exact text it
 * put there itself. If that text is still present it is replaced in place;
 * otherwise the diagram is appended, leaving whatever the user has written
 * untouched. (The buffer having been hand-edited past recognition is the one
 * case where appending can duplicate content -- the honest trade for never
 * silently overwriting someone's own work.)
 */
export function applyWizardDiagram(current: string, change: WizardDiagramChange): string {
  if (change.previousPlantUml) {
    const at = current.indexOf(change.previousPlantUml);
    if (at !== -1) {
      return current.slice(0, at) + change.plantUml + current.slice(at + change.previousPlantUml.length);
    }
  }
  if (current.trim().length === 0) {
    return change.plantUml;
  }
  return `${current.replace(/\s+$/, '')}\n\n${change.plantUml}`;
}
