import { Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';
import { buildC4Diagram, buildSequenceDiagram, deriveId, deriveParticipantId } from './build-wizard-plantuml';
import {
  C4DiagramType,
  C4Element,
  C4ElementKind,
  C4Relationship,
  SequenceArrow,
  SequenceMessage,
  SequenceParticipant,
  SequenceParticipantKind,
  WizardDiagramChange,
  WizardTrack,
} from './wizard-model';

/** Where the flow currently is. The two tracks share the first and last steps. */
type WizardStep =
  | 'type'
  | 'c4-type'
  | 'c4-elements'
  | 'c4-relationships'
  | 'sequence-participants'
  | 'sequence-messages'
  | 'done';

/** One dot in the progress indicator. */
interface WizardPip {
  readonly label: string;
  readonly done: boolean;
  readonly current: boolean;
}

interface C4TypeOption {
  readonly type: C4DiagramType;
  readonly description: string;
}

interface ArrowOption {
  readonly arrow: SequenceArrow;
  readonly label: string;
}

const C4_TYPE_OPTIONS: readonly C4TypeOption[] = [
  { type: 'Context', description: 'Your system, its users and the systems it talks to.' },
  { type: 'Container', description: 'Applications and data stores inside your system.' },
  { type: 'Component', description: 'The building blocks inside a single container.' },
  { type: 'Dynamic', description: 'A numbered walkthrough of one scenario across elements.' },
  { type: 'Deployment', description: 'Where containers run: nodes, environments and infrastructure.' },
];

const C4_ELEMENT_KINDS: readonly C4ElementKind[] = [
  'Person',
  'Person_Ext',
  'System',
  'System_Ext',
  'System_Boundary',
  'Container',
  'ContainerDb',
  'ContainerQueue',
];

/** Short human labels for the kind badge on an added row -- the macro names are shouty. */
const C4_KIND_LABELS: Record<C4ElementKind, string> = {
  Person: 'Person',
  Person_Ext: 'Person (ext)',
  System: 'System',
  System_Ext: 'System (ext)',
  System_Boundary: 'Boundary',
  Container: 'Container',
  ContainerDb: 'Container DB',
  ContainerQueue: 'Container Queue',
};

const SEQUENCE_PARTICIPANT_KINDS: readonly SequenceParticipantKind[] = [
  'participant',
  'actor',
  'boundary',
  'control',
  'entity',
  'database',
  'queue',
  'collections',
];

const ARROW_OPTIONS: readonly ArrowOption[] = [
  { arrow: '->', label: '->  solid call' },
  { arrow: '-->', label: '-->  dashed reply' },
  { arrow: '->>', label: '->>  async' },
];

/**
 * The Diagram Wizard -- the fifth exclusive side panel. Walks the user through
 * building a C4 or sequence diagram a step at a time, for people who know what
 * they want to draw but not how PlantUML spells it.
 *
 * One-way by design (wizard -> diagram): every action rebuilds the document
 * from the wizard's own model and emits it, and the editor page splices it
 * over whatever the wizard last wrote. The wizard never reads the editor back,
 * so the buffer stays the user's -- they can hand-edit around the generated
 * diagram, and the wizard will not fight them for it.
 *
 * Rebuilding the whole document (rather than appending a line per action) is
 * what makes nesting work: adding a container to a System_Boundary edits the
 * middle of the document, not the end. It also makes removal free.
 */
@Component({
  selector: 'app-wizard-panel',
  standalone: true,
  // FormsModule is here for the selects only: binding a plain [value] on a
  // <select> whose <option>s come from an @for does not stick, because the
  // value is applied before the options exist. ngModel handles the ordering,
  // and is what the save dialog already uses for the same reason. Text inputs
  // stay on raw (input) + signal.set, the Explain panel's idiom.
  imports: [FormsModule, TreeActionButtonComponent],
  templateUrl: './wizard-panel.component.html',
  styleUrl: './wizard-panel.component.scss',
})
export class WizardPanelComponent {
  /** The wizard's document, ready for the editor page to splice into the buffer. */
  @Output() readonly diagramChanged = new EventEmitter<WizardDiagramChange>();
  /** Fired by Close; the page collapses the panel exactly as the rail toggle would. */
  @Output() readonly closed = new EventEmitter<void>();

  readonly c4TypeOptions = C4_TYPE_OPTIONS;
  readonly c4ElementKinds = C4_ELEMENT_KINDS;
  readonly sequenceParticipantKinds = SEQUENCE_PARTICIPANT_KINDS;
  readonly arrowOptions = ARROW_OPTIONS;

  readonly step = signal<WizardStep>('type');
  readonly track = signal<WizardTrack | null>(null);
  readonly c4Type = signal<C4DiagramType | null>(null);

  readonly elements = signal<readonly C4Element[]>([]);
  readonly relationships = signal<readonly C4Relationship[]>([]);
  readonly participants = signal<readonly SequenceParticipant[]>([]);
  readonly messages = signal<readonly SequenceMessage[]>([]);

  /** Element form. */
  readonly elementKind = signal<C4ElementKind>('Person');
  readonly elementName = signal('');
  readonly elementTechnology = signal('');
  readonly elementDescription = signal('');
  readonly elementBoundaryId = signal<string | null>(null);

  /** Relationship form. */
  readonly relationshipFromId = signal<string | null>(null);
  readonly relationshipToId = signal<string | null>(null);
  readonly relationshipLabel = signal('');
  readonly relationshipTechnology = signal('');

  /** Participant form. */
  readonly participantKind = signal<SequenceParticipantKind>('participant');
  readonly participantName = signal('');

  /** Message form. */
  readonly messageFromId = signal<string | null>(null);
  readonly messageToId = signal<string | null>(null);
  readonly messageArrow = signal<SequenceArrow>('->');
  readonly messageLabel = signal('');

  /**
   * The exact document last handed to the editor page. Sending it back with
   * the next change is what lets the page find and replace the wizard's own
   * text without the wizard ever having to read the buffer.
   */
  private lastEmitted: string | null = null;

  /** Boundaries an element can be dropped into. */
  readonly boundaries = computed(() => this.elements().filter((element) => element.kind === 'System_Boundary'));

  /** Everything a relationship can attach to -- a boundary is a grouping, not an endpoint. */
  readonly connectableElements = computed(() =>
    this.elements().filter((element) => element.kind !== 'System_Boundary'),
  );

  readonly pips = computed<WizardPip[]>(() => {
    const labels = this.stepLabels();
    const index = this.stepIndex();
    return labels.map((label, at) => ({
      label,
      done: this.step() === 'done' || at < index,
      current: this.step() !== 'done' && at === index,
    }));
  });

  readonly caption = computed(() => {
    if (this.step() === 'done') {
      return 'Diagram complete';
    }
    if (this.track() === null) {
      return 'Step 1 · Diagram type';
    }
    const labels = this.stepLabels();
    return `Step ${this.stepIndex() + 1} of ${labels.length} · ${labels[this.stepIndex()]}`;
  });

  readonly canAddElement = computed(() => this.elementName().trim().length > 0);
  readonly canAddRelationship = computed(
    () =>
      this.relationshipLabel().trim().length > 0 &&
      this.relationshipFromId() !== null &&
      this.relationshipToId() !== null,
  );
  readonly canAddParticipant = computed(() => this.participantName().trim().length > 0);
  readonly canAddMessage = computed(
    () => this.messageLabel().trim().length > 0 && this.messageFromId() !== null && this.messageToId() !== null,
  );

  readonly canGoBack = computed(() => this.step() !== 'type');

  readonly canGoNext = computed(() => {
    switch (this.step()) {
      case 'type':
        return this.track() !== null;
      case 'c4-type':
        return this.c4Type() !== null;
      case 'c4-elements':
        return this.elements().length > 0;
      case 'sequence-participants':
        return this.participants().length > 0;
      case 'c4-relationships':
      case 'sequence-messages':
        return true;
      default:
        return false;
    }
  });

  /** The last build step of either track finishes rather than advancing. */
  readonly isLastBuildStep = computed(
    () => this.step() === 'c4-relationships' || this.step() === 'sequence-messages',
  );

  readonly summary = computed(() => (this.track() === 'c4' ? 'C4 diagram complete.' : 'Sequence diagram complete.'));

  readonly summaryCounts = computed(() => {
    if (this.track() === 'c4') {
      const boundaries = this.boundaries().length;
      const people = this.elements().filter((element) => element.kind === 'Person' || element.kind === 'Person_Ext').length;
      const others = this.elements().length - boundaries - people;
      return [
        count(people, 'person', 'people'),
        count(boundaries, 'boundary', 'boundaries'),
        count(others, 'element', 'elements'),
        count(this.relationships().length, 'relationship', 'relationships'),
      ].join(' · ');
    }
    return [
      count(this.participants().length, 'participant', 'participants'),
      count(this.messages().length, 'message', 'messages'),
    ].join(' · ');
  });

  kindLabel(kind: C4ElementKind): string {
    return C4_KIND_LABELS[kind];
  }

  elementName_(id: string): string {
    return this.elements().find((element) => element.id === id)?.name ?? id;
  }

  participantName_(id: string): string {
    return this.participants().find((participant) => participant.id === id)?.name ?? id;
  }

  boundaryName(id: string | null): string {
    return id === null ? '' : this.boundaries().find((boundary) => boundary.id === id)?.name ?? '';
  }

  // -- step 1 ---------------------------------------------------------------

  selectTrack(track: WizardTrack): void {
    if (this.track() === track) {
      return;
    }
    // Switching tracks abandons the half-built diagram rather than trying to
    // translate it; the next emission replaces it in the editor.
    this.resetModel();
    this.track.set(track);
  }

  // -- C4 -------------------------------------------------------------------

  selectC4Type(type: C4DiagramType): void {
    this.c4Type.set(type);
    // Writes the skeleton straight away so the shape of the document is
    // visible before anything has been added. Not renderable yet -- see
    // WizardDiagramChange.renderable.
    this.emitDiagram();
  }

  addElement(): void {
    if (!this.canAddElement()) {
      return;
    }
    const kind = this.elementKind();
    const name = this.elementName().trim();
    const boundaryId = kind === 'System_Boundary' ? null : this.elementBoundaryId();

    this.elements.update((list) => [
      ...list,
      {
        id: deriveId(name, list.map((element) => element.id)),
        kind,
        name,
        technology: this.elementTechnology().trim(),
        description: this.elementDescription().trim(),
        boundaryId,
      },
    ]);
    this.resetElementForm();
    this.syncRelationshipForm();
    this.emitDiagram();
  }

  removeElement(id: string): void {
    this.elements.update((list) =>
      list
        .filter((element) => element.id !== id)
        // Removing a boundary must not orphan what was inside it -- those
        // elements return to the diagram root rather than vanishing.
        .map((element) => (element.boundaryId === id ? { ...element, boundaryId: null } : element)),
    );
    this.relationships.update((list) =>
      list.filter((relationship) => relationship.fromId !== id && relationship.toId !== id),
    );
    if (this.elementBoundaryId() === id) {
      this.elementBoundaryId.set(null);
    }
    this.syncRelationshipForm();
    this.emitDiagram();
  }

  addRelationship(): void {
    const fromId = this.relationshipFromId();
    const toId = this.relationshipToId();
    if (!this.canAddRelationship() || fromId === null || toId === null) {
      return;
    }

    this.relationships.update((list) => [
      ...list,
      { fromId, toId, label: this.relationshipLabel().trim(), technology: this.relationshipTechnology().trim() },
    ]);
    this.resetRelationshipForm();
    this.emitDiagram();
  }

  removeRelationship(index: number): void {
    this.relationships.update((list) => list.filter((_, at) => at !== index));
    this.emitDiagram();
  }

  // -- sequence -------------------------------------------------------------

  addParticipant(): void {
    if (!this.canAddParticipant()) {
      return;
    }
    const name = this.participantName().trim();

    this.participants.update((list) => [
      ...list,
      { id: deriveParticipantId(name, list.map((participant) => participant.id)), kind: this.participantKind(), name },
    ]);
    this.participantKind.set('participant');
    this.participantName.set('');
    this.syncMessageForm();
    this.emitDiagram();
  }

  removeParticipant(id: string): void {
    this.participants.update((list) => list.filter((participant) => participant.id !== id));
    this.messages.update((list) => list.filter((message) => message.fromId !== id && message.toId !== id));
    this.syncMessageForm();
    this.emitDiagram();
  }

  addMessage(): void {
    const fromId = this.messageFromId();
    const toId = this.messageToId();
    if (!this.canAddMessage() || fromId === null || toId === null) {
      return;
    }

    this.messages.update((list) => [
      ...list,
      { fromId, toId, arrow: this.messageArrow(), label: this.messageLabel().trim() },
    ]);
    this.resetMessageForm();
    this.emitDiagram();
  }

  removeMessage(index: number): void {
    this.messages.update((list) => list.filter((_, at) => at !== index));
    this.emitDiagram();
  }

  // -- navigation -----------------------------------------------------------

  next(): void {
    if (!this.canGoNext()) {
      return;
    }
    switch (this.step()) {
      case 'type':
        this.step.set(this.track() === 'c4' ? 'c4-type' : 'sequence-participants');
        break;
      case 'c4-type':
        this.step.set('c4-elements');
        break;
      case 'c4-elements':
        this.resetRelationshipForm();
        this.step.set('c4-relationships');
        break;
      case 'sequence-participants':
        this.resetMessageForm();
        this.step.set('sequence-messages');
        break;
      case 'c4-relationships':
      case 'sequence-messages':
        this.step.set('done');
        break;
      default:
        break;
    }
  }

  back(): void {
    switch (this.step()) {
      case 'c4-type':
      case 'sequence-participants':
        this.step.set('type');
        break;
      case 'c4-elements':
        this.step.set('c4-type');
        break;
      case 'c4-relationships':
        this.step.set('c4-elements');
        break;
      case 'sequence-messages':
        this.step.set('sequence-participants');
        break;
      default:
        break;
    }
  }

  /**
   * Starts a fresh diagram. lastEmitted is dropped too, so the next one is
   * appended after the finished diagram instead of replacing it -- Start
   * another diagram means another diagram, not a do-over of the last.
   */
  restart(): void {
    this.resetModel();
    this.track.set(null);
    this.step.set('type');
    this.lastEmitted = null;
  }

  close(): void {
    this.closed.emit();
  }

  // -- input plumbing -------------------------------------------------------
  // Raw events + signal.set, matching the Explain panel: this app uses neither
  // FormsModule nor ReactiveFormsModule anywhere.

  onTextInput(event: Event, target: { set(value: string): void }): void {
    target.set((event.target as HTMLInputElement).value);
  }

  // -- internals ------------------------------------------------------------

  private stepLabels(): string[] {
    switch (this.track()) {
      case 'c4':
        return ['Diagram type', 'C4 diagram', 'Elements', 'Relationships', 'Finish'];
      case 'sequence':
        return ['Diagram type', 'Participants', 'Messages', 'Finish'];
      default:
        // Before a track is chosen the flow's length is unknown; a generic
        // trio beats promising a step count that is about to change.
        return ['Diagram type', 'Build', 'Finish'];
    }
  }

  private stepIndex(): number {
    switch (this.step()) {
      case 'type':
        return 0;
      case 'c4-type':
      case 'sequence-participants':
        return 1;
      case 'c4-elements':
      case 'sequence-messages':
        return 2;
      case 'c4-relationships':
        return 3;
      default:
        return this.stepLabels().length - 1;
    }
  }

  private resetModel(): void {
    this.c4Type.set(null);
    this.elements.set([]);
    this.relationships.set([]);
    this.participants.set([]);
    this.messages.set([]);
    this.resetElementForm();
    this.resetRelationshipForm();
    this.participantKind.set('participant');
    this.participantName.set('');
    this.resetMessageForm();
  }

  private resetElementForm(): void {
    this.elementKind.set('Person');
    this.elementName.set('');
    this.elementTechnology.set('');
    this.elementDescription.set('');
    this.elementBoundaryId.set(null);
  }

  /**
   * Points the form at the first two elements and clears what was typed.
   * Used on entering the step and after each add: the common case is joining
   * up items in the order they were added, so returning to the head of the
   * list beats leaving the last pair selected and inviting a duplicate.
   */
  private resetRelationshipForm(): void {
    const ids = this.connectableElements().map((element) => element.id);
    this.relationshipFromId.set(ids[0] ?? null);
    this.relationshipToId.set(ids[1] ?? ids[0] ?? null);
    this.relationshipLabel.set('');
    this.relationshipTechnology.set('');
  }

  private resetMessageForm(): void {
    const ids = this.participants().map((participant) => participant.id);
    this.messageFromId.set(ids[0] ?? null);
    this.messageToId.set(ids[1] ?? ids[0] ?? null);
    this.messageArrow.set('->');
    this.messageLabel.set('');
  }

  /**
   * Keeps a selection valid when the underlying list shrinks -- unlike the
   * resets above, an explicit choice that still exists is left alone.
   */
  private syncRelationshipForm(): void {
    const ids = this.connectableElements().map((element) => element.id);
    this.relationshipFromId.set(pick(this.relationshipFromId(), ids, 0));
    this.relationshipToId.set(pick(this.relationshipToId(), ids, 1));
  }

  private syncMessageForm(): void {
    const ids = this.participants().map((participant) => participant.id);
    this.messageFromId.set(pick(this.messageFromId(), ids, 0));
    this.messageToId.set(pick(this.messageToId(), ids, 1));
  }

  private buildDocument(): string | null {
    if (this.track() === 'c4') {
      const type = this.c4Type();
      return type === null ? null : buildC4Diagram(type, this.elements(), this.relationships());
    }
    if (this.track() === 'sequence') {
      return this.participants().length === 0 ? null : buildSequenceDiagram(this.participants(), this.messages());
    }
    return null;
  }

  /** Whether there is enough here for PlantUML to draw something. */
  private isRenderable(): boolean {
    return this.track() === 'c4' ? this.elements().length > 0 : this.participants().length > 0;
  }

  private emitDiagram(): void {
    const plantUml = this.buildDocument();
    if (plantUml === null || plantUml === this.lastEmitted) {
      return;
    }
    const previousPlantUml = this.lastEmitted;
    this.lastEmitted = plantUml;
    this.diagramChanged.emit({ plantUml, previousPlantUml, renderable: this.isRenderable() });
  }
}

/** "1 person" / "3 people" -- a plural s is not always the right suffix. */
function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

/** Keeps a select's value valid, falling back to the nth option. */
function pick(current: string | null, ids: readonly string[], fallbackIndex: number): string | null {
  if (current !== null && ids.includes(current)) {
    return current;
  }
  return ids[fallbackIndex] ?? ids[0] ?? null;
}
