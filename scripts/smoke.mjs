import { chromium } from 'playwright';
import fs, { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? '.');
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:5199';

// ---------------------------------------------------------------- demo doc
let n = 0;
const id = () => `demo-${++n}`;
const mat = (color, name = 'Test', matId = 'plaster-white', texture, textureScale) => ({
  id: matId, name, color, finish: 'matte', roughness: 0.9, metalness: 0, texture, textureScale,
});
const tf = (x = 0, y = 0, z = 0, rot = 0) => ({
  position: { x, y, z }, rotation: rot, scale: { x: 1, y: 1, z: 1 },
});
const wall = (sx, sy, ex, ey, th = 0.23) => ({
  id: id(), type: 'wall', name: 'Wall',
  start: { x: sx, y: sy }, end: { x: ex, y: ey },
  transform: tf((sx + ex) / 2, (sy + ey) / 2, 0, Math.atan2(ey - sy, ex - sx)),
  dimensions: { width: Math.hypot(ex - sx, ey - sy), height: 3, depth: th, thickness: th },
  material: mat('#ece8df', 'Plaster · White', 'plaster-white', 'plaster', 2.5),
});
const walls = [
  wall(1, 1, 9, 1), wall(9, 1, 9, 7), wall(9, 7, 1, 7), wall(1, 7, 1, 1), wall(5, 1, 5, 7, 0.115),
];
// Tall gable-end walls — must auto-trim to the roof slope (V4).
walls[1].dimensions.height = 5.6;
walls[3].dimensions.height = 5.6;
const opening = (type, wallId, offset, w, h, sill) => ({
  id: id(), type, name: type, wallId, offset, sillHeight: sill, style: type === 'door' ? 'single' : 'sliding',
  swing: 1, transform: tf(), dimensions: { width: w, height: h, depth: 0.05 },
  material: mat(type === 'door' ? '#9a6b43' : '#aac9dd', type, type === 'door' ? 'wood-teak' : 'glass'),
});
const room = (boundary, roomType, name, color, matId, texture, scale) => ({
  id: id(), type: 'room', name, roomType, boundary,
  transform: tf(), dimensions: { width: 0, height: 0, depth: 0 },
  material: mat(color, name, matId, texture, scale),
});
const furn = (catalogId, name, x, y, w, d, h, color, rot = 0) => ({
  id: id(), type: 'furniture', name, catalogId,
  transform: tf(x, y, 0, rot), dimensions: { width: w, height: h, depth: d }, material: mat(color), meta: {},
});
const fac = (catalogId, name, x, z, w, h, color) => ({
  id: id(), type: 'facade-element', name, catalogId,
  transform: tf(x, 0, z), dimensions: { width: w, height: h, depth: 0.1 }, material: mat(color),
});

const doc = {
  id: 'demo-house', name: 'Demo House', version: 1, unitSystem: 'metric',
  plot: {
    boundary: [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 12, y: 9 }, { x: 0, y: 9 }],
    northAngle: 0, roadDirection: 180,
    setbacks: { front: 1.5, rear: 1, left: 0.8, right: 0.8 },
  },
  levels: [{
    id: 'lvl-0', name: 'Ground Floor', elevation: 0, height: 3,
    elements: [
      ...walls,
      opening('door', walls[2].id, 2.0, 0.9, 2.1, 0),
      opening('window', walls[0].id, 2.0, 1.2, 1.2, 0.9),
      opening('window', walls[0].id, 6.0, 1.2, 1.2, 0.9),
      opening('door', walls[4].id, 3.0, 0.8, 2.1, 0),
      room([{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 7 }, { x: 1, y: 7 }], 'living', 'Living Room', '#ffffff', 'wood-floor', 'wood-floor', 1.8),
      room([{ x: 5, y: 1 }, { x: 9, y: 1 }, { x: 9, y: 7 }, { x: 5, y: 7 }], 'bedroom', 'Bedroom', '#ffffff', 'tile-ivory', 'tiles-ivory', 1.2),
      furn('bed-king', 'King Bed', 7, 2.6, 1.8, 2.1, 1.2, '#cfc4ae'),
      furn('sofa-3', 'Sofa', 3, 5.6, 2.1, 0.95, 0.8, '#4a4d52', Math.PI),
      furn('coffee-table', 'Coffee Table', 3, 4.2, 1.1, 0.6, 0.42, '#7a563d'),
      furn('armchair', 'Armchair', 1.8, 4.2, 0.85, 0.85, 0.8, '#a5714b', Math.PI / 2),
      furn('plant-large', 'Plant', 1.7, 1.7, 0.6, 0.6, 1.4, '#7fae6b'),
      furn('lamp-floor', 'Floor Lamp', 4.4, 1.6, 0.4, 0.4, 1.6, '#9aa1a8'),
      furn('tree-leafy', 'Tree', 10.8, 7.8, 3.2, 3.2, 4.5, '#7fae6b'),
      {
        id: id(), type: 'roof', name: 'Roof', roofStyle: 'gable', pitch: 30, overhang: 0.45,
        parapetHeight: 0, skylights: [{ x: -1.5, y: -1.2, width: 0.8, depth: 1.0 }],
        dormers: [{ x: 1.2, y: 1.7, width: 1.3, height: 1.4 }],
        transform: tf(5, 4, 3), dimensions: { width: 8.3, height: 0, depth: 6.3, thickness: 0.15 },
        material: mat('#ffffff', 'Roof · Clay Tiles', 'roof-tiles', 'roof-tiles', 1.5),
      },
    ],
  }, {
    id: 'lvl-1', name: 'First Floor', elevation: 3, height: 3, elements: [],
  }],
  facades: [{
    id: 'fac-0', name: 'Front Elevation', width: 12, height: 7, backdropColor: '#e8e2d8',
    elements: [
      fac('fd-main', 'Main Door', 2, 1.05, 1.0, 2.1, '#9a6b43'),
      fac('fw-4pane', 'Window', 5.5, 1.5, 1.2, 1.2, '#aac9dd'),
      fac('fw-arch', 'Arch Window', 8.5, 1.65, 1.0, 1.5, '#aac9dd'),
      fac('fs-pergola', 'Pergola', 3, 2.9, 2.5, 0.4, '#9a6b43'),
      fac('fl-tree', 'Tree', 11, 1.75, 1.8, 3.5, '#7fae6b'),
    ],
  }],
};

// ---------------------------------------------------------------- test run
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

// Headed: headless Chromium's canvas-encode queue deadlocks GLTFExporter on
// texture-heavy scenes (verified — real browsers are unaffected).
const browser = await chromium.launch({ headless: false });
const page = await browser.newPage({ viewport: { width: 1560, height: 940 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
  if (msg.text().includes('[export]')) console.log('   >>', msg.text().slice(0, 200));
});

// Seed via the LEGACY key — also exercises the V1 → V2 migration.
await page.addInitScript((d) => {
  localStorage.setItem('dreamhouse-studio:doc:v1', JSON.stringify(d));
}, doc);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);

// 1. App shell + seeded doc rendered (via migration)
ok('app loads', await page.locator('header').count() === 1);
const footer = () => page.locator('footer').innerText();
const f = await footer();
ok('legacy project migrated + metrics', /Plot\s*108\.00 m²/.test(f.replace(/\n/g, ' ')), f.split('\n').join(' | ').slice(0, 140));
ok('carpet area metric', /Carpet\s*48\.00 m²/.test(f.replace(/\n/g, ' ')));
await page.screenshot({ path: path.join(OUT, 'v2-1-plan.png') });

// 2. Component store: search + favorites
await page.keyboard.press('f');
await page.waitForTimeout(400);
ok('store opens', await page.getByPlaceholder(/Search/).count() === 1);
await page.getByPlaceholder(/Search/).fill('sofa');
await page.waitForTimeout(250);
const sofaHits = await page.locator('text=Sofa ·').count();
ok('store search filters', sofaHits >= 2, `${sofaHits} sofa items`);
await page.screenshot({ path: path.join(OUT, 'v2-2-store.png') });
await page.getByPlaceholder(/Search/).fill('');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 3. Context menu: right-click the sofa (world 3,5.6)
let canvasBox = await page.locator('main canvas').first().boundingBox();
const world = (wx, wy) => ({ x: canvasBox.x + 120 + wx * 50, y: canvasBox.y + 120 + wy * 50 });
const sofaP = world(3, 5.6);
await page.mouse.click(sofaP.x, sofaP.y, { button: 'right' });
await page.waitForTimeout(300);
ok('context menu opens', await page.locator('[data-context-menu]').count() === 1);
await page.locator('[data-context-menu] >> text=Duplicate').click();
await page.waitForTimeout(300);
ok('duplicate creates element', await page.locator('aside').innerText().then((t) => /furniture/i.test(t)));
await page.keyboard.press('Control+z');
await page.waitForTimeout(200);
await page.keyboard.press('Escape');

// 3b. Multi-floor: level switcher visible with 2 floors
ok('level switcher shows', (await page.locator('header select').count()) === 1);

// 3c. Grouping: select sofa + coffee table, Ctrl+G, reselect → both selected
await page.mouse.click(world(3, 5.6).x, world(3, 5.6).y);
await page.waitForTimeout(150);
await page.keyboard.down('Shift');
await page.mouse.click(world(3, 4.2).x, world(3, 4.2).y);
await page.keyboard.up('Shift');
await page.waitForTimeout(150);
await page.keyboard.press('Control+g');
await page.waitForTimeout(200);
await page.mouse.click(world(11.5, 0.4).x, world(11.5, 0.4).y); // empty corner — deselect
await page.waitForTimeout(150);
await page.mouse.click(world(3, 5.6).x, world(3, 5.6).y); // click one member
await page.waitForTimeout(250);
ok('group selects as one', await page.locator('aside').innerText().then((t) => /2 elements selected/i.test(t)));
await page.keyboard.press('Control+Shift+G');
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// 3d. Precise drawing: draw a wall with a typed, locked length of 2.5 m
await page.keyboard.press('w'); // closes the library drawer → canvas resizes
await page.waitForTimeout(300);
canvasBox = await page.locator('main canvas').first().boundingBox();
const a0 = world(1, 8.3);
await page.mouse.click(a0.x, a0.y); // anchor
await page.waitForTimeout(150);
await page.keyboard.press('2');
await page.waitForTimeout(200);
ok('length input opens on typing', (await page.locator('input[value="2"]').count()) === 1);
await page.keyboard.type('.5');
await page.keyboard.press('Enter'); // lock 2.5 m
await page.waitForTimeout(200);
const aim = world(8, 8.35); // roughly east — lock fixes the distance
await page.mouse.move(aim.x, aim.y);
await page.waitForTimeout(150);
await page.mouse.click(aim.x, aim.y);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
let fw = (await footer()).replace(/\n/g, ' ');
ok('locked length places exact wall (34 + 2.5 m)', /Walls\s*36\.50 m/.test(fw), fw.slice(0, 120));
await page.keyboard.press('Control+z');
await page.waitForTimeout(250);

// 3e. Right-click cancels the pending anchor without side effects
await page.keyboard.press('w');
await page.mouse.click(a0.x, a0.y);
await page.waitForTimeout(150);
await page.mouse.click(world(4, 8.3).x, world(4, 8.3).y, { button: 'right' });
await page.waitForTimeout(150);
await page.mouse.click(world(6, 8.3).x, world(6, 8.3).y); // would be a wall if anchor survived… should just re-anchor
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
fw = (await footer()).replace(/\n/g, ' ');
ok('right-click cancels pending point', /Walls\s*34\.00 m/.test(fw), fw.slice(0, 120));
await page.keyboard.press('Escape');

// 3f. Plot edge panel: select the plot boundary → editable edge list
await page.mouse.click(world(0, 4.5).x, world(0, 4.5).y);
await page.waitForTimeout(300);
ok('plot edge panel lists edges', await page.locator('aside').innerText().then((t) => /edges \(4\)/i.test(t)));
await page.screenshot({ path: path.join(OUT, 'v5-plot-edit.png') });

// 3g. Customizable buildable footprint + validation
await page.getByRole('button', { name: /Customize buildable footprint/i }).click();
await page.waitForTimeout(400);
const asideText = await page.locator('aside').innerText();
ok('buildable footprint edit mode', /buildable footprint/i.test(asideText));
ok('footprint validates clean', /respects all setbacks/i.test(asideText));

// Drag the NW footprint vertex (0.8, 1) → (2, 2): must stay selected and
// the area must change 67.60 → 58.50 m² (snapped to the 0.5 m grid).
const nw = world(0.8, 1);
await page.mouse.move(nw.x, nw.y);
await page.mouse.down();
await page.mouse.move(world(2, 2).x, world(2, 2).y, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(350);
const afterDrag = await page.locator('aside').innerText();
ok('footprint vertex drags without losing selection', /buildable footprint/i.test(afterDrag));
ok('footprint area updates from drag', /58\.50 m²/.test(afterDrag), afterDrag.replace(/\n/g, ' ').slice(0, 90));

// Drag that vertex INTO the setback strip → amber warning → Accept → normal.
await page.mouse.move(world(2, 2).x, world(2, 2).y);
await page.mouse.down();
await page.mouse.move(world(0.5, 0.5).x, world(0.5, 0.5).y, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(350);
ok('setback intrusion warns', (await page.getByRole('button', { name: /Accept intrusion/i }).count()) === 1);
await page.getByRole('button', { name: /Accept intrusion/i }).click();
await page.waitForTimeout(250);
const afterAccept = await page.locator('aside').innerText();
ok('accepted intrusion shows as normal', /intrusion accepted/i.test(afterAccept) && !/check your local regulations/i.test(afterAccept));
await page.screenshot({ path: path.join(OUT, 'v6-buildable.png') });
await page.getByRole('button', { name: /Reset to auto/i }).click();
await page.waitForTimeout(250);
await page.keyboard.press('Escape');
await page.waitForTimeout(150);

// 3h. Text note: press T, click, edit in panel
await page.keyboard.press('t');
await page.waitForTimeout(150);
await page.mouse.click(world(10.5, 8.5).x, world(10.5, 8.5).y);
await page.waitForTimeout(300);
ok('text note places + panel opens', await page.locator('aside').innerText().then((tx) => /text note/i.test(tx)));
await page.locator('aside textarea').fill('Main Entrance');
await page.locator('aside textarea').press('Enter'); // commit
await page.waitForTimeout(250);
await page.mouse.click(world(11.5, 0.4).x, world(11.5, 0.4).y); // deselect
await page.waitForTimeout(200);
// remove the note so later metrics/screens stay canonical
await page.mouse.click(world(10.5, 8.5).x, world(10.5, 8.5).y);
await page.waitForTimeout(150);
await page.keyboard.press('Escape'); // leave the auto-focused textarea
await page.keyboard.press('Delete');
await page.waitForTimeout(200);

// 4. 3D view with GLB models + textures (allow time for assets)
await page.keyboard.press('2');
await page.waitForTimeout(7000);
ok('3d canvas mounts', (await page.locator('main canvas').count()) >= 1);
ok('sun slider shows in day mode', (await page.locator('header input[type=range]').count()) === 1);
await page.screenshot({ path: path.join(OUT, 'v2-3-3d-day.png') });

// 4b. GLB export from the live scene. Headless SwiftShader renders AO frames
// so slowly they starve the exporter's canvas callbacks — switch to Fast
// quality first (the in-app guidance for weak GPUs).
await page.getByRole('button', { name: /Quality: High/ }).click();
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Export' }).click();
const dlGlb = page.waitForEvent('download', { timeout: 120000 });
await page.getByRole('button', { name: /3D model · GLB/ }).click();
const dglb = await dlGlb;
ok('GLB model exports', (await dglb.path()) !== null, dglb.suggestedFilename());
await page.getByRole('button', { name: /Quality: Fast/ }).click();
ok('photoreal render button shows', (await page.getByRole('button', { name: /Photoreal/i }).count()) >= 1);
await page.getByRole('button', { name: /Day — click for evening/ }).click();
await page.waitForTimeout(1500);
ok('evening mode engages', (await page.getByRole('button', { name: /Evening — click for night/ }).count()) >= 1);
await page.screenshot({ path: path.join(OUT, 'v2-4b-3d-evening.png') });
await page.getByRole('button', { name: /Evening — click for night/ }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, 'v2-4-3d-night.png') });
await page.getByRole('button', { name: /Night — click for day/ }).click();
await page.waitForTimeout(500);

// 5. Projects dialog
await page.keyboard.press('1');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Projects' }).click();
await page.waitForTimeout(400);
ok('projects dialog opens', await page.locator('text=New project').count() >= 1);
ok('project listed', await page.locator('text=Demo House').count() >= 1);
await page.screenshot({ path: path.join(OUT, 'v2-5-projects.png') });
await page.keyboard.press('Escape');
await page.waitForTimeout(200);

// 6. Elevation + exports still work
await page.keyboard.press('3');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT, 'v2-6-elevation.png') });
await page.keyboard.press('1');
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Export' }).click();
await page.waitForTimeout(200);
ok('export quality selector shows', (await page.locator('text=Quality').count()) >= 1);
ok('export style selector shows', (await page.getByRole('button', { name: 'Working dwg' }).count()) >= 1);
await page.getByRole('button', { name: 'Working dwg' }).click();
await page.waitForTimeout(150);
const dlWorking = page.waitForEvent('download', { timeout: 30000 });
await page.getByRole('button', { name: /Floor plan · SVG/ }).click();
const dw = await dlWorking;
ok('working-drawing SVG exports', (await dw.path()) !== null, dw.suggestedFilename());
const workingSvg = fs.readFileSync(await dw.path(), 'utf8');
ok('working drawing has title block + chains', workingSvg.includes('ENCLOSED AREA') && workingSvg.includes('PLAN'));
await page.getByRole('button', { name: 'Export' }).click();
await page.waitForTimeout(200);
const dlDxf = page.waitForEvent('download', { timeout: 30000 });
await page.getByRole('button', { name: /Floor plan · DXF/ }).click();
const dd = await dlDxf;
ok('DXF exports', (await dd.path()) !== null, dd.suggestedFilename());
const dxfText = fs.readFileSync(await dd.path(), 'utf8');
ok('DXF has layers + entities', dxfText.includes('WALLS') && dxfText.includes('ENTITIES') && dxfText.trim().endsWith('EOF'));
await page.getByRole('button', { name: 'Export' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'ultra', exact: true }).click();
await page.waitForTimeout(150);
const dl = page.waitForEvent('download', { timeout: 90000 });
await page.getByRole('button', { name: /PDF report/ }).click();
const d = await dl;
ok('PDF report downloads', (await d.path()) !== null, d.suggestedFilename());
await d.saveAs(path.join(OUT, d.suggestedFilename()));

// 7. Console errors
const realErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('DevTools'));
ok('no console errors', realErrors.length === 0, realErrors.slice(0, 3).join(' || ').slice(0, 300));

await browser.close();
const failed = results.filter((r) => !r.pass).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed > 0 ? 1 : 0);
