/**
 * Clamps `value` into the inclusive [min, max] range.
 *
 * Its own file (rather than a helper tucked inside the divider component)
 * because it's a pure, trivially unit-testable function used both by the
 * divider component's drag/keyboard math and by the editor page when it
 * seeds the initial ratio from persisted preferences.
 */
export function clampRatio(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
