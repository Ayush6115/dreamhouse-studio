import { describe, expect, it } from 'vitest';
import { pt } from '../types/geometry';
import { buildableRegion, classifyEdges, insetPolygon, polygonDifference, vectorToCompass } from './setbacks';
import { polygonArea } from './polygon';

// 12 m (E-W) × 9 m (N-S) plot, clockwise on screen, top edge first.
const rect = [pt(0, 0), pt(12, 0), pt(12, 9), pt(0, 9)];

describe('setbacks', () => {
  it('converts plan vectors to compass headings', () => {
    expect(vectorToCompass(pt(0, -1))).toBeCloseTo(0); // up = north
    expect(vectorToCompass(pt(1, 0))).toBeCloseTo(90); // right = east
    expect(vectorToCompass(pt(0, 1))).toBeCloseTo(180); // down = south
    expect(vectorToCompass(pt(-1, 0))).toBeCloseTo(270); // left = west
  });

  it('classifies edges relative to a south road', () => {
    // Road at 180° (south / bottom of screen). Facing the plot from the
    // road (looking north): east is the observer's right.
    const sides = classifyEdges(rect, 180);
    expect(sides).toEqual(['rear', 'right', 'front', 'left']);
  });

  it('insets a rectangle by uniform distance', () => {
    const inner = insetPolygon(rect, [1, 1, 1, 1]);
    expect(inner).not.toBeNull();
    expect(polygonArea(inner!)).toBeCloseTo(10 * 7);
  });

  it('computes buildable region with differing side setbacks', () => {
    const region = buildableRegion(rect, 180, { front: 3, rear: 1.5, left: 1, right: 1 });
    expect(region).not.toBeNull();
    // width: 12 - 1 - 1 = 10; depth: 9 - 3 - 1.5 = 4.5
    expect(polygonArea(region!)).toBeCloseTo(10 * 4.5);
  });

  it('returns null when setbacks collapse the plot', () => {
    expect(insetPolygon(rect, [6, 6, 6, 6])).toBeNull();
  });

  it('applies per-edge setback overrides', () => {
    // Edge 1 (east side, "right" for a south road) overridden to 3 m.
    const region = buildableRegion(rect, 180, { front: 3, rear: 1.5, left: 1, right: 1 }, [null, 3, null, null]);
    expect(region).not.toBeNull();
    // width: 12 - 1(left) - 3(east override) = 8; depth: 9 - 3 - 1.5 = 4.5
    expect(polygonArea(region!)).toBeCloseTo(8 * 4.5);
  });

  it('computes polygon difference for validation', () => {
    const inner = [pt(2, 2), pt(10, 2), pt(10, 7), pt(2, 7)];
    expect(polygonDifference(inner, rect)).toHaveLength(0); // fully inside
    const poking = [pt(8, 2), pt(15, 2), pt(15, 7), pt(8, 7)];
    const outside = polygonDifference(poking, rect);
    expect(outside).toHaveLength(1);
    expect(polygonArea(outside[0])).toBeCloseTo(3 * 5); // 12..15 × 2..7
  });

  it('handles counter-clockwise input identically', () => {
    const ccw = [...rect].reverse();
    const region = buildableRegion(ccw, 180, { front: 3, rear: 1.5, left: 1, right: 1 });
    expect(region).not.toBeNull();
    expect(polygonArea(region!)).toBeCloseTo(10 * 4.5);
  });
});
