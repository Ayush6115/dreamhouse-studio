import { describe, expect, it } from 'vitest';
import { roofGeometry, roofRise, roofSurfaceZ } from './roof';

describe('roof geometry', () => {
  it('computes rises per style', () => {
    // 30°: tan = 0.5774
    expect(roofRise('flat', 10, 6, 30)).toBe(0);
    expect(roofRise('shed', 10, 6, 30)).toBeCloseTo(6 * Math.tan(Math.PI / 6));
    expect(roofRise('gable', 10, 6, 30)).toBeCloseTo(3 * Math.tan(Math.PI / 6));
    expect(roofRise('hip', 10, 6, 30)).toBeCloseTo(3 * Math.tan(Math.PI / 6)); // min side
  });

  it('flat roof is a 6-face slab', () => {
    const g = roofGeometry('flat', 10, 6, 0, 0.15);
    expect(g.faces).toHaveLength(6);
    expect(g.ridge).toBeNull();
    expect(g.rise).toBeCloseTo(0.15);
  });

  it('gable roof has 2 slopes, 2 end caps and a bottom', () => {
    const g = roofGeometry('gable', 10, 6, 25, 0.15);
    expect(g.faces).toHaveLength(5);
    expect(g.ridge).toEqual([
      { x: -5, y: 0 },
      { x: 5, y: 0 },
    ]);
    // Ridge vertices sit at the computed rise.
    const zs = g.faces.flatMap((f) => f.pts.map((p) => p.z));
    expect(Math.max(...zs)).toBeCloseTo(roofRise('gable', 10, 6, 25));
  });

  it('hip ridge shortens by the aspect and flips with orientation', () => {
    const g = roofGeometry('hip', 10, 6, 30, 0.15);
    expect(g.ridge![0]).toEqual({ x: -2, y: 0 }); // (10-6)/2
    expect(g.ridge![1]).toEqual({ x: 2, y: 0 });
    const g2 = roofGeometry('hip', 6, 10, 30, 0.15);
    expect(g2.ridge![0]).toEqual({ x: 0, y: -2 });
  });

  it('surface height matches slopes and clamps to the footprint', () => {
    // gable 30°, D=6: at ridge (y=0) z=rise; at eave z=0.
    const rise = roofRise('gable', 10, 6, 30);
    expect(roofSurfaceZ('gable', 10, 6, 30, 0.15, 0, 0)).toBeCloseTo(rise);
    expect(roofSurfaceZ('gable', 10, 6, 30, 0.15, 0, 3)).toBeCloseTo(0);
    expect(roofSurfaceZ('gable', 10, 6, 30, 0.15, 0, 7)).toBeNull(); // outside
    // hip: center capped at hip rise.
    expect(roofSurfaceZ('hip', 10, 6, 30, 0.15, 0, 0)).toBeCloseTo(roofRise('hip', 10, 6, 30));
  });
});
