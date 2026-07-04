// One-off visual check: seeds a doc with GLB furniture in the open (no walls)
// and screenshots the 3D view up close. Usage: node scripts/glb-check.mjs <outDir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? '.');
mkdirSync(OUT, { recursive: true });

let n = 0;
const id = () => `g-${++n}`;
const furn = (catalogId, x, y, w, d, h, rot = 0) => ({
  id: id(), type: 'furniture', name: catalogId, catalogId,
  transform: { position: { x, y, z: 0 }, rotation: rot, scale: { x: 1, y: 1, z: 1 } },
  dimensions: { width: w, height: h, depth: d },
  material: { id: 'fabric-linen', name: 'x', color: '#cfc4ae', finish: 'matte', roughness: 0.9, metalness: 0 },
  meta: {},
});

const doc = {
  id: 'glb-check', name: 'GLB Check', version: 1, unitSystem: 'metric',
  plot: { boundary: [], northAngle: 0, roadDirection: 180, setbacks: { front: 1, rear: 1, left: 1, right: 1 } },
  levels: [{
    id: 'lvl', name: 'G', elevation: 0, height: 3,
    elements: [
      furn('sofa-3', 0, 0, 2.1, 0.95, 0.8),
      furn('armchair', 2.4, 0, 0.85, 0.85, 0.8),
      furn('coffee-table', 0, 1.6, 1.1, 0.6, 0.42),
      furn('bed-king', 4.5, 1.5, 1.8, 2.1, 1.2),
      furn('dining-6', -3, 1.5, 1.9, 1.0, 0.76),
      furn('chair', -3, 0.3, 0.48, 0.52, 0.9),
      furn('wardrobe-3', 7, 1, 1.8, 0.6, 2.2),
      furn('bookshelf', -5.2, 1.5, 0.9, 0.35, 1.8),
      furn('plant-large', 2.4, 1.6, 0.6, 0.6, 1.4),
      furn('stove', -5.2, 0, 0.75, 0.65, 0.95),
      furn('tree-leafy', -8, 3, 3.2, 3.2, 4.5),
      furn('tree-fir', 9.5, 3.5, 2.4, 2.4, 5.5),
    ],
  }],
  facades: [{ id: 'f', name: 'Front', width: 12, height: 7, backdropColor: '#e8e2d8', elements: [] }],
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript((d) => {
  localStorage.setItem('dreamhouse:projects:v1', JSON.stringify([{ id: d.id, name: d.name, updatedAt: Date.now() }]));
  localStorage.setItem('dreamhouse:project:' + d.id, JSON.stringify(d));
}, doc);
await page.goto('http://localhost:5199', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.keyboard.press('2');
await page.waitForTimeout(9000);
await page.screenshot({ path: path.join(OUT, 'glb-lineup.png') });
console.log('errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
