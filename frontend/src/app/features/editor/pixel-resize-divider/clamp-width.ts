/**
 * Clamps `value` into the inclusive [min, max] range.
 *
 * A deliberately fresh, small file (rather than reusing/renaming
 * resize-divider/clamp-ratio.ts) so this pixel-native divider's math never
 * churns that already-stable, already-tested ratio-based file -- the two
 * are trivially identical in implementation but conceptually distinct units
 * (a 0..1 ratio vs. a raw pixel count).
 */
export function clampWidthPx(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
