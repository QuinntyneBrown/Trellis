import { Component, EventEmitter, Output, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { TreeActionButtonComponent } from '../../../shared/components/tree-action-button/tree-action-button.component';
import { TreeContextMenuComponent } from '../../../shared/components/tree-context-menu/tree-context-menu.component';
import {
  TreeContextMenuItem,
  TreeContextMenuRequest,
} from '../../../shared/components/tree-context-menu/tree-context-menu.model';
import { buildC4Diagram, buildSequenceDiagram, deriveId, deriveParticipantId } from './build-wizard-plantuml';
import {
  computeStepDepths,
  deleteSteps,
  moveSteps,
  reverseAsReplies,
} from './sequence-step-operations';
import {
  C4DiagramType,
  C4Element,
  C4ElementKind,
  C4Relationship,
  SequenceArrow,
  SequenceBox,
  SequenceGroupKind,
  SequenceLifelineAction,
  SequenceParticipant,
  SequenceParticipantKind,
  SequenceStep,
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

/** What the "Insert Block" form can insert -- every non-message step kind. */
type SequenceBlockChoice = 'divider' | SequenceGroupKind | 'else' | 'end' | SequenceLifelineAction;

interface BlockOption {
  readonly kind: SequenceBlockChoice;
  readonly label: string;
}

/**
 * One rendered row of the sequence step list, with its display strings already
 * resolved. The template reads these instead of the step union directly, so it
 * never needs to narrow the discriminant itself: message rows use from/arrow/
 * to, every other kind carries a badge.
 */
interface SequenceStepRow {
  readonly step: SequenceStep;
  readonly index: number;
  readonly depth: number;
  readonly badge: string | null;
  readonly from: string | null;
  readonly arrow: string | null;
  readonly to: string | null;
  readonly text: string;
}

/**
 * Identifies a step-row drag in dataTransfer.types, the same way the
 * Documents tree identifies its rows -- only the presence of the type is
 * readable mid-drag (protected mode).
 */
export const STEP_DRAG_TYPE = 'application/x-trellis-wizard-step-id';

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

const BLOCK_OPTIONS: readonly BlockOption[] = [
  { kind: 'divider', label: '== section ==' },
  { kind: 'alt', label: 'alt — alternatives (if)' },
  { kind: 'opt', label: 'opt — optional (if)' },
  { kind: 'loop', label: 'loop' },
  { kind: 'group', label: 'group' },
  { kind: 'else', label: 'else — next branch' },
  { kind: 'end', label: 'end — close block' },
  { kind: 'activate', label: 'activate lifeline' },
  { kind: 'deactivate', label: 'deactivate lifeline' },
];

/**
 * A color the wizard will emit: empty, a 3/6-digit hex (leading # optional --
 * it is stripped either way), or a name PlantUML resolves (LightBlue). Anything
 * else disables the Add button rather than emitting a broken line.
 */
const COLOR_PATTERN = /^#?(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[A-Za-z]+)$/;

function isValidColor(color: string): boolean {
  const trimmed = color.trim();
  return trimmed.length === 0 || COLOR_PATTERN.test(trimmed);
}

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
 *
 * The sequence track's step list is the panel's one rich list: rows
 * multi-select (click / ctrl / shift), drag to reorder (native HTML5 DnD, the
 * Documents tree's idiom), and carry a right-click context menu for acting on
 * the whole selection.
 */
@Component({
  selector: 'app-wizard-panel',
  standalone: true,
  // FormsModule is here for the selects only: binding a plain [value] on a
  // <select> whose <option>s come from an @for does not stick, because the
  // value is applied before the options exist. ngModel handles the ordering,
  // and is what the save dialog already uses for the same reason. Text inputs
  // stay on raw (input) + signal.set, the Explain panel's idiom.
  imports: [FormsModule, TreeActionButtonComponent, TreeContextMenuComponent],
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
  readonly blockOptions = BLOCK_OPTIONS;

  readonly step = signal<WizardStep>('type');
  readonly track = signal<WizardTrack | null>(null);
  readonly c4Type = signal<C4DiagramType | null>(null);

  readonly elements = signal<readonly C4Element[]>([]);
  readonly relationships = signal<readonly C4Relationship[]>([]);
  readonly participants = signal<readonly SequenceParticipant[]>([]);
  readonly boxes = signal<readonly SequenceBox[]>([]);
  readonly steps = signal<readonly SequenceStep[]>([]);

  readonly sequenceTitle = signal('');
  readonly autoLifelines = signal(true);

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
  readonly participantColor = signal('');
  // Sticky across adds, unlike the other participant fields: filling a box
  // with several members in a row is the common case.
  readonly participantBoxId = signal<string | null>(null);

  /** Box form. */
  readonly boxName = signal('');
  readonly boxColor = signal('');
  readonly boxParentId = signal<string | null>(null);

  /** Message form. */
  readonly messageFromId = signal<string | null>(null);
  readonly messageToId = signal<string | null>(null);
  readonly messageArrow = signal<SequenceArrow>('->');
  readonly messageLabel = signal('');

  /** Insert-block form. */
  readonly blockKind = signal<SequenceBlockChoice>('divider');
  readonly blockLabel = signal('');
  readonly blockParticipantId = signal<string | null>(null);

  /** Step-list selection; the anchor is where a shift-click range grows from. */
  readonly selectedStepIds = signal<ReadonlySet<string>>(new Set());
  private selectionAnchorId: string | null = null;

  /** Step-list drag state: the dragged row, and the gap the drop would land in. */
  readonly draggingStepId = signal<string | null>(null);
  readonly dropIndex = signal<number | null>(null);
  /** Same child-element enter/leave counting the tree rows use -- see DocumentTreeNodeComponent.dragEnterCount. */
  private listDragEnterCount = 0;

  readonly contextMenuRequest = signal<TreeContextMenuRequest<SequenceStep> | null>(null);

  private stepIdSequence = 0;
  private boxIdSequence = 0;

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

  readonly stepRows = computed<readonly SequenceStepRow[]>(() => {
    const steps = this.steps();
    const depths = computeStepDepths(steps);
    return steps.map((step, index) => this.toStepRow(step, index, depths[index]));
  });

  // A computed, not a getter: the menu's [items] binding needs a stable array
  // reference for the lifetime of one open. A getter would mint a new array on
  // every change-detection pass, which the menu's ngOnChanges sees as a fresh
  // change each tick -- the feedback loop that used to wedge the tab (see
  // TreeContextMenuComponent.ngOnChanges).
  readonly contextMenuItems = computed<TreeContextMenuItem[]>(() => {
    const selected = this.selectedStepIds();
    if (selected.size === 0) {
      return [];
    }
    const callCount = this.steps().filter(
      (step) => selected.has(step.id) && step.kind === 'message' && step.arrow === '->',
    ).length;
    return [
      { id: 'reverse-replies', label: 'Reverse as replies', disabled: callCount === 0 },
      {
        id: 'delete',
        label: selected.size > 1 ? `Delete ${selected.size} steps` : 'Delete',
        danger: true,
        separatorBefore: true,
      },
    ];
  });

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
  readonly canAddParticipant = computed(
    () => this.participantName().trim().length > 0 && isValidColor(this.participantColor()),
  );
  readonly canAddBox = computed(() => this.boxName().trim().length > 0 && isValidColor(this.boxColor()));
  // No label requirement: a reply message often needs no words.
  readonly canAddMessage = computed(() => this.messageFromId() !== null && this.messageToId() !== null);

  readonly blockNeedsLabel = computed(() => {
    const kind = this.blockKind();
    return kind !== 'end' && kind !== 'activate' && kind !== 'deactivate';
  });
  readonly blockNeedsParticipant = computed(
    () => this.blockKind() === 'activate' || this.blockKind() === 'deactivate',
  );
  readonly canInsertBlock = computed(() => {
    switch (this.blockKind()) {
      case 'divider':
        return this.blockLabel().trim().length > 0;
      case 'activate':
      case 'deactivate':
        return this.blockParticipantId() !== null;
      default:
        return true;
    }
  });

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
    const messages = this.steps().filter((step) => step.kind === 'message').length;
    const blocks = this.steps().length - messages;
    return [
      count(this.participants().length, 'participant', 'participants'),
      count(messages, 'message', 'messages'),
      count(blocks, 'block', 'blocks'),
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

  boxName_(id: string | null): string {
    return id === null ? '' : this.boxes().find((box) => box.id === id)?.name ?? '';
  }

  /**
   * The CSS background for a color swatch, or null (no fill) when the field is
   * empty or not yet valid. Hex works with the # restored; names are passed
   * through -- PlantUML's everyday color names are CSS names too.
   */
  swatchBackground(color: string): string | null {
    const normalized = color.trim().replace(/^#/, '');
    if (normalized.length === 0 || !isValidColor(normalized)) {
      return null;
    }
    return /^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(normalized) ? `#${normalized}` : normalized;
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

  // -- sequence: title, boxes, participants ----------------------------------

  /**
   * The title emits on (change) -- commit on blur/Enter -- rather than every
   * keystroke: each emission rewrites the buffer and re-renders the preview,
   * which is the right cost per action but not per typed letter.
   */
  onTitleChanged(): void {
    this.emitDiagram();
  }

  addBox(): void {
    if (!this.canAddBox()) {
      return;
    }
    this.boxIdSequence += 1;
    this.boxes.update((list) => [
      ...list,
      {
        id: `box-${this.boxIdSequence}`,
        name: this.boxName().trim(),
        color: this.boxColor().trim(),
        parentId: this.boxParentId(),
      },
    ]);
    this.boxName.set('');
    this.boxColor.set('');
    this.boxParentId.set(null);
    this.emitDiagram();
  }

  /**
   * Deleting a box dissolves it in place: its members and its child boxes move
   * up to its parent (or the root), the same way removing a C4 boundary
   * returns its elements to the diagram root rather than vanishing them.
   */
  removeBox(id: string): void {
    const parentId = this.boxes().find((box) => box.id === id)?.parentId ?? null;
    this.boxes.update((list) =>
      list.filter((box) => box.id !== id).map((box) => (box.parentId === id ? { ...box, parentId } : box)),
    );
    this.participants.update((list) =>
      list.map((participant) => (participant.boxId === id ? { ...participant, boxId: parentId } : participant)),
    );
    if (this.participantBoxId() === id) {
      this.participantBoxId.set(parentId);
    }
    if (this.boxParentId() === id) {
      this.boxParentId.set(parentId);
    }
    this.emitDiagram();
  }

  addParticipant(): void {
    if (!this.canAddParticipant()) {
      return;
    }
    const name = this.participantName().trim();

    this.participants.update((list) => [
      ...list,
      {
        id: deriveParticipantId(name, list.map((participant) => participant.id)),
        kind: this.participantKind(),
        name,
        color: this.participantColor().trim(),
        boxId: this.participantBoxId(),
      },
    ]);
    this.participantKind.set('participant');
    this.participantName.set('');
    this.participantColor.set('');
    this.syncMessageForm();
    this.emitDiagram();
  }

  removeParticipant(id: string): void {
    this.participants.update((list) => list.filter((participant) => participant.id !== id));
    this.steps.update((list) =>
      list.filter((step) => {
        if (step.kind === 'message') {
          return step.fromId !== id && step.toId !== id;
        }
        if (step.kind === 'lifeline') {
          return step.participantId !== id;
        }
        return true;
      }),
    );
    this.pruneStepSelection();
    this.syncMessageForm();
    this.emitDiagram();
  }

  /** Per-row reassignment -- how a participant joins a box created after it was. */
  setParticipantBox(id: string, boxId: string | null): void {
    this.participants.update((list) =>
      list.map((participant) => (participant.id === id ? { ...participant, boxId } : participant)),
    );
    this.emitDiagram();
  }

  // -- sequence: steps --------------------------------------------------------

  onAutoLifelinesToggled(event: Event): void {
    this.autoLifelines.set((event.target as HTMLInputElement).checked);
    this.emitDiagram();
  }

  addMessage(): void {
    const fromId = this.messageFromId();
    const toId = this.messageToId();
    if (!this.canAddMessage() || fromId === null || toId === null) {
      return;
    }

    this.steps.update((list) => [
      ...list,
      { id: this.nextStepId(), kind: 'message', fromId, toId, arrow: this.messageArrow(), label: this.messageLabel().trim() },
    ]);
    this.resetMessageForm();
    this.emitDiagram();
  }

  /**
   * Inserts after the last selected row when there is a selection, else
   * appends -- and the inserted row becomes the selection, so consecutive
   * inserts chain in order like a cursor (alt, then else, then end). To wrap
   * rows that already exist: select them, insert the closing `end` (it lands
   * right below), then drag the opening marker in above.
   */
  insertBlock(): void {
    if (!this.canInsertBlock()) {
      return;
    }
    const step = this.buildBlockStep();
    if (step === null) {
      return;
    }
    this.steps.update((list) => {
      const at = this.insertionIndex(list);
      return [...list.slice(0, at), step, ...list.slice(at)];
    });
    this.selectedStepIds.set(new Set([step.id]));
    this.selectionAnchorId = step.id;
    this.blockLabel.set('');
    this.emitDiagram();
  }

  removeStep(id: string): void {
    this.steps.update((list) => list.filter((step) => step.id !== id));
    this.pruneStepSelection();
    this.emitDiagram();
  }

  // -- sequence: step selection ----------------------------------------------

  onStepRowClick(step: SequenceStep, event: MouseEvent): void {
    if (event.shiftKey && this.selectionAnchorId !== null) {
      const list = this.steps();
      const anchorIndex = list.findIndex((candidate) => candidate.id === this.selectionAnchorId);
      const targetIndex = list.findIndex((candidate) => candidate.id === step.id);
      if (anchorIndex !== -1 && targetIndex !== -1) {
        const [from, to] = anchorIndex <= targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
        this.selectedStepIds.set(new Set(list.slice(from, to + 1).map((candidate) => candidate.id)));
        return;
      }
    }
    if (event.ctrlKey || event.metaKey) {
      this.selectedStepIds.update((selected) => {
        const next = new Set(selected);
        if (next.has(step.id)) {
          next.delete(step.id);
        } else {
          next.add(step.id);
        }
        return next;
      });
      this.selectionAnchorId = step.id;
      return;
    }
    this.selectedStepIds.set(new Set([step.id]));
    this.selectionAnchorId = step.id;
  }

  onStepRowContextMenu(step: SequenceStep, event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    // Right-clicking outside the selection retargets it (the file-manager
    // convention); right-clicking inside it keeps the selection for the menu.
    if (!this.selectedStepIds().has(step.id)) {
      this.selectedStepIds.set(new Set([step.id]));
      this.selectionAnchorId = step.id;
    }
    this.contextMenuRequest.set({
      target: step,
      clientX: event.clientX,
      clientY: event.clientY,
      triggerElement: event.currentTarget as HTMLElement,
    });
  }

  onStepContextMenuCommand(command: string): void {
    // A selected command takes over focus itself; Escape remains the path
    // that deliberately returns focus to the originating row.
    this.closeContextMenu(false);
    const selected = this.selectedStepIds();

    switch (command) {
      case 'reverse-replies':
        this.steps.update((list) => reverseAsReplies(list, selected, () => this.nextStepId()));
        this.emitDiagram();
        break;
      case 'delete':
        this.steps.update((list) => deleteSteps(list, selected));
        this.selectedStepIds.set(new Set());
        this.selectionAnchorId = null;
        this.emitDiagram();
        break;
    }
  }

  closeContextMenu(restoreFocus: boolean): void {
    const trigger = this.contextMenuRequest()?.triggerElement;
    this.contextMenuRequest.set(null);
    if (restoreFocus) {
      trigger?.focus();
    }
  }

  // -- sequence: step drag-reorder ---------------------------------------------
  // Native HTML5 DnD, the Documents tree's idiom (DocumentTreeNodeComponent):
  // a custom dataTransfer type identifies our rows, dragover must
  // preventDefault or the browser never fires drop, and enter/leave counting
  // keeps the indicator stable while crossing row children.

  onStepDragStart(step: SequenceStep, event: DragEvent): void {
    if (!event.dataTransfer) {
      return;
    }
    event.dataTransfer.setData(STEP_DRAG_TYPE, step.id);
    event.dataTransfer.setData('text/plain', step.id);
    event.dataTransfer.effectAllowed = 'move';
    this.draggingStepId.set(step.id);
  }

  onStepDragOver(index: number, event: DragEvent): void {
    if (!this.isStepDrag(event)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer!.dropEffect = 'move';
    // The row's upper half drops before it, the lower half after it.
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.dropIndex.set(event.clientY < rect.top + rect.height / 2 ? index : index + 1);
  }

  /** The list's own space below the last row drops at the end. */
  onStepListDragOver(event: DragEvent): void {
    if (!this.isStepDrag(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dropIndex.set(this.steps().length);
  }

  onStepListDragEnter(event: DragEvent): void {
    if (!this.isStepDrag(event)) {
      return;
    }
    event.preventDefault();
    this.listDragEnterCount += 1;
  }

  onStepListDragLeave(event: DragEvent): void {
    if (!this.isStepDrag(event)) {
      return;
    }
    this.listDragEnterCount = Math.max(0, this.listDragEnterCount - 1);
    if (this.listDragEnterCount === 0) {
      this.dropIndex.set(null);
    }
  }

  onStepDrop(event: DragEvent): void {
    if (!this.isStepDrag(event)) {
      return;
    }
    event.preventDefault();
    const draggedId = event.dataTransfer!.getData(STEP_DRAG_TYPE) || this.draggingStepId();
    const target = this.dropIndex();
    this.clearDragState();
    if (!draggedId || target === null) {
      return;
    }

    // Dragging a row that is part of a multi-selection moves the whole
    // selection (the file-manager convention); any other row moves alone.
    const selected = this.selectedStepIds();
    const movedIds = selected.has(draggedId) && selected.size > 1 ? selected : new Set([draggedId]);
    this.steps.update((list) => moveSteps(list, movedIds, target));
    this.emitDiagram();
  }

  /** Fires on the source row whether the drag completed or was cancelled. */
  onStepDragEnd(): void {
    this.clearDragState();
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

  private nextStepId(): string {
    this.stepIdSequence += 1;
    return `step-${this.stepIdSequence}`;
  }

  private toStepRow(step: SequenceStep, index: number, depth: number): SequenceStepRow {
    const base = { step, index, depth, from: null, arrow: null, to: null };
    switch (step.kind) {
      case 'message':
        return {
          ...base,
          badge: null,
          from: this.participantName_(step.fromId),
          arrow: step.arrow,
          to: this.participantName_(step.toId),
          text: step.label,
        };
      case 'divider':
        return { ...base, badge: '==', text: step.label };
      case 'group-open':
        return { ...base, badge: step.groupKind, text: step.label };
      case 'group-else':
        return { ...base, badge: 'else', text: step.label };
      case 'group-end':
        return { ...base, badge: 'end', text: '' };
      case 'lifeline':
        return { ...base, badge: step.action, text: this.participantName_(step.participantId) };
    }
  }

  private buildBlockStep(): SequenceStep | null {
    const kind = this.blockKind();
    const label = this.blockLabel().trim();
    const id = this.nextStepId();
    switch (kind) {
      case 'divider':
        return { id, kind: 'divider', label };
      case 'alt':
      case 'opt':
      case 'loop':
      case 'group':
        return { id, kind: 'group-open', groupKind: kind, label };
      case 'else':
        return { id, kind: 'group-else', label };
      case 'end':
        return { id, kind: 'group-end' };
      case 'activate':
      case 'deactivate': {
        const participantId = this.blockParticipantId();
        return participantId === null ? null : { id, kind: 'lifeline', action: kind, participantId };
      }
    }
  }

  private insertionIndex(list: readonly SequenceStep[]): number {
    const selected = this.selectedStepIds();
    let last = -1;
    list.forEach((step, index) => {
      if (selected.has(step.id)) {
        last = index;
      }
    });
    return last === -1 ? list.length : last + 1;
  }

  private pruneStepSelection(): void {
    const alive = new Set(this.steps().map((step) => step.id));
    this.selectedStepIds.update((selected) => new Set([...selected].filter((id) => alive.has(id))));
    if (this.selectionAnchorId !== null && !alive.has(this.selectionAnchorId)) {
      this.selectionAnchorId = null;
    }
  }

  private clearDragState(): void {
    this.draggingStepId.set(null);
    this.dropIndex.set(null);
    this.listDragEnterCount = 0;
  }

  private isStepDrag(event: DragEvent): boolean {
    return event.dataTransfer?.types.includes(STEP_DRAG_TYPE) ?? false;
  }

  private resetModel(): void {
    this.c4Type.set(null);
    this.elements.set([]);
    this.relationships.set([]);
    this.participants.set([]);
    this.boxes.set([]);
    this.steps.set([]);
    this.sequenceTitle.set('');
    this.autoLifelines.set(true);
    this.selectedStepIds.set(new Set());
    this.selectionAnchorId = null;
    this.closeContextMenu(false);
    this.clearDragState();
    this.resetElementForm();
    this.resetRelationshipForm();
    this.resetParticipantForm();
    this.resetBoxForm();
    this.resetMessageForm();
  }

  private resetElementForm(): void {
    this.elementKind.set('Person');
    this.elementName.set('');
    this.elementTechnology.set('');
    this.elementDescription.set('');
    this.elementBoundaryId.set(null);
  }

  private resetParticipantForm(): void {
    this.participantKind.set('participant');
    this.participantName.set('');
    this.participantColor.set('');
    this.participantBoxId.set(null);
  }

  private resetBoxForm(): void {
    this.boxName.set('');
    this.boxColor.set('');
    this.boxParentId.set(null);
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
    this.blockKind.set('divider');
    this.blockLabel.set('');
    this.blockParticipantId.set(ids[0] ?? null);
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
    this.blockParticipantId.set(pick(this.blockParticipantId(), ids, 0));
  }

  private buildDocument(): string | null {
    if (this.track() === 'c4') {
      const type = this.c4Type();
      return type === null ? null : buildC4Diagram(type, this.elements(), this.relationships());
    }
    if (this.track() === 'sequence') {
      return this.participants().length === 0
        ? null
        : buildSequenceDiagram({
            title: this.sequenceTitle(),
            autoLifelines: this.autoLifelines(),
            boxes: this.boxes(),
            participants: this.participants(),
            steps: this.steps(),
          });
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
