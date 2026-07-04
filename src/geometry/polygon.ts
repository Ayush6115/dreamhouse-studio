import type { Point } from '../types/geometry';
import { dist } from './vec';

/**
 * Polygon utilities. Polygons are arrays of vertices with an implicit closing
 * edge, in plan meters (y-down screen coordinates — see types/geometry.ts).
 * With y-down, a positive signed area means the vertices run CLOCKWISE as
 * seen on screen.
 */

export function signedArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const polygonArea = (pts: Point[]): number => Math.abs(signedArea(pts));

/** True when vertices run clockwise on screen (y-down coordinates). */
export const isClockwise = (pts: Point[]): boolean => signedArea(pts) > 0;

/** Returns the polygon in clockwise-on-screen order (copy if flipped). */
export const ensureClockwise = (pts: Point[]): Point[] =>
  isClockwise(pts) ? pts : [...pts].reverse();

export function polygonPerimeter(pts: Point[]): number {
  let p = 0;
  for (let i = 0; i < pts.length; i++) p += dist(pts[i], pts[(i + 1) % pts.length]);
  return p;
}

export function polygonCentroid(pts: Point[]): Point {
  const a = signedArea(pts);
  if (Math.abs(a) < 1e-12) {
    // Degenerate: average the vertices.
    const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: s.x / pts.length, y: s.y / pts.length };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

export function pointInPolygon(p: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    const intersects =
      a.y > p.y !== b.y > p.y &&
      p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBounds(pts: Point[]): { min: Point; max: Point } {
  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const p of pts) {
    min.x = Math.min(min.x, p.x);
    min.y = Math.min(min.y, p.y);
    max.x = Math.max(max.x, p.x);
    max.y = Math.max(max.y, p.y);
  }
  return { min, max };
}

/** Length of each edge, edge i running from vertex i to vertex i+1. */
export const edgeLengths = (pts: Point[]): number[] =>
  pts.map((p, i) => dist(p, pts[(i + 1) % pts.length]));
