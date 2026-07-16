/**
 * The response of both explain endpoints: a compact ready-to-paste prompt
 * plus the markdown attachment the user uploads alongside it.
 */
export interface ExplainPrompt {
  /** The compact "Explain This" prompt; names the attachment to upload. */
  prompt: string;
  /** The number of files included in the aggregation. */
  fileCount: number;
  /** The exact filename to use for the downloaded source attachment. */
  attachmentFileName: string;
  /** Aggregated source-file blocks written to the downloaded attachment. */
  attachmentContent: string;
}
