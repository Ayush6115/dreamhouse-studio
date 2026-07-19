import type { Point } from '../types';
import { closestPointOnSegment, dist } from './vec';

/**
 * Smart setback annotations: the true perpendicular clearance between the
 * plot boundary and the buildable footprint, measured wherever it matters.
 *
 * For every plot edge, buildable vertices (and edge midpoints) that project
 * perpendicularly onto the edge become measurement candidates. A candidate
 * survives only if it is the FIRST buildable point along its own
 * perpendicular ray — i.e. what a surveyor standing on the boundary would
 * actually measure. Constant-clearance edges collapse to one annotation
 * (clean rectangular plots); varying clearances keep each distinct value
 * (tapered and irregular plots).
 */

export interface SetbackAnnotation {
  /** On the buildable footprint. */
  from: Point;
  /** Foot of the perpendicular on the plot boundary. */
  to: Point;
  distance: number;
  /** True when the clearance varies along this plot edge. */
  varies: boolean;
  /** Set on one annotation per varying edge — render as a "VARIES" note. */
  note?: 'varies';
}

/** Ray/segment intersection parameter along the ray (null if none). */
function raySegment(origin: Point, dir: Point, a: Point, b: Point): number | null {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const den = dir.x * ey - dir.y * ex;
  if (Math.abs(den) < 1e-12) return null;
  const dx = a.x - origin.x;
  const dy = a.y - origin.y;
  const t = (dx * ey - dy * ex) / den; // along the ray
  const u = (dir.x * dy - dir.y * dx) / -den; // along the segment
  if (t < 0 || u < -1e-9 || u > 1 + 1e-9) return null;
  return t;
}

/** First buildable-boundary hit along a ray. */
function firstHit(origin: Point, dir: Point, poly: Point[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const t = raySegment(origin, dir, poly[i], poly[(i + 1) % poly.length]);
    if (t !== null && t < best) best = t;
  }
  return best;
}

export function setbackAnnotations(
  plot: Point[],
  buildable: Point[],
  opts: { varyTolerance?: number; minGap?: number } = {},
): SetbackAnnotation[] {
  if (plot.length < 3 || buildable.length < 3) return [];
  const varyTol = opts.varyTolerance ?? 0.05;
  const minGap = opts.minGap ?? 1.0;

  // measurement stations on the buildable outline: vertices + midpoints
  const stations: Point[] = [];
  for (let i = 0; i < buildable.length; i++) {
    const a = buildable[i];
    const b = buildable[(i + 1) % buildable.length];
    stations.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }

  interface Candidate extends SetbackAnnotation {
    plotEdge: number;
    /** position along the plot edge, for ordering + change detection */
    u: number;
  }
  const perEdge: Candidate[][] = plot.map(() => []);

  for (let e = 0; e < plot.length; e++) {
    const a = plot[e];
    const b = plot[(e + 1) % plot.length];
    const len = dist(a, b);
    if (len < 1e-9) continue;
    for (const v of stations) {
      const { point, t } = closestPointOnSegment(v, a, b);
      if (t <= 0.01 || t >= 0.99) continue; // perpendicular foot must land on the edge
      const d = dist(v, point);
      if (d < 0.01) continue;
      // surveyor test: v must be the first buildable point on this ray
      const dir = { x: (v.x - point.x) / d, y: (v.y - point.y) / d };
      const hit = firstHit(point, dir, buildable);
      if (Math.abs(hit - d) > 0.02) continue;
      perEdge[e].push({ from: v, to: point, distance: d, varies: false, plotEdge: e, u: t });
    }
  }

  const kept: Candidate[] = [];
  for (const list of perEdge) {
    if (list.length === 0) continue;
    list.sort((p, q) => p.u - q.u);
    const min = Math.min(...list.map((c) => c.distance));
    const max = Math.max(...list.map((c) => c.distance));
    if (max - min <= varyTol) {
      kept.push({ ...list[Math.floor(list.length / 2)], varies: false }); // constant → one clean label
      continue;
    }
    // varying edge: always the start and end stations, plus each significant
    // change in between
    const sel: Candidate[] = [list[0]];
    for (let i = 1; i < list.length - 1; i++) {
      if (Math.abs(list[i].distance - sel[sel.length - 1].distance) > varyTol) sel.push(list[i]);
    }
    if (list.length > 1) {
      const end = list[list.length - 1];
      if (Math.abs(end.distance - sel[sel.length - 1].distance) > varyTol || sel.length === 1) sel.push(end);
    }
    sel.forEach((c, i) => kept.push({ ...c, varies: true, note: i === 0 ? 'varies' : undefined }));
  }

  // de-crowd equal neighbours
  const out: Candidate[] = [];
  for (const c of kept) {
    const crowded = out.some(
      (o) => dist(o.from, c.from) < minGap && Math.abs(o.distance - c.distance) <= varyTol,
    );
    if (!crowded) out.push(c);
  }
  return out.map(({ from, to, distance, varies, note }) => ({ from, to, distance, varies, note }));
}
