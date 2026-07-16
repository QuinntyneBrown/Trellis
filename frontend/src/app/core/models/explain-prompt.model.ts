/**
 * The response of both explain endpoints: the ready-to-paste prompt markdown
 * and how many files it aggregates (surfaced by the wizard as confirmation).
 */
export interface ExplainPrompt {
  /** The complete "Explain This" prompt as markdown. */
  prompt: string;
  /** The number of files included in the aggregation. */
  fileCount: number;
}
