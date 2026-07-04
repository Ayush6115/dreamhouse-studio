import { useMemo } from 'react';
import type { DesignDocument, Level } from '../types';
import { isRoom, isWall } from '../types';
import { polygonArea } from '../geometry/polygon';
import { buildableRegion } from '../geometry/setbacks';
import { unionArea, wallLength, wallOutline } from '../geometry/walls';
import { useDesignStore } from './designStore';

/**
 * All geometric calculations, derived purely from the DesignDocument.
 *
 * Definitions (geometric only — no costs, no quantities):
 * - plotArea:        area of the plot boundary polygon.
 * - buildableArea:   plot inset by the setbacks (null if setbacks collapse it).
 * - carpetArea:      Σ area of room polygons (inner usable area).
 * - wallFootprint:   exact union area of all wall outlines (no double-counted
 *                    corners — see geometry/walls.ts).
 * - builtUpArea:     area of union(rooms ∪ walls): carpet + walls without
 *                    counting overlaps twice.
 * - totalWallLength: Σ wall centerline lengths.
 */
export interface LevelMetrics {
  carpetArea: number;
  wallFootprint: number;
  builtUpArea: number;
  totalWallLength: number;
  wallCount: number;
  roomCount: number;
}

export interface DesignMetrics extends LevelMetrics {
  plotArea: number;
  buildableArea: number | null;
  /** Built-up area summed across every level. */
  totalBuiltUpArea: number;
}

export function computeLevelMetrics(level: Level): LevelMetrics {
  const walls = level.elements.filter(isWall);
  const rooms = level.elements.filter(isRoom);
  const outlines = walls.map((w) => wallOutline(w, walls)).filter((o) => o.length >= 3);
  const roomPolys = rooms.map((r) => r.boundary).filter((b) => b.length >= 3);

  return {
    carpetArea: roomPolys.reduce((sum, b) => sum + polygonArea(b), 0),
    wallFootprint: unionArea(outlines),
    builtUpArea: unionArea([...outlines, ...roomPolys]),
    totalWallLength: walls.reduce((sum, w) => sum + wallLength(w), 0),
    wallCount: walls.length,
    roomCount: rooms.length,
  };
}

export function computeMetrics(doc: DesignDocument, activeLevelId: string): DesignMetrics {
  const level = doc.levels.find((l) => l.id === activeLevelId) ?? doc.levels[0];
  const levelMetrics = level
    ? computeLevelMetrics(level)
    : { carpetArea: 0, wallFootprint: 0, builtUpArea: 0, totalWallLength: 0, wallCount: 0, roomCount: 0 };

  const boundary = doc.plot.boundary;
  const plotArea = boundary.length >= 3 ? polygonArea(boundary) : 0;
  const region =
    doc.plot.buildableOverride && doc.plot.buildableOverride.length >= 3
      ? doc.plot.buildableOverride
      : boundary.length >= 3
        ? buildableRegion(boundary, doc.plot.roadDirection, doc.plot.setbacks, doc.plot.edgeSetbacks)
        : null;

  return {
    ...levelMetrics,
    plotArea,
    buildableArea: region ? polygonArea(region) : null,
    totalBuiltUpArea: doc.levels.reduce((sum, l) => sum + computeLevelMetrics(l).builtUpArea, 0),
  };
}

/** Reactive metrics for the active level; recomputes only when the doc changes. */
export function useMetrics(): DesignMetrics {
  const doc = useDesignStore((s) => s.doc);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  return useMemo(() => computeMetrics(doc, activeLevelId), [doc, activeLevelId]);
}
