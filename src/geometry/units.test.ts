import { describe, expect, it } from 'vitest';
import { formatArea, formatLength, parseLength } from './units';

describe('units', () => {
  it('formats metric lengths', () => {
    expect(formatLength(3.5, 'metric')).toBe('3.50 m');
  });

  it('formats imperial lengths as feet-inches', () => {
    expect(formatLength(0.3048, 'imperial')).toBe(`1'`);
    expect(formatLength(3.5052, 'imperial')).toBe(`11' 6"`);
  });

  it('formats areas', () => {
    expect(formatArea(25, 'metric')).toBe('25.00 m²');
    expect(formatArea(25, 'imperial')).toBe('269 ft²');
  });

  it('parses bare numbers in the current unit', () => {
    expect(parseLength('3.5', 'metric')).toBeCloseTo(3.5);
    expect(parseLength('10', 'imperial')).toBeCloseTo(3.048);
  });

  it('parses explicit units', () => {
    expect(parseLength('350cm', 'metric')).toBeCloseTo(3.5);
    expect(parseLength('3500 mm', 'metric')).toBeCloseTo(3.5);
    expect(parseLength('10ft', 'metric')).toBeCloseTo(3.048);
    expect(parseLength(`11'6"`, 'metric')).toBeCloseTo(3.5052);
    expect(parseLength(`6"`, 'metric')).toBeCloseTo(0.1524);
  });

  it('rejects garbage', () => {
    expect(parseLength('abc', 'metric')).toBeNull();
    expect(parseLength('', 'metric')).toBeNull();
  });
});
