import type { Point } from '../types/geometry';
import { fromAngle } from './vec';

/**
 * Oriented-bounding-box overlap (separating axis theorem, 2D).
 * Boxes are centered at `c`, extents w × d, rotated by `rot` radians.
 * Used for furniture collision awareness — advisory, never blocking.
 */

interface Obb {
  c: Point;
  w: number;
  d: number;
  rot: number;
}

function corners({ c, w, d, rot }: Obb): Point[] {
  const ux = fromAngle(rot);
  const uy = { x: -ux.y, y: ux.x };
  const hw = w / 2;
  const hd = d / 2;
  return [
    { x: c.x + ux.x * hw + uy.x * hd, y: c.y + ux.y * hw + uy.y * hd },
    { x: c.x - ux.x * hw + uy.x * hd, y: c.y - ux.y * hw + uy.y * hd },
    { x: c.x - ux.x * hw - uy.x * hd, y: c.y - ux.y * hw - uy.y * hd },
    { x: c.x + ux.x * hw - uy.x * hd, y: c.y + ux.y * hw - uy.y * hd },
  ];
}

export function obbOverlap(a: Obb, b: Obb, tolerance = 0.01): boolean {
  const ca = corners(a);
  const cb = corners(b);
  // Test the 4 face normals (2 per box).
  for (const rot of [a.rot, a.rot + Math.PI / 2, b.rot, b.rot + Math.PI / 2]) {
    const axis = fromAngle(rot);
    let minA = Infinity;
    let maxA = -Infinity;
    let minB = Infinity;
    let maxB = -Infinity;
    for (const p of ca) {
      const v = p.x * axis.x + p.y * axis.y;
      minA = Math.min(minA, v);
      maxA = Math.max(maxA, v);
    }
    for (const p of cb) {
      const v = p.x * axis.x + p.y * axis.y;
      minB = Math.min(minB, v);
      maxB = Math.max(maxB, v);
    }
    if (maxA < minB + tolerance || maxB < minA + tolerance) return false; // separating axis
  }
  return true;
}

/** Axis-aligned bounds of a rotated box (for alignment guides). */
export function obbAabb(o: Obb): { min: Point; max: Point } {
  const cs = corners(o);
  return {
    min: { x: Math.min(...cs.map((p) => p.x)), y: Math.min(...cs.map((p) => p.y)) },
    max: { x: Math.max(...cs.map((p) => p.x)), y: Math.max(...cs.map((p) => p.y)) },
  };
}
