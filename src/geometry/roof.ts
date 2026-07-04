import type { Point } from '../types/geometry';

/**
 * Roof geometry in ROOF-LOCAL coordinates: origin at the footprint center,
 * x along the ridge axis (width W), y across it (depth D), z up from the
 * eave plate. W and D INCLUDE the overhang (callers expand the footprint).
 *
 * Styles:
 * - flat : slab of `thickness` (optional parapet handled by the renderer)
 * - shed : single slope, low edge at +y, high edge at -y
 * - gable: two slopes meeting at a ridge along x, vertical gable end caps
 * - hip  : four slopes; ridge shortened by the plan aspect (pyramid when W≈D)
 */

export type RoofStyle = 'flat' | 'shed' | 'gable' | 'hip' | 'barrel';

/**
 * Barrel vault cross-section: circular arc through both eaves and the apex.
 * Rise is clamped below a semicircle so the arc never bulges past the eaves.
 */
function barrelArc(D: number, pitchDeg: number): { rise: number; c: number; R: number } {
  const hd = D / 2;
  const rise = Math.min(hd * Math.tan((pitchDeg * Math.PI) / 180), hd * 0.9);
  const R = (hd * hd + rise * rise) / (2 * rise);
  const c = rise - R; // center height (≤ 0)
  return { rise, c, R };
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** Planar face, vertices wound CCW as seen from OUTSIDE the solid. */
export interface RoofFace {
  pts: Vec3Like[];
}

export interface RoofGeometry {
  faces: RoofFace[];
  /** Ridge segment in local plan coords (null for flat). */
  ridge: [Point, Point] | null;
  /** Highest point above the eave plate. */
  rise: number;
}

const v = (x: number, y: number, z: number): Vec3Like => ({ x, y, z });

export function roofRise(style: RoofStyle, W: number, D: number, pitchDeg: number): number {
  const t = Math.tan((pitchDeg * Math.PI) / 180);
  switch (style) {
    case 'flat':
      return 0;
    case 'shed':
      return D * t;
    case 'gable':
      return (D / 2) * t;
    case 'hip':
      return (Math.min(W, D) / 2) * t;
    case 'barrel':
      return barrelArc(D, pitchDeg).rise;
  }
}

export function roofGeometry(
  style: RoofStyle,
  W: number,
  D: number,
  pitchDeg: number,
  thickness: number,
): RoofGeometry {
  const hw = W / 2;
  const hd = D / 2;
  const rise = roofRise(style, W, D, pitchDeg);

  if (style === 'flat') {
    const z0 = 0;
    const z1 = thickness;
    const bl = v(-hw, -hd, z0);
    const br = v(hw, -hd, z0);
    const tr = v(hw, hd, z0);
    const tl = v(-hw, hd, z0);
    const BL = v(-hw, -hd, z1);
    const BR = v(hw, -hd, z1);
    const TR = v(hw, hd, z1);
    const TL = v(-hw, hd, z1);
    return {
      rise: thickness,
      ridge: null,
      faces: [
        { pts: [BL, BR, TR, TL] }, // top
        { pts: [tl, tr, br, bl] }, // bottom
        { pts: [bl, br, BR, BL] }, // -y
        { pts: [tr, tl, TL, TR] }, // +y
        { pts: [br, tr, TR, BR] }, // +x
        { pts: [tl, bl, BL, TL] }, // -x
      ],
    };
  }

  if (style === 'shed') {
    // Low eave at +y (z 0..th), high edge at -y (z rise..rise+th).
    const th = thickness;
    const lo0 = [v(-hw, hd, 0), v(hw, hd, 0)];
    const lo1 = [v(-hw, hd, th), v(hw, hd, th)];
    const hi0 = [v(-hw, -hd, rise), v(hw, -hd, rise)];
    const hi1 = [v(-hw, -hd, rise + th), v(hw, -hd, rise + th)];
    return {
      rise: rise + th,
      ridge: [
        { x: -hw, y: -hd },
        { x: hw, y: -hd },
      ],
      faces: [
        { pts: [lo1[0], lo1[1], hi1[1], hi1[0]] }, // top slope
        { pts: [hi0[0], hi0[1], lo0[1], lo0[0]] }, // underside
        { pts: [lo0[0], lo0[1], lo1[1], lo1[0]] }, // low edge
        { pts: [hi1[0], hi1[1], hi0[1], hi0[0]] }, // high edge
        { pts: [lo0[1], hi0[1], hi1[1], lo1[1]] }, // +x side
        { pts: [hi0[0], lo0[0], lo1[0], hi1[0]] }, // -x side
      ],
    };
  }

  if (style === 'gable') {
    // Triangular prism: eaves at z0, ridge along x at height `rise`.
    const a = v(-hw, -hd, 0);
    const b = v(hw, -hd, 0);
    const c = v(hw, hd, 0);
    const d = v(-hw, hd, 0);
    const r1 = v(-hw, 0, rise);
    const r2 = v(hw, 0, rise);
    return {
      rise,
      ridge: [
        { x: -hw, y: 0 },
        { x: hw, y: 0 },
      ],
      faces: [
        { pts: [d, c, r2, r1] }, // +y slope
        { pts: [r1, r2, b, a] }, // -y slope
        { pts: [a, b, c, d].reverse() }, // bottom (down)
        { pts: [b, r2, c] }, // +x gable end
        { pts: [d, r1, a] }, // -x gable end
      ],
    };
  }

  if (style === 'barrel') {
    const { c, R } = barrelArc(D, pitchDeg);
    const N = 18;
    const cross: Vec3Like[] = [];
    for (let i = 0; i <= N; i++) {
      const y = -hd + (i * D) / N;
      cross.push(v(0, y, Math.max(0, c + Math.sqrt(Math.max(0, R * R - y * y)))));
    }
    const faces: RoofFace[] = [];
    // Curved top strips.
    for (let i = 0; i < N; i++) {
      const a = cross[i];
      const b = cross[i + 1];
      faces.push({ pts: [v(-hw, b.y, b.z), v(hw, b.y, b.z), v(hw, a.y, a.z), v(-hw, a.y, a.z)] });
    }
    // End caps (fans over the arch).
    faces.push({ pts: cross.map((p) => v(hw, p.y, p.z)) });
    faces.push({ pts: [...cross].reverse().map((p) => v(-hw, p.y, p.z)) });
    // Bottom.
    faces.push({ pts: [v(-hw, -hd, 0), v(-hw, hd, 0), v(hw, hd, 0), v(hw, -hd, 0)] });
    return {
      rise: roofRise('barrel', W, D, pitchDeg),
      ridge: [
        { x: -hw, y: 0 },
        { x: hw, y: 0 },
      ],
      faces,
    };
  }

  // hip — ridge along the LONGER plan axis.
  const alongX = W >= D;
  const half = alongX ? (W - D) / 2 : (D - W) / 2;
  const r1p = alongX ? v(-half, 0, rise) : v(0, -half, rise);
  const r2p = alongX ? v(half, 0, rise) : v(0, half, rise);
  const a = v(-hw, -hd, 0);
  const b = v(hw, -hd, 0);
  const c = v(hw, hd, 0);
  const d = v(-hw, hd, 0);
  const faces: RoofFace[] = alongX
    ? [
        { pts: [a, b, r2p, r1p] }, // -y slope
        { pts: [c, d, r1p, r2p] }, // +y slope
        { pts: [b, c, r2p] }, // +x hip
        { pts: [d, a, r1p] }, // -x hip
        { pts: [a, d, c, b] }, // bottom
      ]
    : [
        { pts: [b, c, r2p, r1p] }, // +x slope
        { pts: [d, a, r1p, r2p] }, // -x slope
        { pts: [c, d, r2p] }, // +y hip
        { pts: [a, b, r1p] }, // -y hip
        { pts: [a, d, c, b] }, // bottom
      ];
  return {
    rise,
    ridge: [
      { x: r1p.x, y: r1p.y },
      { x: r2p.x, y: r2p.y },
    ],
    faces,
  };
}

/**
 * Height of the roof's TOP surface above the eave plate at local (x, y) —
 * used to seat skylights on the slope. Returns null outside the footprint.
 */
export function roofSurfaceZ(
  style: RoofStyle,
  W: number,
  D: number,
  pitchDeg: number,
  thickness: number,
  x: number,
  y: number,
): number | null {
  const hw = W / 2;
  const hd = D / 2;
  if (Math.abs(x) > hw || Math.abs(y) > hd) return null;
  const t = Math.tan((pitchDeg * Math.PI) / 180);
  switch (style) {
    case 'flat':
      return thickness;
    case 'shed':
      return (hd - y) * t + thickness;
    case 'gable':
      return (hd - Math.abs(y)) * t;
    case 'hip': {
      const rise = roofRise('hip', W, D, pitchDeg);
      return Math.min((hd - Math.abs(y)) * t, (hw - Math.abs(x)) * t, rise);
    }
    case 'barrel': {
      const { c, R } = barrelArc(D, pitchDeg);
      return Math.max(0, c + Math.sqrt(Math.max(0, R * R - y * y)));
    }
  }
}

/** Outward surface normal at (x, y), from central finite differences. */
export function roofSurfaceNormal(
  style: RoofStyle,
  W: number,
  D: number,
  pitchDeg: number,
  thickness: number,
  x: number,
  y: number,
): Vec3Like {
  const e = 0.01;
  const zc = roofSurfaceZ(style, W, D, pitchDeg, thickness, x, y) ?? 0;
  const zx = roofSurfaceZ(style, W, D, pitchDeg, thickness, Math.min(W / 2, x + e), y) ?? zc;
  const zy = roofSurfaceZ(style, W, D, pitchDeg, thickness, x, Math.min(D / 2, y + e)) ?? zc;
  const n = { x: -(zx - zc) / e, y: -(zy - zc) / e, z: 1 };
  const len = Math.hypot(n.x, n.y, n.z);
  return { x: n.x / len, y: n.y / len, z: n.z / len };
}
