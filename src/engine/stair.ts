import type { StaircaseElement } from '../types';

/**
 * Stair engine — stairs are building components, not furniture.
 *
 * Given the geometric envelope a staircase occupies (width × run depth ×
 * floor-to-floor height) and its configuration, this module derives the
 * complete engineering solution: riser count and height, tread count and
 * going, flight layout, slope, and the classic 2R+G comfort figure — and
 * validates the result against configurable building-code rules.
 *
 * All values are meters (SI); presentation layers format to mm or ft-in.
 */

export type StairType = StaircaseElement['style'];

export interface StairRules {
  /** Riser height limits (residential defaults ≈ IRC/NBC envelopes). */
  minRiser: number;
  maxRiser: number;
  idealRiser: number;
  /** Minimum tread going. */
  minTread: number;
  idealTread: number;
  /** 2R + G comfort band (Blondel). */
  comfortMin: number;
  comfortMax: number;
  maxSlopeDeg: number;
  minClearWidth: number;
  minLanding: number;
}

export const RESIDENTIAL_RULES: StairRules = {
  minRiser: 0.1,
  maxRiser: 0.19,
  idealRiser: 0.172,
  minTread: 0.25,
  idealTread: 0.27,
  comfortMin: 0.55,
  comfortMax: 0.7,
  maxSlopeDeg: 42,
  minClearWidth: 0.9,
  minLanding: 0.75,
};

export interface StairFlight {
  /** Risers climbed in this flight. */
  risers: number;
  /** Horizontal run of the flight (treads × going). */
  run: number;
}

export interface StairSolution {
  type: StairType;
  risers: number;
  riserHeight: number;
  /** Total treads (risers − 1; the top riser lands on the floor above). */
  treads: number;
  going: number;
  /** Flights in walking order; dogleg/L stairs insert a landing between. */
  flights: StairFlight[];
  /** Landing depth along the run (0 for straight). */
  landing: number;
  /** Clear width of one flight. */
  flightWidth: number;
  slopeDeg: number;
  /** 2R + G (Blondel comfort figure). */
  comfort: number;
  ok: boolean;
  warnings: string[];
}

/**
 * Analyze the staircase envelope for a given riser count.
 * width/depth is the plan footprint; height the floor-to-floor rise.
 */
export function analyzeStair(
  width: number,
  depth: number,
  height: number,
  risers: number,
  type: StairType = 'straight',
  rules: StairRules = RESIDENTIAL_RULES,
): StairSolution {
  risers = Math.max(2, Math.round(risers));
  const riserHeight = height / risers;
  const treads = risers - 1;

  let flights: StairFlight[];
  let landing = 0;
  let flightWidth = width;
  let going: number;

  if (type === 'straight') {
    going = depth / treads;
    flights = [{ risers, run: treads * going }];
  } else if (type === 'u-shaped') {
    // Dogleg: two parallel flights joined by a half-space landing across
    // the full width. Landing depth = flight width (square landing).
    flightWidth = width / 2;
    landing = Math.max(rules.minLanding, flightWidth);
    const r1 = Math.ceil(risers / 2);
    const r2 = risers - r1;
    const runDepth = Math.max(0.05, depth - landing);
    // Both flights share the same run window; the longer flight governs.
    const govTreads = Math.max(1, Math.max(r1, r2) - 1);
    going = runDepth / govTreads;
    flights = [
      { risers: r1, run: (r1 - 1) * going },
      { risers: r2, run: Math.max(0, r2 - 1) * going },
    ];
  } else {
    // L-shaped: one turn with a square quarter landing; the two legs share
    // the footprint. Approximate: landing = width, remaining run split by
    // riser proportion along the depth leg.
    landing = Math.max(rules.minLanding, Math.min(width, depth) * 0.4);
    const runDepth = depth - landing;
    going = runDepth / Math.max(1, treads - 1);
    flights = [
      { risers: Math.ceil(risers / 2), run: (Math.ceil(risers / 2) - 1) * going },
      { risers: Math.floor(risers / 2), run: Math.max(0, Math.floor(risers / 2) - 1) * going },
    ];
  }

  const slopeDeg = (Math.atan2(riserHeight, going) * 180) / Math.PI;
  const comfort = 2 * riserHeight + going;

  const warnings: string[] = [];
  const mm = (v: number) => `${Math.round(v * 1000)} mm`;
  if (riserHeight > rules.maxRiser + 1e-9) warnings.push(`Riser ${mm(riserHeight)} exceeds ${mm(rules.maxRiser)} — add risers or reduce floor height.`);
  if (riserHeight < rules.minRiser - 1e-9) warnings.push(`Riser ${mm(riserHeight)} is below ${mm(rules.minRiser)} — remove risers.`);
  if (going < rules.minTread - 1e-9) warnings.push(`Going ${mm(going)} is below ${mm(rules.minTread)} — lengthen the run${type === 'straight' ? ' or switch to a dogleg (U) layout' : ''}.`);
  if (comfort < rules.comfortMin - 1e-9 || comfort > rules.comfortMax + 1e-9) warnings.push(`2R+G = ${mm(comfort)} is outside the ${mm(rules.comfortMin)}–${mm(rules.comfortMax)} comfort band.`);
  if (slopeDeg > rules.maxSlopeDeg + 1e-9) warnings.push(`Slope ${slopeDeg.toFixed(1)}° exceeds ${rules.maxSlopeDeg}°.`);
  if (flightWidth < rules.minClearWidth - 1e-9) warnings.push(`Flight width ${mm(flightWidth)} is below ${mm(rules.minClearWidth)}.`);

  return {
    type,
    risers,
    riserHeight,
    treads,
    going,
    flights,
    landing,
    flightWidth,
    slopeDeg,
    comfort,
    ok: warnings.length === 0,
    warnings,
  };
}

/**
 * Best riser count for an envelope: scans the code-legal range and scores
 * each candidate by closeness to the ideal riser, ideal going, and the
 * center of the comfort band.
 */
export function suggestRisers(
  width: number,
  depth: number,
  height: number,
  type: StairType = 'straight',
  rules: StairRules = RESIDENTIAL_RULES,
): number {
  const lo = Math.max(2, Math.ceil(height / rules.maxRiser));
  const hi = Math.max(lo, Math.floor(height / rules.minRiser));
  let best = lo;
  let bestScore = Infinity;
  for (let n = lo; n <= Math.min(hi, lo + 24); n++) {
    const s = analyzeStair(width, depth, height, n, type, rules);
    const score =
      Math.abs(s.riserHeight - rules.idealRiser) * 6 +
      Math.abs(s.going - rules.idealTread) * 3 +
      Math.abs(s.comfort - (rules.comfortMin + rules.comfortMax) / 2) +
      s.warnings.length * 0.05;
    if (score < bestScore) {
      bestScore = score;
      best = n;
    }
  }
  return best;
}

/** Solution for a staircase element within its level. */
export function solveStairElement(el: StaircaseElement, floorToFloor: number): StairSolution {
  return analyzeStair(el.dimensions.width, el.dimensions.depth, floorToFloor || el.dimensions.height, el.steps, el.style);
}
