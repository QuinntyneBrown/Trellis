/**
 * The Diagram Wizard's own vocabulary. These types are deliberately local to
 * the feature rather than in core/models: nothing here crosses the API
 * boundary -- the wizard generates PlantUML entirely in the browser and the
 * backend never sees a wizard concept, only the finished source it renders.
 */

/** Which of the two guided flows the user picked in step 1. */
export type WizardTrack = 'c4' | 'sequence';

/**
 * The five C4 views the vendored C4-PlantUML ships (backend/src/Trellis.Api/
 * Vendor/c4-plantuml/): each maps to the !include the generated diagram opens
 * with.
 */
export type C4DiagramType = 'Context' | 'Container' | 'Component' | 'Dynamic' | 'Deployment';

/**
 * The C4-PlantUML macros the wizard can emit. Split by arity when generated:
 * Person/System take (id, name, description); Container* additionally take a
 * technology; System_Boundary opens a brace block instead of a single line.
 */
export type C4ElementKind =
  | 'Person'
  | 'Person_Ext'
  | 'System'
  | 'System_Ext'
  | 'System_Boundary'
  | 'Container'
  | 'ContainerDb'
  | 'ContainerQueue';

/**
 * One added element. `id` is derived from the name (see deriveId) rather than
 * typed: the user never writes or reads an id -- relationships are built from
 * From/To pickers over these elements -- so asking for one would be friction
 * with no payoff.
 */
export interface C4Element {
  readonly id: string;
  readonly kind: C4ElementKind;
  readonly name: string;
  /** Only emitted for the Container* kinds; the other macros take no technology. */
  readonly technology: string;
  readonly description: string;
  /** The id of the System_Boundary this element sits inside, or null for the diagram root. */
  readonly boundaryId: string | null;
}

export interface C4Relationship {
  readonly fromId: string;
  readonly toId: string;
  readonly label: string;
  /** Optional: omitted from the Rel() call when blank. */
  readonly technology: string;
}

/** PlantUML's sequence participant keywords. */
export type SequenceParticipantKind =
  | 'participant'
  | 'actor'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'queue'
  | 'collections';

/**
 * A `box "Name" #color` grouping of participants. Boxes nest (that is why the
 * generated diagram opens with `!pragma teoz true` -- the classic engine
 * cannot draw a box inside a box). `id` is an internal counter ("box-1", ...)
 * that never reaches PlantUML: boxes have no alias syntax, so unlike
 * participants there is nothing to derive one from.
 */
export interface SequenceBox {
  readonly id: string;
  readonly name: string;
  /** Color name or hex without the leading '#'; '' means unstyled. */
  readonly color: string;
  /** The id of the box this box sits inside, or null for the diagram root. */
  readonly parentId: string | null;
}

/**
 * One added participant. `id` is what messages reference: the name itself when
 * it is already a bare PlantUML identifier, otherwise a derived alias (the
 * `participant "Web App" as webApp` form).
 */
export interface SequenceParticipant {
  readonly id: string;
  readonly kind: SequenceParticipantKind;
  readonly name: string;
  /** Color name or hex without the leading '#'; '' means unstyled. */
  readonly color: string;
  /** The id of the SequenceBox this participant sits inside, or null for the diagram root. */
  readonly boxId: string | null;
}

/** Solid call, dashed reply, and async -- PlantUML's three everyday arrows. */
export type SequenceArrow = '->' | '-->' | '->>';

/** The grouping fragments the wizard offers; an "if" is an alt (or opt) in PlantUML. */
export type SequenceGroupKind = 'alt' | 'opt' | 'loop' | 'group';

export type SequenceLifelineAction = 'activate' | 'deactivate';

/**
 * The body of a sequence diagram is one ordered list of steps -- messages,
 * `== section ==` dividers, group markers and manual lifeline commands --
 * mirroring how PlantUML itself reads them: line by line, top to bottom.
 *
 * Group open/else/end are flat marker steps rather than a nested tree so that
 * every row in the panel drags, selects and deletes the same way. The cost is
 * that the list can be momentarily unbalanced (an `end` before its `alt`, an
 * orphan `else`); buildSequenceDiagram repairs that at emission instead of the
 * UI forbidding it mid-drag.
 *
 * Every step has an `id` so selection and drag survive reordering; it is a
 * component counter ("step-1", ...) that never appears in the PlantUML.
 */
export interface SequenceMessageStep {
  readonly id: string;
  readonly kind: 'message';
  readonly fromId: string;
  readonly toId: string;
  readonly arrow: SequenceArrow;
  /** May be empty -- a reply often needs no words, and the ` : ` is then omitted. */
  readonly label: string;
}

export interface SequenceDividerStep {
  readonly id: string;
  readonly kind: 'divider';
  readonly label: string;
}

export interface SequenceGroupOpenStep {
  readonly id: string;
  readonly kind: 'group-open';
  readonly groupKind: SequenceGroupKind;
  readonly label: string;
}

export interface SequenceGroupElseStep {
  readonly id: string;
  readonly kind: 'group-else';
  readonly label: string;
}

export interface SequenceGroupEndStep {
  readonly id: string;
  readonly kind: 'group-end';
}

export interface SequenceLifelineStep {
  readonly id: string;
  readonly kind: 'lifeline';
  readonly action: SequenceLifelineAction;
  readonly participantId: string;
}

export type SequenceStep =
  | SequenceMessageStep
  | SequenceDividerStep
  | SequenceGroupOpenStep
  | SequenceGroupElseStep
  | SequenceGroupEndStep
  | SequenceLifelineStep;

/** Everything buildSequenceDiagram needs, as one value. */
export interface SequenceDiagramModel {
  /** '' means no title line. */
  readonly title: string;
  /**
   * When true the generator works out activations itself: a solid call
   * activates its target, the matching dashed reply deactivates it. Manual
   * lifeline steps are emitted either way.
   */
  readonly autoLifelines: boolean;
  readonly boxes: readonly SequenceBox[];
  readonly participants: readonly SequenceParticipant[];
  readonly steps: readonly SequenceStep[];
}

/**
 * What the panel hands the editor page on every change.
 *
 * The wizard is one-way: it never reads the editor to find out what is there.
 * Instead it remembers the exact document it last wrote and sends it back as
 * `previousPlantUml`, so the page can splice the new version over the old one
 * (see applyWizardDiagram). That is what lets the wizard rewrite its own block
 * -- necessary, because adding an element to a System_Boundary edits the
 * middle of the document, not the end -- without ever disturbing text the user
 * wrote themselves elsewhere in the buffer.
 */
export interface WizardDiagramChange {
  /** The full PlantUML document the wizard now owns. */
  readonly plantUml: string;
  /** The document this replaces, or null for the wizard's first write of a diagram. */
  readonly previousPlantUml: string | null;
  /**
   * Whether the diagram has enough in it to be worth rendering. A C4 skeleton
   * with no elements yet is written to the editor but not rendered -- PlantUML
   * would only answer with an error, and flashing one at someone who has done
   * nothing wrong is a poor way to start.
   */
  readonly renderable: boolean;
}
