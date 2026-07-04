import type { Point } from './geometry';
import type { Element, FacadeElementItem } from './elements';

export type UnitSystem = 'metric' | 'imperial';

/**
 * Setback distances in meters, applied inward from the plot boundary.
 * Edges are classified front/rear/left/right by their outward normal
 * relative to `roadDirection` (see geometry/setbacks.ts).
 */
export interface Setbacks {
  front: number;
  rear: number;
  left: number;
  right: number;
}

export interface Plot {
  /** Plot boundary polygon in plan meters. Empty until the user draws one. */
  boundary: Point[];
  /** Degrees. 0 = north points up on screen; positive rotates clockwise. */
  northAngle: number;
  /** Degrees, same convention: the compass direction the road lies in. */
  roadDirection: number;
  setbacks: Setbacks;
  /**
   * Per-edge setback overrides (meters). Index = edge i (vertex i → i+1);
   * null/undefined entries fall back to the side-classified default above.
   */
  edgeSetbacks?: (number | null)[];
  /**
   * Manually edited buildable footprint. When set, it replaces the
   * auto-inset polygon and is freely editable; setbacks then act as the
   * LEGAL envelope that edits are validated against. Undefined = automatic.
   */
  buildableOverride?: Point[];
  /**
   * User explicitly accepted the setback intrusion — the amber warning and
   * fills are hidden until re-checked. Outside-plot errors are never waivable.
   */
  setbackWaiver?: boolean;
}

export interface Level {
  id: string;
  name: string;
  /** Height of this level's floor above ground, meters. */
  elevation: number;
  /** Default floor-to-ceiling height for the level, meters. */
  height: number;
  elements: Element[];
}

/** A named façade composition for the elevation designer. */
export interface Facade {
  id: string;
  name: string;
  /** Canvas extents in meters. */
  width: number;
  height: number;
  /** Base wall material/color of the façade backdrop. */
  backdropColor: string;
  elements: FacadeElementItem[];
}

/**
 * The single source of truth. The 2D plan, the 3D scene, the elevation
 * composer and every calculation are all derived from this document.
 * It must remain JSON-serializable at all times.
 */
export interface DesignDocument {
  id: string;
  name: string;
  version: 1;
  unitSystem: UnitSystem;
  plot: Plot;
  levels: Level[];
  facades: Facade[];
}

export const newId = (): string =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2, 12));

export const createEmptyDocument = (name = 'Untitled Home'): DesignDocument => ({
  id: newId(),
  name,
  version: 1,
  unitSystem: 'metric',
  plot: {
    boundary: [],
    northAngle: 0,
    roadDirection: 180, // road to the south (bottom of screen) by default
    setbacks: { front: 3, rear: 1.5, left: 1, right: 1 },
  },
  levels: [
    {
      id: newId(),
      name: 'Ground Floor',
      elevation: 0,
      height: 3,
      elements: [],
    },
  ],
  facades: [
    {
      id: newId(),
      name: 'Front Elevation',
      width: 12,
      height: 7,
      backdropColor: '#e8e2d8',
      elements: [],
    },
  ],
});
