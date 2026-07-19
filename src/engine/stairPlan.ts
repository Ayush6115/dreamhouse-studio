import type { SymbolPrim } from '../library/symbolBlocks';
import type { StairSolution } from './stair';

/**
 * Plan-view drafting geometry for a solved staircase: treads, flight
 * divider, landing, break line, and the walk line with its tail circle and
 * arrowhead — one definition shared by the canvas and the export sheets.
 */

const n = (v: number) => Math.round(v * 1000) / 1000;
const ln = (...pts: number[]): string => {
  let d = `M ${n(pts[0])} ${n(pts[1])}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L ${n(pts[i])} ${n(pts[i + 1])}`;
  return d;
};

export function stairPlanBlock(w: number, d: number, sol: StairSolution): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [
    { k: 'path', d: ln(-hw, -hd, hw, -hd, hw, hd, -hw, hd) + ' Z', thick: true, fill: 'body' },
  ];
  const z = 0.09; // break-line amplitude

  if (sol.type === 'u-shaped' && sol.flights.length === 2) {
    const landY = -hd + sol.landing;
    const r1 = sol.flights[0].risers;
    const r2 = sol.flights[1].risers;
    // landing edge + newel divider between the flights
    p.push({ k: 'path', d: ln(-hw, landY, hw, landY) });
    p.push({ k: 'path', d: ln(0, landY, 0, hd), thick: true });
    // up flight (right): treads from the front toward the landing
    for (let i = 1; i <= r1 - 1; i++) {
      const y = hd - i * sol.going;
      if (y > landY + 0.02) p.push({ k: 'path', d: ln(0, y, hw, y) });
    }
    // return flight (left) — cut by the break line, hidden beyond
    const cutY = hd - Math.max(1, r2 - 1) * sol.going * 0.45;
    for (let i = 1; i <= Math.max(0, r2 - 1); i++) {
      const y = hd - i * sol.going;
      if (y > landY + 0.02) {
        p.push({ k: 'path', d: ln(-hw, y, 0, y), dash: y < cutY });
      }
    }
    p.push({
      k: 'path',
      d: `M ${n(-hw - 0.05)} ${n(cutY + z)} L ${n(-hw * 0.66)} ${n(cutY + z * 0.2)} L ${n(-hw * 0.33)} ${n(cutY + z * 1.4)} L ${n(-0.02)} ${n(cutY - z * 0.4)}`,
      thick: true,
    });
    // walk line: up the right flight, around the landing, back down the left
    p.push({ k: 'circle', x: hw * 0.5, y: hd - 0.16, r: 0.045 });
    p.push({
      k: 'path',
      d:
        `M ${n(hw * 0.5)} ${n(hd - 0.16)} L ${n(hw * 0.5)} ${n(landY - sol.landing * 0.35)}` +
        ` Q ${n(hw * 0.5)} ${n(-hd + 0.12)} 0 ${n(-hd + 0.12)}` +
        ` Q ${n(-hw * 0.5)} ${n(-hd + 0.12)} ${n(-hw * 0.5)} ${n(landY - sol.landing * 0.35)}` +
        ` L ${n(-hw * 0.5)} ${n(cutY - 0.12)}`,
      thick: true,
    });
    p.push({
      k: 'path',
      d: ln(-hw * 0.5 - 0.08, cutY - 0.28, -hw * 0.5, cutY - 0.1, -hw * 0.5 + 0.08, cutY - 0.28),
      thick: true,
    });
    return p;
  }

  // straight (and, for now, L) — full-width treads with a mid break line
  for (let i = 1; i <= sol.treads - 1; i++) {
    const y = -hd + i * (d / sol.treads);
    p.push({ k: 'path', d: ln(-hw, y, hw, y) });
  }
  p.push({
    k: 'path',
    d: `M ${n(-hw - 0.05)} ${n(z)} L ${n(-hw / 3)} ${n(z * 0.2)} L 0 ${n(z * 1.4)} L ${n(hw / 3)} ${n(-z * 0.6)} L ${n(hw + 0.05)} ${n(-z * 0.1)}`,
    thick: true,
  });
  p.push({ k: 'circle', x: 0, y: hd - 0.16, r: 0.045 });
  p.push({ k: 'path', d: ln(0, hd - 0.16, 0, -hd + 0.22), thick: true });
  p.push({ k: 'path', d: ln(-0.09, -hd + 0.38, 0, -hd + 0.2, 0.09, -hd + 0.38), thick: true });
  return p;
}
