import { clamp } from './clamp';

describe('clamp', () => {
  it('returns the value unchanged when already within bounds', () => {
    expect(clamp(0.5, 0.2, 0.8)).toBe(0.5);
  });

  it('clamps a value below the minimum up to the minimum', () => {
    expect(clamp(0.05, 0.2, 0.8)).toBe(0.2);
  });

  it('clamps a value above the maximum down to the maximum', () => {
    expect(clamp(0.95, 0.2, 0.8)).toBe(0.8);
  });

  it('returns the boundary value itself when value equals min or max', () => {
    expect(clamp(0.2, 0.2, 0.8)).toBe(0.2);
    expect(clamp(0.8, 0.2, 0.8)).toBe(0.8);
  });

  it('works with pixel-scale ranges too', () => {
    expect(clamp(120, 170, 500)).toBe(170);
    expect(clamp(720, 170, 500)).toBe(500);
    expect(clamp(260, 170, 500)).toBe(260);
  });
});
