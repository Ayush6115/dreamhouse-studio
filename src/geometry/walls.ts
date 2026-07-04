import polygonClipping from 'polygon-clipping';
import type { Point } from '../types/geometry';
import type { WallElement } from '../types/elements';
import { add, scale, sub, norm, perp, cross, eq, lineIntersection, dist } from './vec';
import { signedArea } from './polygon';

/**
 * Wall geometry: centerline → plan outline with correct corner joins.
 *
 * Join rules:
 * - Free end                     → square (butt) cap at the centerline end.
 * - Exactly two walls at a joint → true miter: each wall's side lines are
 *   intersected with the neighbour's, so the outer corner closes exactly and
 *   footprint areas add without overlap.
 * - Three or more walls (T / X)  → butt caps; the polygon UNION of the
 *   overlapping rectangles produces the correct junction shape and area.
 * - Very acute miters are clamped (fall back to butt) to avoid spikes.
 */

const JOINT_EPS = 1e-4; // endpoints closer than this are the same joint (0.1 mm)
const MITER_LIMIT = 4; // × thickness

export const wallLength = (w: Pick<WallElement, 'start' | 'end'>): number => dist(w.start, w.end);

export const wallAngle = (w: Pick<WallElement, 'start' | 'end'>): number =>
  Math.atan2(w.end.y - w.start.y, w.end.x - w.start.x);

export const wallThickness = (w: WallElement): number => w.dimensions.thickness ?? w.dimensions.depth;

interface EndCorners {
  /** Corner on the +perp side of the centerline. */
  left: Point;
  /** Corner on the -perp side. */
  right: Point;
}

function buttCap(at: Point, dir: Point, th: number): EndCorners {
  const n = perp(dir);
  return { left: add(at, scale(n, th / 2)), right: add(at, scale(n, -th / 2)) };
}

/**
 * Miter this wall's end against the single other wall meeting at `joint`.
 * `dir` points from the joint INTO this wall; `otherDir` from the joint into
 * the other wall.
 */
function miterCap(joint: Point, dir: Point, th: number, otherDir: Point, otherTh: number): EndCorners {
  const c = cross(dir, otherDir);
  if (Math.abs(c) < 1e-6) return buttCap(joint, dir, th); // collinear continuation
  const n = perp(dir);
  const no = perp(otherDir);
  const corners: Point[] = [];
  for (const side of [1, -1] as const) {
    const p1 = add(joint, scale(n, (side * th) / 2));
    // Pairing is combinatorial: traveling through the joint (into this wall
    // vs. out of the other), left-of-travel pairs with left-of-travel, which
    // with both directions pointing AWAY from the joint means opposite signs.
    const sideOther = -side;
    const p2 = add(joint, scale(no, (sideOther * otherTh) / 2));
    const hit = lineIntersection(p1, dir, p2, otherDir);
    if (!hit || dist(hit, joint) > MITER_LIMIT * Math.max(th, otherTh)) {
      return buttCap(joint, dir, th);
    }
    corners.push(hit);
  }
  return { left: corners[0], right: corners[1] };
}

/** All walls (other than `wall`) with an endpoint at `joint`. */
function wallsAtJoint(joint: Point, walls: WallElement[], excludeId: string): WallElement[] {
  return walls.filter(
    (w) => w.id !== excludeId && (eq(w.start, joint, JOINT_EPS) || eq(w.end, joint, JOINT_EPS)),
  );
}

/**
 * The wall's plan outline as a closed quad:
 * [startLeft, endLeft, endRight, startRight].
 * Left/right are relative to the start→end direction.
 */
export function wallOutline(wall: WallElement, allWalls: WallElement[]): Point[] {
  const th = wallThickness(wall);
  const d = norm(sub(wall.end, wall.start));
  if (d.x === 0 && d.y === 0) return [];

  const capFor = (joint: Point, dirIntoWall: Point): EndCorners => {
    const others = wallsAtJoint(joint, allWalls, wall.id);
    if (others.length === 1) {
      const o = others[0];
      const otherDir = eq(o.start, joint, JOINT_EPS)
        ? norm(sub(o.end, o.start))
        : norm(sub(o.start, o.end));
      return miterCap(joint, dirIntoWall, th, otherDir, wallThickness(o));
    }
    return buttCap(joint, dirIntoWall, th);
  };

  // dirIntoWall points from the joint toward the wall's other end.
  const startCap = capFor(wall.start, d);
  const endCap = capFor(wall.end, scale(d, -1));

  // startCap.left is on +perp(d) side. endCap was computed with reversed
  // direction, so its 'left' is on the -perp(d) side — swap to keep a
  // consistent winding.
  return [startCap.left, endCap.right, endCap.left, startCap.right];
}

type Ring = [number, number][];

const toRing = (pts: Point[]): Ring => pts.map((p) => [p.x, p.y] as [number, number]);

function ringArea(ring: Ring): number {
  return Math.abs(signedArea(ring.map(([x, y]) => ({ x, y }))));
}

/** Exact union of a set of polygons; returns total area in m². */
export function unionArea(polygons: Point[][]): number {
  const inputs = polygons.filter((p) => p.length >= 3).map((p) => [toRing(p)]);
  if (inputs.length === 0) return 0;
  const union = polygonClipping.union(inputs[0], ...inputs.slice(1));
  let area = 0;
  for (const poly of union) {
    poly.forEach((ring, i) => {
      // Ring 0 is the exterior; the rest are holes.
      area += (i === 0 ? 1 : -1) * ringArea(ring as Ring);
    });
  }
  return area;
}

/** Union outlines of walls (for filled 2D rendering), as rings of points. */
export function wallsUnionOutlines(walls: WallElement[]): Point[][] {
  const outlines = walls.map((w) => wallOutline(w, walls)).filter((o) => o.length >= 3);
  if (outlines.length === 0) return [];
  const inputs = outlines.map((p) => [toRing(p)]);
  const union = polygonClipping.union(inputs[0], ...inputs.slice(1));
  const rings: Point[][] = [];
  for (const poly of union) {
    for (const ring of poly) {
      rings.push((ring as Ring).map(([x, y]) => ({ x, y })));
    }
  }
  return rings;
}
