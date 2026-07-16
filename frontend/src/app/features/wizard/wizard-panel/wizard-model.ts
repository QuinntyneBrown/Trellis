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
 * One added participant. `id` is what messages reference: the name itself when
 * it is already a bare PlantUML identifier, otherwise a derived alias (the
 * `participant "Web App" as webApp` form).
 */
export interface SequenceParticipant {
  readonly id: string;
  readonly kind: SequenceParticipantKind;
  readonly name: string;
}

/** Solid call, dashed reply, and async -- PlantUML's three everyday arrows. */
export type SequenceArrow = '->' | '-->' | '->>';

export interface SequenceMessage {
  readonly fromId: string;
  readonly toId: string;
  readonly arrow: SequenceArrow;
  readonly label: string;
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
