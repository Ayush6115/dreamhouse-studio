import type {
  BeamElement,
  ColumnElement,
  NoteElement,
  OpeningElement,
  Point,
  RoofElement,
  RoomElement,
  RoomType,
  StaircaseElement,
  WallElement,
} from '../../types';
import { identityTransform, newId } from '../../types';
import { materialById, DEFAULT_WALL_MATERIAL } from '../../library/materials';

/** Element factories with sensible architectural defaults (meters). */

export const WALL_DEFAULTS = { thickness: 0.23, height: 3 };

export function makeWall(start: Point, end: Point, opts?: Partial<typeof WALL_DEFAULTS>): WallElement {
  const thickness = opts?.thickness ?? WALL_DEFAULTS.thickness;
  const height = opts?.height ?? WALL_DEFAULTS.height;
  return {
    id: newId(),
    type: 'wall',
    name: 'Wall',
    start: { ...start },
    end: { ...end },
    transform: identityTransform(),
    dimensions: { width: 0, height, depth: thickness, thickness },
    material: { ...DEFAULT_WALL_MATERIAL },
  };
}

export function makeDoor(wallId: string, offset: number): OpeningElement {
  return {
    id: newId(),
    type: 'door',
    name: 'Door',
    wallId,
    offset,
    sillHeight: 0,
    style: 'single',
    swing: 1,
    transform: identityTransform(),
    dimensions: { width: 0.9, height: 2.1, depth: 0.05 },
    material: { ...materialById('wood-teak') },
  };
}

export function makeWindow(wallId: string, offset: number): OpeningElement {
  return {
    id: newId(),
    type: 'window',
    name: 'Window',
    wallId,
    offset,
    sillHeight: 0.9,
    style: 'sliding',
    transform: identityTransform(),
    dimensions: { width: 1.2, height: 1.2, depth: 0.05 },
    material: { ...materialById('glass') },
  };
}

export function makeColumn(at: Point): ColumnElement {
  return {
    id: newId(),
    type: 'column',
    name: 'Column',
    profile: 'rect',
    transform: { ...identityTransform(), position: { x: at.x, y: at.y, z: 0 } },
    dimensions: { width: 0.3, height: 3, depth: 0.3 },
    material: { ...materialById('concrete') },
  };
}

export function makeBeam(start: Point, end: Point, levelHeight: number): BeamElement {
  return {
    id: newId(),
    type: 'beam',
    name: 'Beam',
    start: { ...start },
    end: { ...end },
    transform: {
      ...identityTransform(),
      position: {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
        z: levelHeight - 0.45,
      },
    },
    dimensions: { width: Math.hypot(end.x - start.x, end.y - start.y), height: 0.45, depth: 0.23 },
    material: { ...materialById('concrete') },
  };
}

export function makeStaircase(at: Point): StaircaseElement {
  return {
    id: newId(),
    type: 'staircase',
    name: 'Staircase',
    steps: 16,
    style: 'straight',
    transform: { ...identityTransform(), position: { x: at.x, y: at.y, z: 0 } },
    dimensions: { width: 1.0, height: 3, depth: 3.2 },
    material: { ...materialById('concrete') },
  };
}

/**
 * Roof over the rect spanned by two plan corners. Sits at `baseZ` above the
 * level floor (normally the wall height).
 */
export function makeRoof(a: Point, b: Point, baseZ: number): RoofElement {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const w = Math.max(0.5, Math.abs(b.x - a.x));
  const d = Math.max(0.5, Math.abs(b.y - a.y));
  return {
    id: newId(),
    type: 'roof',
    name: 'Roof',
    roofStyle: 'gable',
    pitch: 24,
    overhang: 0.4,
    parapetHeight: 0,
    skylights: [],
    dormers: [],
    transform: { ...identityTransform(), position: { x: cx, y: cy, z: baseZ } },
    dimensions: { width: w, height: 0, depth: d, thickness: 0.15 },
    material: { ...materialById('roof-tiles') },
  };
}

/** Estimated bounding box of a note's text block, meters. */
export function noteBounds(text: string, height: number): { width: number; depth: number } {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => l.length));
  return { width: Math.max(0.4, longest * height * 0.56), depth: Math.max(height * 1.3, lines.length * height * 1.3) };
}

export function makeNote(at: Point): NoteElement {
  const height = 0.35;
  const text = 'Text';
  return {
    id: newId(),
    type: 'note',
    name: 'Text',
    text,
    transform: { ...identityTransform(), position: { x: at.x, y: at.y, z: 0 } },
    dimensions: { ...noteBounds(text, height), height },
    material: { ...materialById('paint-charcoal'), color: '#57503f' },
  };
}

const ROOM_LABELS: Record<RoomType, string> = {
  bedroom: 'Bedroom',
  kitchen: 'Kitchen',
  bathroom: 'Bathroom',
  living: 'Living Room',
  dining: 'Dining',
  pooja: 'Pooja Room',
  balcony: 'Balcony',
  parking: 'Parking',
  garden: 'Garden',
  'boundary-wall': 'Boundary Wall',
  study: 'Study',
  store: 'Store Room',
  other: 'Room',
};

export const roomLabel = (t: RoomType): string => ROOM_LABELS[t];

export function makeRoom(boundary: Point[], roomType: RoomType = 'living'): RoomElement {
  return {
    id: newId(),
    type: 'room',
    name: ROOM_LABELS[roomType],
    roomType,
    boundary: boundary.map((p) => ({ ...p })),
    transform: identityTransform(),
    dimensions: { width: 0, height: 0, depth: 0 },
    material: { ...materialById('tile-ivory') },
  };
}

export const ROOM_TYPE_OPTIONS = (Object.keys(ROOM_LABELS) as RoomType[]).map((value) => ({
  value,
  label: ROOM_LABELS[value],
}));
