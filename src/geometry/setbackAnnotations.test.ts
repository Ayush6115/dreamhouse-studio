import { describe, expect, it } from 'vitest';
import { setbackAnnotations } from './setbackAnnotations';

const rect = (x: number, y: number, w: number, h: number) => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

describe('setbackAnnotations', () => {
  it('collapses a uniform rectangular setback to one annotation per side', () => {
    const anns = setbackAnnotations(rect(0, 0, 20, 14), rect(2, 2, 16, 10));
    expect(anns).toHaveLength(4);
    for (const a of anns) expect(a.distance).toBeCloseTo(2, 6);
  });

  it('keeps distinct values per side for unequal setbacks', () => {
    // front 4 m, rear 1 m, left 2 m, right 3 m
    const anns = setbackAnnotations(rect(0, 0, 20, 14), rect(2, 1, 15, 9));
    const ds = anns.map((a) => Math.round(a.distance * 100) / 100).sort((a, b) => a - b);
    expect(ds).toEqual([1, 2, 3, 4]);
  });

  it('reports both corner values when the setback varies along an edge', () => {
    // skewed plot edge: buildable stays axis-aligned, plot right edge slants
    const plot = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 26, y: 14 }, // slanted right boundary
      { x: 0, y: 14 },
    ];
    const anns = setbackAnnotations(plot, rect(2, 2, 16, 10));
    // right-side clearances at the two corners must both be present & differ
    const right = anns.filter((a) => a.from.x > 17).map((a) => a.distance);
    expect(right.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...right) - Math.min(...right)).toBeGreaterThan(1);
  });

  it('measures true perpendicular distance to slanted boundaries', () => {
    const plot = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const anns = setbackAnnotations(plot, [
      { x: 3, y: 3 },
      { x: 7, y: 3 },
      { x: 7, y: 7 },
      { x: 3, y: 7 },
    ]);
    for (const a of anns) {
      expect(a.distance).toBeCloseTo(3, 6);
      // the measured segment must be perpendicular to an axis (this plot is
      // rectangular, so from→to is axis-aligned)
      const dx = Math.abs(a.from.x - a.to.x);
      const dy = Math.abs(a.from.y - a.to.y);
      expect(Math.min(dx, dy)).toBeLessThan(1e-9);
    }
  });

  it('marks varying edges and keeps their start and end stations', () => {
    const plot = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 26, y: 14 },
      { x: 0, y: 14 },
    ];
    const anns = setbackAnnotations(plot, rect(2, 2, 16, 10));
    const varying = anns.filter((a) => a.varies);
    expect(varying.length).toBeGreaterThanOrEqual(2);
    expect(varying.filter((a) => a.note === 'varies')).toHaveLength(1);
    // uniform edges stay unmarked
    expect(anns.some((a) => !a.varies)).toBe(true);
  });

  it('returns empty for degenerate inputs', () => {
    expect(setbackAnnotations([], rect(0, 0, 4, 4))).toEqual([]);
    expect(setbackAnnotations(rect(0, 0, 4, 4), [])).toEqual([]);
  });
});
