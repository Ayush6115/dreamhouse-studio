import { describe, expect, it } from 'vitest';
import type { OpeningElement, RoofElement, WallElement } from '../../types';
import { identityTransform, pt } from '../../types/geometry';
import { makeMaterial } from '../../types/materials';
import { polygonArea } from '../../geometry/polygon';
import { roofClampAt, trimPiecesToRoofs, wallPieces } from './geometry3d';

const mat = makeMaterial({ id: 't', name: 'T', color: '#ccc' });

const wall = (id: string, sx: number, sy: number, ex: number, ey: number): WallElement => ({
  id,
  type: 'wall',
  name: id,
  start: pt(sx, sy),
  end: pt(ex, ey),
  transform: identityTransform(),
  dimensions: { width: 0, height: 3, depth: 0.2, thickness: 0.2 },
  material: mat,
});

const opening = (
  id: string,
  wallId: string,
  type: 'door' | 'window',
  offset: number,
  width: number,
  height: number,
  sillHeight: number,
): OpeningElement => ({
  id,
  type,
  name: id,
  wallId,
  offset,
  sillHeight,
  style: 'single',
  transform: identityTransform(),
  dimensions: { width, height, depth: 0.05 },
  material: mat,
});

describe('wallPieces', () => {
  it('solid wall produces a single full-height piece', () => {
    const w = wall('a', 0, 0, 5, 0);
    const pieces = wallPieces(w, [w], []);
    expect(pieces).toHaveLength(1);
    expect(pieces[0].z0).toBe(0);
    expect(pieces[0].z1).toBe(3);
    expect(polygonArea(pieces[0].poly)).toBeCloseTo(5 * 0.2, 5);
  });

  it('a door splits the wall into two full pieces + a lintel', () => {
    const w = wall('a', 0, 0, 5, 0);
    const door = opening('d', 'a', 'door', 2.5, 1, 2.1, 0);
    const pieces = wallPieces(w, [w], [door]);
    expect(pieces).toHaveLength(3);
    const full = pieces.filter((p) => p.z1 === 3 && p.z0 === 0);
    const lintel = pieces.filter((p) => p.z0 > 0);
    expect(full).toHaveLength(2);
    expect(lintel).toHaveLength(1);
    expect(lintel[0].z0).toBeCloseTo(2.1);
    // Plan coverage is conserved: side pieces 2+2 m, lintel 1 m.
    const area = (ps: typeof pieces) => ps.reduce((s, p) => s + polygonArea(p.poly), 0);
    expect(area(full)).toBeCloseTo(4 * 0.2, 4);
    expect(area(lintel)).toBeCloseTo(1 * 0.2, 4);
  });

  it('a window adds both a sill piece and a lintel', () => {
    const w = wall('a', 0, 0, 5, 0);
    const win = opening('n', 'a', 'window', 2.5, 1.2, 1.2, 0.9);
    const pieces = wallPieces(w, [w], [win]);
    // 2 sides + sill + lintel
    expect(pieces).toHaveLength(4);
    const sill = pieces.find((p) => p.z0 === 0 && p.z1 !== 3)!;
    const lintel = pieces.find((p) => p.z0 > 0)!;
    expect(sill.z1).toBeCloseTo(0.9);
    expect(lintel.z0).toBeCloseTo(2.1);
    expect(lintel.z1).toBe(3);
  });

  it('full-height opening produces no lintel', () => {
    const w = wall('a', 0, 0, 5, 0);
    const door = opening('d', 'a', 'door', 2.5, 1, 3, 0);
    const pieces = wallPieces(w, [w], [door]);
    expect(pieces).toHaveLength(2);
  });
});

describe('wall-to-roof trimming', () => {
  // Gable over a 10×8 footprint, base 3 m, 45° pitch → ridge rise = 4 m,
  // ridge along x at local y = 0 (world y = 4).
  const roof: RoofElement = {
    id: 'r',
    type: 'roof',
    name: 'Roof',
    roofStyle: 'gable',
    pitch: 45,
    overhang: 0,
    parapetHeight: 0,
    skylights: [],
    dormers: [],
    transform: { ...identityTransform(), position: { x: 5, y: 4, z: 3 } },
    dimensions: { width: 10, height: 0, depth: 8, thickness: 0.15 },
    material: mat,
  };

  it('clamp follows the gable slope', () => {
    // At the ridge (y=4): 3 + 4 − tuck; at the eave (y=0): 3 + 0 − tuck.
    expect(roofClampAt([roof], 5, 4)).toBeCloseTo(7 - 0.02, 3);
    expect(roofClampAt([roof], 5, 0)).toBeCloseTo(3 - 0.02, 3);
    expect(roofClampAt([roof], 5, 2)).toBeCloseTo(5 - 0.02, 3);
    // Outside the footprint: unclamped.
    expect(roofClampAt([roof], 20, 20)).toBe(Infinity);
  });

  it('a tall gable-end wall is trimmed to the slope', () => {
    // Wall across the roof (crossing the ridge), 6 m tall — must be cut.
    const w = wall('a', 5, 0, 5, 8);
    w.dimensions.height = 6;
    const pieces = trimPiecesToRoofs(wallPieces(w, [w], []), w, [roof]);
    expect(pieces.length).toBeGreaterThan(10); // sliced into strips
    const tops = pieces.map((p) => p.z1);
    // Near the ridge the roof allows 6.9 m — taller than the wall — so the
    // wall keeps its own 6 m top there; near the eaves it is cut to ~3 m.
    expect(Math.max(...tops)).toBeCloseTo(6, 5);
    expect(Math.min(...tops)).toBeLessThan(3.4);
    // A strip ~1.5 m from the eave must be cut to ≈ 3 + 1.5 − tuck.
    const midStrip = pieces.find((p) => p.poly.every((v) => v.y > 1.2 && v.y < 1.8));
    expect(midStrip).toBeDefined();
    expect(midStrip!.z1).toBeGreaterThan(4.1);
    expect(midStrip!.z1).toBeLessThan(4.85);
    // Every strip stays below the roof surface at its own location.
    for (const p of pieces) {
      for (const v of p.poly) {
        expect(p.z1).toBeLessThanOrEqual(roofClampAt([roof], v.x, v.y) + 0.16); // strip tolerance
      }
    }
  });

  it('walls clear of any roof are untouched', () => {
    const w = wall('a', 20, 20, 25, 20);
    const pieces = wallPieces(w, [w], []);
    expect(trimPiecesToRoofs(pieces, w, [roof])).toEqual(pieces);
  });

  it('flat roofs never trim walls', () => {
    const flat: RoofElement = { ...roof, roofStyle: 'flat' };
    const w = wall('a', 5, 0, 5, 8);
    w.dimensions.height = 6;
    const pieces = wallPieces(w, [w], []);
    expect(trimPiecesToRoofs(pieces, w, [flat])).toHaveLength(pieces.length);
  });
});
