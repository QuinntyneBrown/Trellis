import { DocumentSummary } from '../../../core/models/document-summary.model';

/**
 * The Quick Open vocabulary. Local to the feature: nothing here crosses the
 * API boundary -- documents come from the existing DocumentSummary model and
 * commands are ids the editor page dispatches to handlers it already has.
 */

/** One entry of the '>'-prefix command list. The editor page owns the catalog. */
export interface QuickOpenCommand {
  readonly id: string;
  readonly label: string;
  /** Right-aligned keyboard hint (e.g. "Ctrl+S"); commands without one show nothing. */
  readonly shortcutHint?: string;
}

/**
 * How a dismissal ended, so the widget knows whether to put focus back on the
 * pill. Escape restores focus (keyboard flows must not strand focus); outside
 * clicks and Tab do not (the user has already directed focus elsewhere) --
 * the same split the tree context menu makes.
 */
export interface QuickOpenDismissedEvent {
  readonly restoreFocus: boolean;
}

/** One run of row text, marked when the fuzzy match hit it. */
export interface HighlightSegment {
  readonly text: string;
  readonly hit: boolean;
}

/**
 * A fully render-ready result row. Rows are precomputed -- segments and the
 * folder path included -- so the template stays logic-free and the results
 * binding can be one stable computed(), never a getter (the change-detection
 * feedback-loop rule from TreeContextMenuComponent).
 */
export type QuickOpenRow =
  | {
      readonly type: 'document';
      readonly document: DocumentSummary;
      readonly segments: readonly HighlightSegment[];
      readonly folderPath: string;
      /**
       * Content-match excerpt with the matched term marked, or null when the
       * document surfaced by its name alone (nothing to show a second line for).
       */
      readonly snippet: readonly HighlightSegment[] | null;
    }
  | {
      readonly type: 'command';
      readonly command: QuickOpenCommand;
      readonly segments: readonly HighlightSegment[];
    };
