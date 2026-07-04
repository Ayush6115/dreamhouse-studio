import type { UnitSystem } from '../types/document';

/**
 * All model values are stored in METERS / m². These helpers only convert for
 * display and parse user input back to meters.
 */

const M_PER_FT = 0.3048;
const SQFT_PER_M2 = 1 / (M_PER_FT * M_PER_FT);

export function formatLength(meters: number, unit: UnitSystem, decimals = 2): string {
  if (unit === 'metric') {
    return `${meters.toFixed(decimals)} m`;
  }
  const totalInches = (meters / M_PER_FT) * 12;
  const feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  let f = feet;
  if (inches === 12) {
    f += 1;
    inches = 0;
  }
  return inches === 0 ? `${f}'` : `${f}' ${inches}"`;
}

export function formatArea(m2: number, unit: UnitSystem, decimals = 2): string {
  if (unit === 'metric') return `${m2.toFixed(decimals)} m²`;
  return `${(m2 * SQFT_PER_M2).toFixed(decimals === 2 ? 0 : decimals)} ft²`;
}

/**
 * Parse a user-entered length into meters. Accepts:
 *   "3.5" (current unit) · "3.5m" · "350cm" · "3500mm" · "11'6\"" · "11ft" · "6in"
 * Returns null when unparseable.
 */
export function parseLength(input: string, unit: UnitSystem): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;

  // feet + inches: 11'6" or 11' or 6"
  const ftIn = s.match(/^(?:(\d+(?:\.\d+)?)')?(?:(\d+(?:\.\d+)?)"?)?$/);
  if (s.includes("'") || s.endsWith('"')) {
    if (!ftIn || (ftIn[1] === undefined && ftIn[2] === undefined)) return null;
    const ft = parseFloat(ftIn[1] ?? '0');
    const inches = parseFloat(ftIn[2] ?? '0');
    return (ft + inches / 12) * M_PER_FT;
  }

  const m = s.match(/^(-?\d+(?:\.\d+)?)(mm|cm|m|ft|in)?$/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  switch (m[2]) {
    case 'mm':
      return v / 1000;
    case 'cm':
      return v / 100;
    case 'm':
      return v;
    case 'ft':
      return v * M_PER_FT;
    case 'in':
      return (v / 12) * M_PER_FT;
    default:
      // Bare number: interpret in the current display unit.
      return unit === 'metric' ? v : v * M_PER_FT;
  }
}

export const m2ToDisplay = (m2: number, unit: UnitSystem): number =>
  unit === 'metric' ? m2 : m2 * SQFT_PER_M2;
