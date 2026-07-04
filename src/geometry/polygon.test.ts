import { describe, expect, it } from 'vitest';
import { edgeLengths, isClockwise, pointInPolygon, polygonArea, polygonCentroid, polygonPerimeter, signedArea } from './polygon';
import { pt } from '../types/geometry';

// Screen coordinates: +x right, +y down. This square is clockwise on screen.
const square = [pt(0, 0), pt(4, 0), pt(4, 4), pt(0, 4)];
const lShape = [pt(0, 0), pt(6, 0), pt(6, 3), pt(3, 3), pt(3, 6), pt(0, 6)];

describe('polygon', () => {
  it('computes area of a square', () => {
    expect(polygonArea(square)).toBeCloseTo(16);
  });

  it('computes area of an L-shape (concave)', () => {
    // 6×6 minus the 3×3 notch
    expect(polygonArea(lShape)).toBeCloseTo(27);
  });

  it('signed area is positive for clockwise-on-screen winding', () => {
    expect(signedArea(square)).toBeGreaterThan(0);
    expect(isClockwise(square)).toBe(true);
    expect(isClockwise([...square].reverse())).toBe(false);
  });

  it('computes perimeter and edge lengths', () => {
    expect(polygonPerimeter(square)).toBeCloseTo(16);
    expect(edgeLengths(square)).toEqual([4, 4, 4, 4]);
  });

  it('computes centroid', () => {
    const c = polygonCentroid(square);
    expect(c.x).toBeCloseTo(2);
    expect(c.y).toBeCloseTo(2);
  });

  it('point-in-polygon works for convex and concave shapes', () => {
    expect(pointInPolygon(pt(2, 2), square)).toBe(true);
    expect(pointInPolygon(pt(5, 5), square)).toBe(false);
    expect(pointInPolygon(pt(1, 5), lShape)).toBe(true); // inside the leg
    expect(pointInPolygon(pt(5, 5), lShape)).toBe(false); // inside the notch
  });
});
