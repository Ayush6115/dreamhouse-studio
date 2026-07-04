import polygonClipping from 'polygon-clipping';
import type { OpeningElement, Point, RoofElement, WallElement } from '../../types';
import { add, dist, dot, norm, perp, scale, sub } from '../../geometry/vec';
import { polygonArea } from '../../geometry/polygon';
import { wallLength, wallOutline, wallThickness } from '../../geometry/walls';
import { roofSurfaceZ } from '../../geometry/roof';

/**
 * 3D wall generation WITHOUT CSG: the wall's plan outline (with correct
 * miters) is sliced into strips along the wall axis. Between openings the
 * strip extrudes floor→ceiling; over a door/window only the lintel extrudes;
 * under a window the sill wall extrudes. The result is exact and cheap to
 * recompute on every edit.
 */

export interface WallPiece {
  /** Plan polygon of the piece (meters). */
  poly: Point[];
  /** Vertical extent above the level floor (meters). */
  z0: number;
  z1: number;
}

type Ring = [number, number][];
const toRing = (pts: Point[]): Ring => pts.map((p) => [p.x, p.y]);
const fromRing = (ring: Ring): Point[] => ring.map(([x, y]) => ({ x, y }));

export function wallPieces(
  wall: WallElement,
  allWalls: WallElement[],
  openings: OpeningElement[],
): WallPiece[] {
  const outline = wallOutline(wall, allWalls);
  if (outline.length < 3) return [];
  const len = wallLength(wall);
  const th = wallThickness(wall);
  const h = wall.dimensions.height;
  const dir = norm(sub(wall.end, wall.start));
  const n = perp(dir);
  // Mitered corners can extend past the centerline ends; pad the end strips.
  const ext = th * 4 + 0.5;
  const reach = th / 2 + 0.02;

  const strip = (u1: number, u2: number): Ring => {
    const a1 = add(wall.start, scale(dir, u1));
    const a2 = add(wall.start, scale(dir, u2));
    return toRing([
      add(a1, scale(n, reach)),
      add(a2, scale(n, reach)),
      add(a2, scale(n, -reach)),
      add(a1, scale(n, -reach)),
    ]);
  };

  const clip = (u1: number, u2: number): Point[][] => {
    if (u2 - u1 < 1e-4) return [];
    const result = polygonClipping.intersection([toRing(outline)], [strip(u1, u2)]);
    const polys: Point[][] = [];
    for (const poly of result) {
      if (poly[0] && poly[0].length >= 3) polys.push(fromRing(poly[0] as Ring));
    }
    return polys;
  };

  const mine = openings
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const half = o.dimensions.width / 2;
      const from = Math.max(0, o.offset - half);
      const to = Math.min(len, o.offset + half);
      const sill = o.type === 'window' ? o.sillHeight : 0;
      const head = Math.min(h, sill + o.dimensions.height);
      return { from, to, sill, head };
    })
    .filter((c) => c.to > c.from)
    .sort((a, b) => a.from - b.from);

  const pieces: WallPiece[] = [];

  // Full-height strips between openings.
  let u = -ext;
  for (const cut of mine) {
    for (const poly of clip(u, cut.from)) pieces.push({ poly, z0: 0, z1: h });
    u = cut.to;
  }
  for (const poly of clip(u, len + ext)) pieces.push({ poly, z0: 0, z1: h });

  // Lintels above and sills below each opening.
  for (const cut of mine) {
    if (h - cut.head > 0.01) {
      for (const poly of clip(cut.from, cut.to)) pieces.push({ poly, z0: cut.head, z1: h });
    }
    if (cut.sill > 0.01) {
      for (const poly of clip(cut.from, cut.to)) pieces.push({ poly, z0: 0, z1: cut.sill });
    }
  }

  return pieces;
}

// ------------------------------------------------------- wall-to-roof trim

/** Tuck walls 2 cm inside the roof skin to avoid z-fighting. */
const ROOF_TUCK = 0.02;
const TRIM_STEP = 0.15; // strip width along the wall, meters

/**
 * Maximum height (above the level floor) a wall may reach at plan point
 * (x, y): the outer surface of the lowest covering sloped roof, minus a
 * small tuck. +Infinity when no roof covers the point.
 */
export function roofClampAt(roofs: RoofElement[], x: number, y: number): number {
  let clamp = Infinity;
  for (const roof of roofs) {
    const W = roof.dimensions.width + 2 * roof.overhang;
    const D = roof.dimensions.depth + 2 * roof.overhang;
    // world → roof-local (inverse rotation about the roof center)
    const dx = x - roof.transform.position.x;
    const dy = y - roof.transform.position.y;
    const cos = Math.cos(roof.transform.rotation);
    const sin = Math.sin(roof.transform.rotation);
    const lx = dx * cos + dy * sin;
    const ly = -dx * sin + dy * cos;
    const z = roofSurfaceZ(roof.roofStyle, W, D, roof.pitch, roof.dimensions.thickness ?? 0.15, lx, ly);
    if (z !== null) clamp = Math.min(clamp, roof.transform.position.z + z - ROOF_TUCK);
  }
  return clamp;
}

const centroidOf = (poly: Point[]): Point => {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
};

/**
 * Trim wall pieces so they stop at sloped roofs: pieces poking above a roof
 * surface are sliced into thin strips along the wall axis, each clamped to
 * the surface height at its location. The ≤ few-cm stair-steps sit inside
 * the roof solid, so the visible junction is clean. Gable-end walls made
 * taller than the roof base automatically become pitched gable walls.
 */
export function trimPiecesToRoofs(
  pieces: WallPiece[],
  wall: WallElement,
  roofs: RoofElement[],
): WallPiece[] {
  const sloped = roofs.filter((r) => r.roofStyle !== 'flat' && r.visible !== false);
  if (sloped.length === 0) return pieces;

  const dir = norm(sub(wall.end, wall.start));
  const out: WallPiece[] = [];

  const clampOver = (poly: Point[]): number =>
    Math.min(...poly.map((p) => roofClampAt(sloped, p.x, p.y)), roofClampAt(sloped, centroidOf(poly).x, centroidOf(poly).y));

  for (const piece of pieces) {
    const samples = [...piece.poly, centroidOf(piece.poly)];
    const minClamp = Math.min(...samples.map((p) => roofClampAt(sloped, p.x, p.y)));
    if (minClamp >= piece.z1) {
      out.push(piece);
      continue;
    }

    // Slice the piece into strips along the wall axis and clamp each.
    const us = piece.poly.map((p) => dot(sub(p, wall.start), dir));
    const u0 = Math.min(...us);
    const u1 = Math.max(...us);
    const th = wallThickness(wall);
    const reach = th / 2 + 0.05;
    const n = perp(dir);

    for (let u = u0; u < u1 - 1e-6; u += TRIM_STEP) {
      const ua = u;
      const ub = Math.min(u1, u + TRIM_STEP);
      const a1 = add(wall.start, scale(dir, ua));
      const a2 = add(wall.start, scale(dir, ub));
      const strip: [number, number][] = [
        [a1.x + n.x * reach, a1.y + n.y * reach],
        [a2.x + n.x * reach, a2.y + n.y * reach],
        [a2.x - n.x * reach, a2.y - n.y * reach],
        [a1.x - n.x * reach, a1.y - n.y * reach],
      ];
      const clipped = polygonClipping.intersection(
        [piece.poly.map((p) => [p.x, p.y] as [number, number])],
        [strip],
      );
      for (const poly of clipped) {
        if (!poly[0] || poly[0].length < 3) continue;
        // Drop duplicate/near-coincident vertices and degenerate slivers —
        // they produce NaN geometry that breaks rendering and GLB export.
        const raw = (poly[0] as [number, number][]).map(([x, y]) => ({ x, y }));
        const pts = raw.filter((p, i) => dist(p, raw[(i + 1) % raw.length]) > 1e-6);
        if (pts.length < 3 || polygonArea(pts) < 1e-4) continue;
        const zTop = Math.min(piece.z1, Math.max(piece.z0 + 0.01, clampOver(pts)));
        out.push({ poly: pts, z0: piece.z0, z1: zTop });
      }
    }
  }
  return out;
}
