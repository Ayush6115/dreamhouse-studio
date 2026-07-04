/**
 * Core geometric primitives.
 *
 * Coordinate conventions (used everywhere in the app):
 * - Plan coordinates are in METERS. +x is east (right on screen), +y is south
 *   (down on screen) — this matches canvas coordinates so the 2D editor needs
 *   no axis flip.
 * - In 3D, plan (x, y) maps to world (x, z) and world +y is up.
 * - Rotations are in RADIANS, clockwise on screen (i.e. positive rotation
 *   turns +x toward +y), about the vertical axis.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Shared placement of every element in the document. */
export interface Transform {
  /** x/y are plan position in meters; z is height above the level's floor. */
  position: Vec3;
  /** Radians about the vertical axis. */
  rotation: number;
  scale: Vec3;
}

/**
 * Shared bounding dimensions of every element, in meters.
 * width  = extent along the element's local x (its length for walls/beams)
 * depth  = extent along local y (plan depth; wall thickness)
 * height = vertical extent
 * thickness = wall/slab thickness where meaningful (mirrors depth for walls)
 */
export interface Dimensions {
  width: number;
  height: number;
  depth: number;
  thickness?: number;
}

export const identityTransform = (): Transform => ({
  position: { x: 0, y: 0, z: 0 },
  rotation: 0,
  scale: { x: 1, y: 1, z: 1 },
});

export const pt = (x: number, y: number): Point => ({ x, y });
