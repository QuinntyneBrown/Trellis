export interface RenderResult {
  isSuccess: boolean;
  /** Rendered SVG markup for a successful PlantUML render, otherwise null. */
  svg: string | null;
  /** Rendered (server-sanitized) HTML for a successful markdown render, otherwise null. */
  html: string | null;
  errorMessage: string | null;
}
