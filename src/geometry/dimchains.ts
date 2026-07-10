import type { OpeningElement, WallElement } from '../types';
import { add, norm, scale, sub } from './vec';

/**
 * Dimension-chain generation for working drawings.
 *
 * Professional floor plans carry hierarchical dimension rows on every side:
 * an inner chain segmented at each opening jamb, a middle chain segmented at
 * each wall line, and an outer overall dimension. This module derives those
 * station lists from the wall/opening model.
 */

export type Side = 'top' | 'bottom' | 'left' | 'right';

export interface SideChains {
  side: Side;
  /** Coordinate being measured along: 'x' for top/bottom, 'y' for left/right. */
  axis: 'x' | 'y';
  /** Rows of sorted station coordinates, innermost (most detailed) first. */
  rows: number[][];
}

const EPS = 0.02;

function pushUnique(list: number[], v: number): void {
  if (!list.some((s) => Math.abs(s - v) < EPS)) list.push(v);
}

function sorted(list: number[]): number[] {
  return [...list].sort((a, b) => a - b);
}

/** Drop rows that duplicate the next-coarser row (no extra information). */
function dedupeRows(rows: number[][]): number[][] {
  const out: number[][] = [];
  for (const row of rows) {
    const prev = out[out.length - 1];
    const same =
      prev && prev.length === row.length && prev.every((v, i) => Math.abs(v - row[i]) < EPS);
    if (!same && row.length >= 2) out.push(row);
  }
  return out;
}

/**
 * Compute dimension chains for all four sides of the building.
 * Returns [] when there are fewer than two walls to measure.
 */
export function dimensionChains(walls: WallElement[], openings: OpeningElement[]): SideChains[] {
  const visible = walls.filter((w) => w.visible !== false);
  if (visible.length < 2) return [];

  const min = { x: Infinity, y: Infinity };
  const max = { x: -Infinity, y: -Infinity };
  for (const w of visible) {
    for (const p of [w.start, w.end]) {
      min.x = Math.min(min.x, p.x);
      min.y = Math.min(min.y, p.y);
      max.x = Math.max(max.x, p.x);
      max.y = Math.max(max.y, p.y);
    }
  }

  // Wall-line stations: every distinct wall coordinate in each axis.
  const stationsX: number[] = [];
  const stationsY: number[] = [];
  for (const w of visible) {
    for (const p of [w.start, w.end]) {
      pushUnique(stationsX, p.x);
      pushUnique(stationsY, p.y);
    }
  }

  /**
   * Opening-jamb stations for one side: jambs of openings hosted on exterior
   * walls facing that side (within half a meter of the bbox edge).
   */
  const jambStations = (side: Side): number[] => {
    const horizontal = side === 'top' || side === 'bottom';
    const edge =
      side === 'top' ? min.y : side === 'bottom' ? max.y : side === 'left' ? min.x : max.x;
    const row: number[] = [];
    for (const w of visible) {
      const dir = norm(sub(w.end, w.start));
      const isAligned = horizontal ? Math.abs(dir.y) < 0.05 : Math.abs(dir.x) < 0.05;
      if (!isAligned) continue;
      const at = horizontal ? (w.start.y + w.end.y) / 2 : (w.start.x + w.end.x) / 2;
      if (Math.abs(at - edge) > 0.5) continue;
      // This wall lies on the measured side — chain its openings' jambs.
      for (const o of openings) {
        if (o.wallId !== w.id || o.visible === false) continue;
        const center = add(w.start, scale(dir, o.offset));
        const half = o.dimensions.width / 2;
        const c = horizontal ? center.x : center.y;
        pushUnique(row, c - half);
        pushUnique(row, c + half);
      }
    }
    return row;
  };

  const build = (side: Side): SideChains => {
    const horizontal = side === 'top' || side === 'bottom';
    const overall = horizontal ? [min.x, max.x] : [min.y, max.y];
    const wallsRow = sorted(horizontal ? stationsX : stationsY);
    // Innermost row segments at wall lines AND opening jambs, like a working
    // drawing's fine chain; the middle row keeps wall lines only.
    const fineRow = [...wallsRow];
    for (const j of jambStations(side)) pushUnique(fineRow, j);
    return {
      side,
      axis: horizontal ? 'x' : 'y',
      rows: dedupeRows([sorted(fineRow), wallsRow, overall]),
    };
  };

  return (['top', 'bottom', 'left', 'right'] as Side[]).map(build);
}
