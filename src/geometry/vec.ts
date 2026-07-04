import type { Point } from '../types/geometry';

/** Small 2D vector helpers. All angles in radians. */

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Point, s: number): Point => ({ x: a.x * s, y: a.y * s });
export const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
/** 2D cross product (z of the 3D cross). */
export const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
export const len = (a: Point): number => Math.hypot(a.x, a.y);
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Point): Point => {
  const l = len(a);
  return l < 1e-12 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
/** Perpendicular: rotates 90° from +x toward +y (clockwise on screen). */
export const perp = (a: Point): Point => ({ x: -a.y, y: a.x });
export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});
export const angleOf = (a: Point): number => Math.atan2(a.y, a.x);
export const fromAngle = (rad: number): Point => ({ x: Math.cos(rad), y: Math.sin(rad) });
export const eq = (a: Point, b: Point, eps = 1e-6): boolean => dist(a, b) <= eps;

/**
 * Intersection of two infinite lines given as (point, direction).
 * Returns null when near-parallel.
 */
export function lineIntersection(p1: Point, d1: Point, p2: Point, d2: Point): Point | null {
  const c = cross(d1, d2);
  if (Math.abs(c) < 1e-9) return null;
  const t = cross(sub(p2, p1), d2) / c;
  return add(p1, scale(d1, t));
}

/** Closest point on segment [a,b] to p, plus the parameter t in [0,1]. */
export function closestPointOnSegment(p: Point, a: Point, b: Point): { point: Point; t: number } {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return { point: a, t: 0 };
  const t = Math.min(1, Math.max(0, dot(sub(p, a), ab) / l2));
  return { point: add(a, scale(ab, t)), t };
}
