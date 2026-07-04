import type { Point } from '../types/geometry';
import { add, dist, fromAngle, scale, sub, angleOf, closestPointOnSegment } from './vec';

/**
 * Snapping for the 2D editors. Priority (strongest wins):
 *   1. existing point (wall endpoints, plot vertices)
 *   2. on-segment (slide along an existing wall)
 *   3. angle lock from an anchor (0/45/90… while drawing) combined with grid
 *   4. grid
 */

export type SnapKind = 'point' | 'segment' | 'angle' | 'grid' | 'none';

export interface SnapContext {
  /** Grid pitch in meters; 0 disables grid snapping. */
  gridSize: number;
  /** Existing significant points (endpoints, vertices). */
  points?: Point[];
  /** Existing segments to slide along. */
  segments?: { a: Point; b: Point }[];
  /** Anchor for angle locking (e.g. previous vertex while drawing). */
  anchor?: Point;
  /** Angle increment for locking, radians (default 45°). */
  angleStep?: number;
  /** Snap radius in meters (depends on zoom; the canvas passes it in). */
  tolerance: number;
}

export interface SnapResult {
  point: Point;
  kind: SnapKind;
  /** The point/segment that was snapped to, for drawing snap indicators. */
  target?: Point;
}

const snapScalar = (v: number, step: number): number => Math.round(v / step) * step;

export function snapToGrid(p: Point, gridSize: number): Point {
  if (gridSize <= 0) return p;
  return { x: snapScalar(p.x, gridSize), y: snapScalar(p.y, gridSize) };
}

export function snapPoint(raw: Point, ctx: SnapContext): SnapResult {
  // 1. Significant points.
  if (ctx.points && ctx.points.length > 0) {
    let best: Point | null = null;
    let bestD = ctx.tolerance;
    for (const p of ctx.points) {
      const d = dist(raw, p);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    if (best) return { point: best, kind: 'point', target: best };
  }

  // 2. Slide along segments.
  if (ctx.segments && ctx.segments.length > 0) {
    let best: Point | null = null;
    let bestD = ctx.tolerance;
    for (const s of ctx.segments) {
      const { point } = closestPointOnSegment(raw, s.a, s.b);
      const d = dist(raw, point);
      if (d < bestD) {
        best = point;
        bestD = d;
      }
    }
    if (best) return { point: best, kind: 'segment', target: best };
  }

  // 3. Angle lock from anchor.
  if (ctx.anchor) {
    const step = ctx.angleStep ?? Math.PI / 4;
    const v = sub(raw, ctx.anchor);
    const r = dist(raw, ctx.anchor);
    if (r > 1e-9) {
      const snappedAngle = Math.round(angleOf(v) / step) * step;
      const dir = fromAngle(snappedAngle);
      // Perpendicular deviation from the locked ray.
      const onRay = add(ctx.anchor, scale(dir, r));
      if (dist(raw, onRay) <= ctx.tolerance) {
        const length = ctx.gridSize > 0 ? Math.max(ctx.gridSize, snapScalar(r, ctx.gridSize)) : r;
        return { point: add(ctx.anchor, scale(dir, length)), kind: 'angle', target: ctx.anchor };
      }
    }
  }

  // 4. Grid.
  if (ctx.gridSize > 0) {
    const g = snapToGrid(raw, ctx.gridSize);
    if (dist(raw, g) <= ctx.tolerance) return { point: g, kind: 'grid' };
  }

  return { point: raw, kind: 'none' };
}
