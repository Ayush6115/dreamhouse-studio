import type { Dimensions, Point, Transform } from './geometry';
import type { Material } from './materials';

/**
 * Every design element — structural, opening, room or furnishing — conforms to
 * ElementBase, so the store, the properties panel, both renderers and the
 * calculations can treat elements uniformly.
 *
 * Elements are PURE DATA (fully JSON-serializable). How an element draws in
 * 2D / builds 3D geometry lives in renderer registries keyed by `type`
 * (see features/plan/render2d and features/viewer3d/render3d), not on the
 * element itself.
 */

export type ElementType =
  | 'wall'
  | 'column'
  | 'beam'
  | 'door'
  | 'window'
  | 'staircase'
  | 'room'
  | 'roof'
  | 'furniture'
  | 'note'
  | 'facade-element';

export interface ElementMeta {
  brand?: string;
  price?: number;
  [key: string]: unknown;
}

export interface ElementBase {
  id: string;
  type: ElementType;
  name: string;
  transform: Transform;
  dimensions: Dimensions;
  material: Material;
  meta?: ElementMeta;
  /** Locked elements can be selected (to unlock) but never moved or deleted. */
  locked?: boolean;
  /** Elements sharing a groupId select and move as one. */
  groupId?: string;
  /** Defaults to visible when undefined. */
  visible?: boolean;
}

/**
 * Wall. The CANONICAL shape is the centerline (start → end) plus
 * thickness/height. The store keeps `transform` (midpoint + angle) and
 * `dimensions` (width = length, depth/thickness, height) in sync via
 * syncWallDerived() so generic consumers can still read them, but editing a
 * wall means editing its endpoints.
 */
export interface WallElement extends ElementBase {
  type: 'wall';
  start: Point;
  end: Point;
}

export type OpeningStyle =
  | 'single' // hinged single leaf
  | 'double' // hinged double leaf
  | 'sliding'
  | 'folding' // bi-fold leaves (doors)
  | 'casement' // outward-opening window leaves
  | 'fixed'; // fixed glazing (windows)

/** Doors and windows are anchored to a host wall and move with it. */
export interface OpeningElement extends ElementBase {
  type: 'door' | 'window';
  wallId: string;
  /** Distance in meters from wall.start to the opening CENTER, along the centerline. */
  offset: number;
  /** Height of the opening's underside above the floor (0 for doors). */
  sillHeight: number;
  style: OpeningStyle;
  /** For doors: which side the leaf swings toward (+1 / -1 across the wall). */
  swing?: 1 | -1;
  /** Vertical glazing divisions for windows (0 = single pane). */
  mullions?: number;
}

export interface ColumnElement extends ElementBase {
  type: 'column';
  profile: 'rect' | 'round';
}

/** Beam spans between two plan points at `transform.position.z` above floor. */
export interface BeamElement extends ElementBase {
  type: 'beam';
  start: Point;
  end: Point;
}

export interface StaircaseElement extends ElementBase {
  type: 'staircase';
  steps: number;
  style: 'straight' | 'l-shaped' | 'u-shaped';
}

export type RoomType =
  | 'bedroom'
  | 'kitchen'
  | 'bathroom'
  | 'living'
  | 'dining'
  | 'pooja'
  | 'balcony'
  | 'parking'
  | 'garden'
  | 'boundary-wall'
  | 'study'
  | 'store'
  | 'other';

/**
 * A room is a tagged plan polygon. Rooms drive the carpet-area calculation
 * and give the 3D floor its finish.
 */
export interface RoomElement extends ElementBase {
  type: 'room';
  boundary: Point[]; // closed polygon (implicit closing edge), plan meters
  roomType: RoomType;
}

export type RoofStyleType = 'flat' | 'shed' | 'gable' | 'hip' | 'barrel';

/** Skylight cut/insert in roof-local plan coordinates (center-based). */
export interface Skylight {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** Dormer window seated on a roof slope (roof-local, center of front face). */
export interface Dormer {
  x: number;
  y: number;
  width: number;
  /** Front-wall height of the dormer. */
  height: number;
}

/**
 * Roof over a rectangular footprint: center = transform.position (x, y),
 * plan size = dimensions.width × depth (rotation supported), base height
 * above the level floor = transform.position.z (defaults to wall height).
 * Slope math lives in geometry/roof.ts.
 */
export interface RoofElement extends ElementBase {
  type: 'roof';
  roofStyle: RoofStyleType;
  /** Slope in degrees (ignored for flat). */
  pitch: number;
  /** Eave overhang beyond the footprint, meters. */
  overhang: number;
  /** Parapet wall height for flat roofs (0 = none). */
  parapetHeight: number;
  skylights: Skylight[];
  dormers: Dormer[];
}

/**
 * Free text annotation placed anywhere on the plan. Text height (meters) is
 * dimensions.height; width/depth hold the estimated bounding box so
 * selection, marquee and alignment work like any other item.
 */
export interface NoteElement extends ElementBase {
  type: 'note';
  text: string;
}

/** Any placeable library item (furniture, fixtures, decor, plants…). */
export interface FurnitureElement extends ElementBase {
  type: 'furniture';
  /** Id into the interior library catalog (src/library/catalog.ts). */
  catalogId: string;
}

/**
 * A façade-composer item. Lives inside a Facade (not a Level).
 * transform.position.x = horizontal position on the façade,
 * transform.position.z = height above façade base.
 */
export interface FacadeElementItem extends ElementBase {
  type: 'facade-element';
  /** Id into the façade component catalog (src/library/facadeCatalog.ts). */
  catalogId: string;
  /** Manual stacking order — higher draws in front (default 0). */
  layer?: number;
}

export type Element =
  | WallElement
  | OpeningElement
  | ColumnElement
  | BeamElement
  | StaircaseElement
  | RoomElement
  | RoofElement
  | FurnitureElement
  | NoteElement
  | FacadeElementItem;

export const isWall = (e: Element): e is WallElement => e.type === 'wall';
export const isOpening = (e: Element): e is OpeningElement => e.type === 'door' || e.type === 'window';
export const isRoom = (e: Element): e is RoomElement => e.type === 'room';
export const isFurniture = (e: Element): e is FurnitureElement => e.type === 'furniture';
