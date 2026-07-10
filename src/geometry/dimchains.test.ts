import { describe, expect, it } from 'vitest';
import type { OpeningElement, WallElement } from '../types/elements';
import { identityTransform, pt } from '../types/geometry';
import { makeMaterial } from '../types/materials';
import { dimensionChains } from './dimchains';

const mkWall = (id: string, sx: number, sy: number, ex: number, ey: number): WallElement => ({
  id,
  type: 'wall',
  name: id,
  start: pt(sx, sy),
  end: pt(ex, ey),
  transform: identityTransform(),
  dimensions: { width: Math.hypot(ex - sx, ey - sy), height: 3, depth: 0.2, thickness: 0.2 },
  material: makeMaterial({ id: 'test', name: 'Test', color: '#ccc' }),
});

const mkWindow = (id: string, wallId: string, offset: number, width: number): OpeningElement => ({
  id,
  type: 'window',
  name: id,
  wallId,
  offset,
  sillHeight: 0.9,
  style: 'fixed',
  transform: identityTransform(),
  dimensions: { width, height: 1.2, depth: 0.2 },
  material: makeMaterial({ id: 'test', name: 'Test', color: '#ccc' }),
});

/** 10×6 rectangle with one interior cross wall at x=4. */
const house = () => [
  mkWall('top', 0, 0, 10, 0),
  mkWall('right', 10, 0, 10, 6),
  mkWall('bottom', 10, 6, 0, 6),
  mkWall('left', 0, 6, 0, 0),
  mkWall('cross', 4, 0, 4, 6),
];

describe('dimensionChains', () => {
  it('returns empty for fewer than two walls', () => {
    expect(dimensionChains([], [])).toEqual([]);
    expect(dimensionChains([mkWall('a', 0, 0, 5, 0)], [])).toEqual([]);
  });

  it('produces overall + wall-station rows on every side', () => {
    const chains = dimensionChains(house(), []);
    expect(chains.map((c) => c.side)).toEqual(['top', 'bottom', 'left', 'right']);

    const top = chains.find((c) => c.side === 'top')!;
    expect(top.axis).toBe('x');
    // Innermost row splits at the interior wall; outermost is the overall.
    expect(top.rows[0]).toEqual([0, 4, 10]);
    expect(top.rows[top.rows.length - 1]).toEqual([0, 10]);

    const left = chains.find((c) => c.side === 'left')!;
    expect(left.axis).toBe('y');
    expect(left.rows[left.rows.length - 1]).toEqual([0, 6]);
  });

  it('adds opening jambs on the facing exterior wall only', () => {
    const walls = house();
    const openings = [mkWindow('w1', 'top', 2, 1.2)]; // centered 2m from (0,0) → jambs at 1.4 / 2.6
    const chains = dimensionChains(walls, openings);

    const top = chains.find((c) => c.side === 'top')!;
    const jambs = top.rows[0];
    expect(jambs).toEqual([0, 1.4, 2.6, 4, 10]);

    // The bottom side must NOT pick up the top wall's window.
    const bottom = chains.find((c) => c.side === 'bottom')!;
    expect(bottom.rows[0]).toEqual([0, 4, 10]);
  });

  it('deduplicates rows that carry no extra information', () => {
    // Plain rectangle, no interior walls, no openings: every side collapses
    // to a single overall row.
    const rect = house().slice(0, 4);
    const chains = dimensionChains(rect, []);
    for (const c of chains) {
      expect(c.rows).toHaveLength(1);
      expect(c.rows[0]).toHaveLength(2);
    }
  });

  it('ignores hidden walls and openings', () => {
    const walls = house();
    walls[4].visible = false; // hide the cross wall
    const openings = [mkWindow('w1', 'top', 2, 1.2)];
    openings[0].visible = false;
    const chains = dimensionChains(walls, openings);
    const top = chains.find((c) => c.side === 'top')!;
    expect(top.rows).toHaveLength(1);
    expect(top.rows[0]).toEqual([0, 10]);
  });
});
