import type { DesignDocument, Level, OpeningElement } from '../../types';
import { isOpening, isRoom } from '../../types';
import { polygonArea, polygonBounds } from '../../geometry/polygon';
import { formatArea, formatLength } from '../../geometry/units';

/**
 * Opening tags and construction schedules.
 *
 * Every door/window type gets a mark (D1, D2… / W1, W2…) shared by all
 * openings of the same size, style and sill — the plan carries the mark
 * bubbles, the schedule carries the sizes and counts, exactly as on a
 * professional drawing set.
 */

/** mm for metric documents (drafting convention), ft-in for imperial. */
export function formatConstructionLength(v: number, unit: DesignDocument['unitSystem']): string {
  return unit === 'metric' ? `${Math.round(v * 1000)}` : formatLength(v, unit);
}

export interface OpeningScheduleRow {
  tag: string;
  width: number;
  height: number;
  sill: number;
  style: string;
  count: number;
}

export interface OpeningTagIndex {
  byId: Map<string, string>;
  doors: OpeningScheduleRow[];
  windows: OpeningScheduleRow[];
}

const styleLabel: Record<string, string> = {
  single: 'Single leaf',
  double: 'Double leaf',
  sliding: 'Sliding',
  casement: 'Casement',
  fixed: 'Fixed glazing',
};

/** Assign marks across the whole document (stable: sorted by size). */
export function buildOpeningTags(doc: DesignDocument): OpeningTagIndex {
  const byId = new Map<string, string>();
  const groups = new Map<string, { openings: OpeningElement[]; sample: OpeningElement }>();
  for (const level of doc.levels) {
    for (const el of level.elements) {
      if (!isOpening(el) || el.visible === false) continue;
      const key = [
        el.type,
        el.style,
        el.dimensions.width.toFixed(3),
        el.dimensions.height.toFixed(3),
        el.sillHeight.toFixed(3),
      ].join('|');
      const g = groups.get(key);
      if (g) g.openings.push(el);
      else groups.set(key, { openings: [el], sample: el });
    }
  }
  const rank = (o: OpeningElement) => o.dimensions.width * 1000 + o.dimensions.height;
  const make = (type: 'door' | 'window', prefix: string): OpeningScheduleRow[] => {
    const list = [...groups.values()]
      .filter((g) => g.sample.type === type)
      .sort((a, b) => rank(b.sample) - rank(a.sample));
    return list.map((g, i) => {
      const tag = `${prefix}${i + 1}`;
      for (const o of g.openings) byId.set(o.id, tag);
      return {
        tag,
        width: g.sample.dimensions.width,
        height: g.sample.dimensions.height,
        sill: g.sample.sillHeight,
        style: styleLabel[g.sample.style] ?? g.sample.style,
        count: g.openings.length,
      };
    });
  };
  return { byId, doors: make('door', 'D'), windows: make('window', 'W') };
}

export interface RoomScheduleRow {
  name: string;
  width: number;
  depth: number;
  area: number;
  finish: string;
}

/** Room schedule for one level. */
export function roomSchedule(level: Level): RoomScheduleRow[] {
  return level.elements
    .filter(isRoom)
    .filter((r) => r.visible !== false && r.boundary.length >= 3)
    .map((r) => {
      const b = polygonBounds(r.boundary);
      return {
        name: r.name,
        width: b.max.x - b.min.x,
        depth: b.max.y - b.min.y,
        area: polygonArea(r.boundary),
        finish: r.material.texture ? r.material.name.split('·').pop()?.trim() || r.material.name : r.material.name,
      };
    })
    .sort((a, b) => b.area - a.area);
}

export function formatScheduleSize(
  row: { width: number; height?: number; depth?: number },
  unit: DesignDocument['unitSystem'],
): string {
  const second = row.height ?? row.depth ?? 0;
  return `${formatConstructionLength(row.width, unit)} × ${formatConstructionLength(second, unit)}`;
}

export { formatArea };
