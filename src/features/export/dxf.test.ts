import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DesignDocument } from '../../types';
import { flattenPathData, planDXF } from './dxf';

describe('dxf export', () => {
  it('flattens the block path grammar', () => {
    // straight segments
    const lines = flattenPathData('M 0 0 L 1 0 L 1 1');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveLength(3);
    // rounded rect: h/v runs + four corner arcs, closed
    const rr = flattenPathData('M 0.1 0 h 0.8 a 0.1 0.1 0 0 1 0.1 0.1 v 0.8 a 0.1 0.1 0 0 1 -0.1 0.1 h -0.8 a 0.1 0.1 0 0 1 -0.1 -0.1 v -0.8 a 0.1 0.1 0 0 1 0.1 -0.1 Z');
    expect(rr).toHaveLength(1);
    const pts = rr[0];
    const first = pts[0];
    const last = pts[pts.length - 1];
    expect(Math.hypot(first.x - last.x, first.y - last.y)).toBeLessThan(1e-9);
    // every point stays inside the unit box (arcs bulge correctly inward)
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-6);
      expect(p.x).toBeLessThanOrEqual(1 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(-1e-6);
      expect(p.y).toBeLessThanOrEqual(1 + 1e-6);
    }
    // bezier subdivision
    const bez = flattenPathData('M 0 0 C 0 1 1 1 1 0');
    expect(bez[0].length).toBeGreaterThan(5);
  });

  it('produces a structurally valid mm DXF from the example document', () => {
    const doc = JSON.parse(
      readFileSync('examples/urban-residence.dreamhouse.json', 'utf8'),
    ) as DesignDocument;
    const dxf = planDXF(doc, doc.levels[0].id);
    // header, tables, entities, EOF
    expect(dxf).toContain('$INSUNITS');
    for (const layer of ['WALLS', 'DOORS', 'WINDOWS', 'STAIR', 'FURNITURE', 'DIMS', 'TEXT']) {
      expect(dxf).toContain(layer);
    }
    expect(dxf.trim().endsWith('EOF')).toBe(true);
    expect((dxf.match(/\r\n0\r\nLINE\r\n/g) ?? []).length).toBeGreaterThan(200);
    expect((dxf.match(/\r\n0\r\nTEXT\r\n/g) ?? []).length).toBeGreaterThan(20);
    expect((dxf.match(/\r\n0\r\nARC\r\n/g) ?? []).length).toBeGreaterThan(5);
    // mm scale: the 31'1" (9.47 m) overall wall extent appears as ≥9000 mm coords
    const xs = [...dxf.matchAll(/\r\n10\r\n(-?\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
    expect(Math.max(...xs)).toBeGreaterThan(9000);
  });
});
