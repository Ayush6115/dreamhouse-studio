import type Konva from 'konva';
import type { Point } from '../../types';

/**
 * The plan viewport: a pan offset in screen pixels plus a scale in
 * pixels-per-meter. Konva Stage consumes it directly (x, y, scaleX/Y), so all
 * shapes are drawn in METER coordinates.
 */
export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 4; // px per meter
export const MAX_SCALE = 400;

export function screenToWorld(vp: Viewport, screen: Point): Point {
  return { x: (screen.x - vp.x) / vp.scale, y: (screen.y - vp.y) / vp.scale };
}

export function worldToScreen(vp: Viewport, world: Point): Point {
  return { x: world.x * vp.scale + vp.x, y: world.y * vp.scale + vp.y };
}

/** Zoom around a screen-space anchor (the cursor). */
export function zoomAt(vp: Viewport, anchor: Point, factor: number): Viewport {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, vp.scale * factor));
  const world = screenToWorld(vp, anchor);
  return {
    scale,
    x: anchor.x - world.x * scale,
    y: anchor.y - world.y * scale,
  };
}

/** Current pointer position in world meters (null when off-stage). */
export function pointerWorld(stage: Konva.Stage, vp: Viewport): Point | null {
  const p = stage.getPointerPosition();
  return p ? screenToWorld(vp, p) : null;
}
