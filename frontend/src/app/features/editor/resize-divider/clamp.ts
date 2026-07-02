/**
 * Clamps `value` into the inclusive [min, max] range.
 *
 * Its own file (rather than a helper tucked inside the divider component)
 * because it's a pure, trivially unit-testable function used both by the
 * divider component's drag/keyboard math and by the editor page when it
 * seeds the initial pane ratio and side-panel width from persisted
 * preferences.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
