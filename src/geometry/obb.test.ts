import { describe, expect, it } from 'vitest';
import { obbAabb, obbOverlap } from './obb';

describe('obb', () => {
  it('detects overlap of axis-aligned boxes', () => {
    expect(obbOverlap({ c: { x: 0, y: 0 }, w: 2, d: 2, rot: 0 }, { c: { x: 1.5, y: 0 }, w: 2, d: 2, rot: 0 })).toBe(true);
    expect(obbOverlap({ c: { x: 0, y: 0 }, w: 2, d: 2, rot: 0 }, { c: { x: 2.5, y: 0 }, w: 2, d: 2, rot: 0 })).toBe(false);
  });

  it('touching boxes do not count as colliding (tolerance)', () => {
    expect(obbOverlap({ c: { x: 0, y: 0 }, w: 2, d: 2, rot: 0 }, { c: { x: 2, y: 0 }, w: 2, d: 2, rot: 0 })).toBe(false);
  });

  it('handles rotated boxes (diamond fits in the gap)', () => {
    // A 45°-rotated unit box centered between two boxes 2.4 apart.
    const rotated = { c: { x: 1.2, y: 1.2 }, w: 1, d: 1, rot: Math.PI / 4 };
    expect(obbOverlap({ c: { x: 0, y: 0 }, w: 1, d: 1, rot: 0 }, rotated)).toBe(false);
    // Move it closer — now it overlaps.
    expect(obbOverlap({ c: { x: 0, y: 0 }, w: 1, d: 1, rot: 0 }, { ...rotated, c: { x: 0.8, y: 0.2 } })).toBe(true);
  });

  it('computes rotated AABB', () => {
    const box = obbAabb({ c: { x: 0, y: 0 }, w: 2, d: 2, rot: Math.PI / 4 });
    const half = Math.SQRT2;
    expect(box.max.x).toBeCloseTo(half);
    expect(box.min.y).toBeCloseTo(-half);
  });
});
