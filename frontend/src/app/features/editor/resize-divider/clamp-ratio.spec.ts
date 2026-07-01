import { clampRatio } from './clamp-ratio';

describe('clampRatio', () => {
  it('returns the value unchanged when already within bounds', () => {
    expect(clampRatio(0.5, 0.2, 0.8)).toBe(0.5);
  });

  it('clamps a value below the minimum up to the minimum', () => {
    expect(clampRatio(0.05, 0.2, 0.8)).toBe(0.2);
  });

  it('clamps a value above the maximum down to the maximum', () => {
    expect(clampRatio(0.95, 0.2, 0.8)).toBe(0.8);
  });

  it('returns the boundary value itself when value equals min or max', () => {
    expect(clampRatio(0.2, 0.2, 0.8)).toBe(0.2);
    expect(clampRatio(0.8, 0.2, 0.8)).toBe(0.8);
  });
});
