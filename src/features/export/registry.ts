import type Konva from 'konva';
import type * as THREE from 'three';

/**
 * Live handles to the render surfaces, registered by the canvases on mount.
 * The export pipeline reads them; nothing else should.
 */
interface ExportRegistry {
  planStage: Konva.Stage | null;
  elevationStage: Konva.Stage | null;
  glCanvas: HTMLCanvasElement | null;
  /** Live three.js scene while the 3D view is mounted (for GLB export). */
  scene3d: THREE.Scene | null;
  /** Live renderer + camera + frameloop control (for the photoreal renderer). */
  three: {
    gl: THREE.WebGLRenderer;
    camera: THREE.Camera;
    setFrameloop: (mode: 'always' | 'demand' | 'never') => void;
  } | null;
  /** Cached 3D snapshot from the last time the 3D view was open. */
  last3DSnapshot: string | null;
}

export const exportRegistry: ExportRegistry = {
  planStage: null,
  elevationStage: null,
  glCanvas: null,
  scene3d: null,
  three: null,
  last3DSnapshot: null,
};

// Development-only inspection handle used by the end-to-end test suite
// (scripts/smoke.mjs) to examine the live scene. Absent in production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __dreamhouse?: ExportRegistry }).__dreamhouse = exportRegistry;
}
