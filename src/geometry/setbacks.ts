import polygonClipping from 'polygon-clipping';
import type { Point } from '../types/geometry';
import type { Setbacks } from '../types/document';
import { add, scale, sub, norm, perp, lineIntersection } from './vec';
import { ensureClockwise, polygonArea, signedArea } from './polygon';

/**
 * Setback handling: classify each plot edge as front / rear / left / right
 * relative to the road direction, then inset the boundary by the per-side
 * distances to get the buildable region.
 *
 * Limitation (documented): the inset uses edge-line offsetting with
 * consecutive-edge intersection. It is exact for convex plots and correct for
 * mildly concave ones; strongly concave plots with large setbacks can
 * self-intersect, in which case we return null and the UI reports
 * "setbacks too large for this plot".
 */

export type EdgeSide = 'front' | 'rear' | 'left' | 'right';

/** Compass degrees (0 = up/north on screen, clockwise) of a plan vector. */
export const vectorToCompass = (v: Point): number => {
  const deg = (Math.atan2(v.x, -v.y) * 180) / Math.PI;
  return (deg + 360) % 360;
};

const angularDiff = (a: number, b: number): number => (((a - b) % 360) + 540) % 360 - 180; // → (-180, 180]

/**
 * Classify each edge (edge i = vertex i → i+1) by its outward normal
 * relative to the road direction. Facing the plot from the road, 'left' and
 * 'right' are the observer's left and right.
 */
export function classifyEdges(boundary: Point[], roadDirection: number): EdgeSide[] {
  const pts = ensureClockwise(boundary);
  const flipped = pts !== boundary && signedArea(boundary) < 0;
  const sides: EdgeSide[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dir = norm(sub(b, a));
    // Clockwise-on-screen winding → outward normal is -perp(dir).
    const outward = scale(perp(dir), -1);
    const compass = vectorToCompass(outward);
    const diff = angularDiff(compass, roadDirection);
    let side: EdgeSide;
    if (Math.abs(diff) <= 45) side = 'front';
    else if (Math.abs(diff) >= 135) side = 'rear';
    else side = diff < 0 ? 'right' : 'left';
    sides.push(side);
  }
  if (!flipped) return sides;
  // Map back to the original (reversed) vertex order.
  const n = boundary.length;
  const remapped: EdgeSide[] = new Array(n);
  for (let i = 0; i < n; i++) remapped[n - 2 - i < 0 ? n - 1 : n - 2 - i] = sides[i];
  return remapped;
}

/**
 * Parts of polygon `a` lying OUTSIDE polygon `b` (outer rings only) — used
 * to validate a hand-edited buildable footprint against the plot and against
 * the legal setback envelope.
 */
export function polygonDifference(a: Point[], b: Point[]): Point[][] {
  if (a.length < 3) return [];
  if (b.length < 3) return [a];
  const result = polygonClipping.difference(
    [a.map((p) => [p.x, p.y] as [number, number])],
    [b.map((p) => [p.x, p.y] as [number, number])],
  );
  const out: Point[][] = [];
  for (const poly of result) {
    if (poly[0] && poly[0].length >= 3) {
      const ring = (poly[0] as [number, number][]).map(([x, y]) => ({ x, y }));
      if (polygonArea(ring) > 1e-4) out.push(ring);
    }
  }
  return out;
}

/** Parts of polygon `a` lying INSIDE polygon `b` (outer rings only). */
export function polygonIntersection(a: Point[], b: Point[]): Point[][] {
  if (a.length < 3 || b.length < 3) return [];
  const result = polygonClipping.intersection(
    [a.map((p) => [p.x, p.y] as [number, number])],
    [b.map((p) => [p.x, p.y] as [number, number])],
  );
  const out: Point[][] = [];
  for (const poly of result) {
    if (poly[0] && poly[0].length >= 3) {
      const ring = (poly[0] as [number, number][]).map(([x, y]) => ({ x, y }));
      if (polygonArea(ring) > 1e-4) out.push(ring);
    }
  }
  return out;
}

/**
 * Inset the boundary by a per-edge distance. Returns null when the offsets
 * collapse the polygon (setbacks too large / degenerate result).
 */
export function insetPolygon(boundary: Point[], distances: number[]): Point[] | null {
  if (boundary.length < 3 || distances.length !== boundary.length) return null;
  const cw = ensureClockwise(boundary);
  // Keep distances aligned with the (possibly reversed) order: edge j of the
  // reversed polygon is original edge (n-2-j) mod n.
  const dists =
    cw === boundary
      ? distances
      : boundary.map((_, j) => distances[(boundary.length - 2 - j + boundary.length) % boundary.length]);

  const n = cw.length;
  const offsetLines: { p: Point; d: Point }[] = [];
  for (let i = 0; i < n; i++) {
    const a = cw[i];
    const b = cw[(i + 1) % n];
    const d = norm(sub(b, a));
    // Clockwise winding → inward normal is +perp(d).
    const inward = perp(d);
    offsetLines.push({ p: add(a, scale(inward, dists[i])), d });
  }

  const result: Point[] = [];
  for (let i = 0; i < n; i++) {
    const prev = offsetLines[(i - 1 + n) % n];
    const cur = offsetLines[i];
    const hit = lineIntersection(prev.p, prev.d, cur.p, cur.d);
    // Near-parallel consecutive edges: use the current edge's offset start.
    result.push(hit ?? cur.p);
  }

  // Reject collapsed/flipped results.
  const area = signedArea(result);
  if (area <= 0.01) return null;
  return result;
}

/**
 * Buildable polygon after applying the per-side setbacks, with optional
 * per-edge overrides (aligned with the ORIGINAL boundary's edge indices).
 */
export function buildableRegion(
  boundary: Point[],
  roadDirection: number,
  setbacks: Setbacks,
  edgeSetbacks?: (number | null)[],
): Point[] | null {
  if (boundary.length < 3) return null;
  const sides = classifyEdges(boundary, roadDirection);
  const distances = boundary.map((_, i) => {
    const override = edgeSetbacks?.[i];
    if (override !== null && override !== undefined) return override;
    const s = sides[i];
    return s === 'front' ? setbacks.front : s === 'rear' ? setbacks.rear : s === 'left' ? setbacks.left : setbacks.right;
  });
  return insetPolygon(boundary, distances);
}
