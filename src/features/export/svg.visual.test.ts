import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DesignDocument } from '../../types';
import { elevationSVG, planSVG } from './svg';

/**
 * Sanity checks that both drawing styles produce valid SVG for the bundled
 * example projects, and drops the working-drawing sheets into .visual-out/
 * for manual review (git-ignored).
 */
describe('svg drawing styles', () => {
  const load = (file: string): DesignDocument =>
    JSON.parse(readFileSync(`examples/${file}`, 'utf8')).document ??
    JSON.parse(readFileSync(`examples/${file}`, 'utf8'));

  it('renders presentation and working styles for the examples', () => {
    mkdirSync('.visual-out', { recursive: true });
    for (const file of ['starter-cottage.dreamhouse.json', 'courtyard-villa.dreamhouse.json']) {
      const doc = load(file);
      for (const level of doc.levels) {
        const working = planSVG(doc, level.id, 'working');
        expect(working).toContain('<svg');
        expect(working).toContain('PLAN'); // title block
        expect(working).toContain('ENCLOSED AREA');
        const presentation = planSVG(doc, level.id, 'presentation');
        expect(presentation).toContain('<svg');
        writeFileSync(`.visual-out/${file.replace('.dreamhouse.json', '')}-${level.name}-working.svg`, working);
      }
      if (doc.facades[0]) {
        const elev = elevationSVG(doc, doc.facades[0].id, 'working');
        expect(elev).toContain('<svg');
        writeFileSync(`.visual-out/${file.replace('.dreamhouse.json', '')}-elevation-working.svg`, elev);
      }
    }
  });
});
