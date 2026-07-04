import { describe, expect, it } from 'vitest';
import { pt } from '../types/geometry';
import { snapPoint, snapToGrid } from './snapping';

describe('snapping', () => {
  it('snaps to grid', () => {
    expect(snapToGrid(pt(1.23, 4.56), 0.5)).toEqual(pt(1.0, 4.5));
  });

  it('prefers existing points over the grid', () => {
    const r = snapPoint(pt(2.05, 2.02), {
      gridSize: 0.5,
      points: [pt(2.1, 2.1)],
      tolerance: 0.2,
    });
    expect(r.kind).toBe('point');
    expect(r.point).toEqual(pt(2.1, 2.1));
  });

  it('slides along segments when no point is near', () => {
    const r = snapPoint(pt(2, 0.1), {
      gridSize: 0,
      segments: [{ a: pt(0, 0), b: pt(5, 0) }],
      tolerance: 0.2,
    });
    expect(r.kind).toBe('segment');
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.x).toBeCloseTo(2);
  });

  it('locks angles from an anchor', () => {
    // Nearly horizontal from anchor → locked to exactly horizontal.
    const r = snapPoint(pt(3, 0.05), {
      gridSize: 0.5,
      anchor: pt(0, 0),
      tolerance: 0.2,
    });
    expect(r.kind).toBe('angle');
    expect(r.point.y).toBeCloseTo(0);
    expect(r.point.x).toBeCloseTo(3);
  });

  it('falls back to the raw point outside all tolerances', () => {
    const r = snapPoint(pt(1.13, 2.31), { gridSize: 0.5, tolerance: 0.05 });
    expect(r.kind).toBe('none');
    expect(r.point).toEqual(pt(1.13, 2.31));
  });
});
