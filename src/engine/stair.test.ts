import { describe, expect, it } from 'vitest';
import { analyzeStair, suggestRisers, RESIDENTIAL_RULES } from './stair';

describe('stair engine', () => {
  it('straight stair: exact riser/going arithmetic', () => {
    // 4.2 m run, 3.0 m floor-to-floor, 16 risers.
    const s = analyzeStair(1.0, 4.2, 3.0, 16, 'straight');
    expect(s.risers).toBe(16);
    expect(s.treads).toBe(15);
    expect(s.riserHeight).toBeCloseTo(0.1875, 6);
    expect(s.going).toBeCloseTo(0.28, 6);
    expect(s.comfort).toBeCloseTo(2 * 0.1875 + 0.28, 6);
    expect(s.ok).toBe(true);
  });

  it('flags code violations on a cramped straight run', () => {
    // 2.85 m run cannot host 16 risers at a legal going.
    const s = analyzeStair(1.0, 2.865, 3.05, 16, 'straight');
    expect(s.going).toBeLessThan(RESIDENTIAL_RULES.minTread);
    expect(s.ok).toBe(false);
    expect(s.warnings.join(' ')).toMatch(/Going/);
  });

  it('dogleg solves the same envelope legally', () => {
    // 1.645 × 2.865 m well, 3.05 m rise — the classic residential dogleg.
    const s = analyzeStair(1.645, 2.865, 3.05, 17, 'u-shaped');
    expect(s.flights).toHaveLength(2);
    expect(s.flights[0].risers + s.flights[1].risers).toBe(17);
    expect(s.riserHeight).toBeLessThanOrEqual(RESIDENTIAL_RULES.maxRiser);
    expect(s.going).toBeGreaterThanOrEqual(RESIDENTIAL_RULES.minTread);
    expect(s.landing).toBeGreaterThanOrEqual(RESIDENTIAL_RULES.minLanding);
    // Narrow flights are the one legitimate complaint in this envelope.
    expect(s.warnings.filter((w) => !w.includes('Flight width'))).toHaveLength(0);
  });

  it('suggestRisers lands in the legal band when one exists', () => {
    const n = suggestRisers(1.645, 2.865, 3.05, 'u-shaped');
    const s = analyzeStair(1.645, 2.865, 3.05, n, 'u-shaped');
    expect(s.riserHeight).toBeGreaterThanOrEqual(RESIDENTIAL_RULES.minRiser);
    expect(s.riserHeight).toBeLessThanOrEqual(RESIDENTIAL_RULES.maxRiser);
    expect(s.going).toBeGreaterThanOrEqual(RESIDENTIAL_RULES.minTread);
  });

  it('riser count × riser height always reconstructs the rise exactly', () => {
    for (const n of [12, 14, 17, 21]) {
      const s = analyzeStair(1.2, 3.6, 2.9, n, 'straight');
      expect(s.risers * s.riserHeight).toBeCloseTo(2.9, 9);
    }
  });
});
