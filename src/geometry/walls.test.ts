import { describe, expect, it } from 'vitest';
import type { WallElement } from '../types/elements';
import { identityTransform, pt } from '../types/geometry';
import { makeMaterial } from '../types/materials';
import { unionArea, wallLength, wallOutline } from './walls';
import { polygonArea } from './polygon';

const mkWall = (id: string, sx: number, sy: number, ex: number, ey: number, th = 0.2): WallElement => ({
  id,
  type: 'wall',
  name: id,
  start: pt(sx, sy),
  end: pt(ex, ey),
  transform: identityTransform(),
  dimensions: { width: Math.hypot(ex - sx, ey - sy), height: 3, depth: th, thickness: th },
  material: makeMaterial({ id: 'test', name: 'Test', color: '#ccc' }),
});

describe('walls', () => {
  it('isolated wall outline is an exact rectangle', () => {
    const w = mkWall('a', 0, 0, 4, 0);
    const outline = wallOutline(w, [w]);
    expect(outline).toHaveLength(4);
    expect(polygonArea(outline)).toBeCloseTo(4 * 0.2);
    const ys = outline.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[0]).toBeCloseTo(-0.1);
    expect(ys[3]).toBeCloseTo(0.1);
  });

  it('L-join miters exactly: outer corner closes, areas add without overlap', () => {
    const a = mkWall('a', 0, 0, 4, 0);
    const b = mkWall('b', 4, 0, 4, 3);
    const walls = [a, b];
    const oa = wallOutline(a, walls);
    const ob = wallOutline(b, walls);

    // The outer corner (4.1, -0.1) must be a vertex of both outlines.
    const hasOuter = (o: { x: number; y: number }[]) =>
      o.some((p) => Math.abs(p.x - 4.1) < 1e-9 && Math.abs(p.y + 0.1) < 1e-9);
    expect(hasOuter(oa)).toBe(true);
    expect(hasOuter(ob)).toBe(true);

    // Miter trapezoid areas equal centerline length × thickness…
    expect(polygonArea(oa)).toBeCloseTo(4 * 0.2);
    expect(polygonArea(ob)).toBeCloseTo(3 * 0.2);
    // …and the union has zero overlap: total = Σ len·th exactly.
    expect(unionArea([oa, ob])).toBeCloseTo((4 + 3) * 0.2, 6);
  });

  it('T-junction area is handled by the union (stem overlap deduplicated)', () => {
    const through = mkWall('a', 0, 0, 6, 0);
    const stem = mkWall('b', 3, 0, 3, 3);
    const walls = [through, stem];
    const outlines = walls.map((w) => wallOutline(w, walls));
    // Naive sum double-counts the stem butt overlapping the through wall
    // (0.1 m deep × 0.2 m wide = 0.02 m²).
    const naive = (6 + 3) * 0.2;
    expect(unionArea(outlines)).toBeCloseTo(naive - 0.02, 6);
  });

  it('collinear continuation falls back to butt caps', () => {
    const a = mkWall('a', 0, 0, 3, 0);
    const b = mkWall('b', 3, 0, 6, 0);
    const walls = [a, b];
    const oa = wallOutline(a, walls);
    expect(polygonArea(oa)).toBeCloseTo(3 * 0.2);
    expect(unionArea(walls.map((w) => wallOutline(w, walls)))).toBeCloseTo(6 * 0.2, 6);
  });

  it('measures centerline length', () => {
    expect(wallLength(mkWall('a', 0, 0, 3, 4))).toBeCloseTo(5);
  });
});
