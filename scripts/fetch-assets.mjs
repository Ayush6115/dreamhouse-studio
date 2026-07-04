/**
 * Downloads and organizes all production assets (100% CC0):
 *  - Poly Haven furniture/lighting/plant models (GLTF, 1K textures)
 *  - Poly Haven HDRIs for environment lighting
 *  - ambientCG PBR texture sets (1K JPG)
 *
 * Idempotent: skips anything already present. Re-run any time.
 *   node scripts/fetch-assets.mjs
 */
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODELS_DIR = path.join(ROOT, 'public', 'assets', 'models');
const TEX_DIR = path.join(ROOT, 'public', 'assets', 'textures');
const HDRI_DIR = path.join(ROOT, 'public', 'assets', 'hdri');
const TMP = path.join(ROOT, 'node_modules', '.asset-tmp');

/** Poly Haven model ids to fetch (all CC0). */
const MODELS = [
  'sofa_02',
  'modern_arm_chair_01',
  'modern_coffee_table_01',
  'modern_wooden_cabinet',
  'painted_wooden_shelves',
  'dining_table',
  'gallinera_table',
  'round_wooden_table_01',
  'dining_chair_02',
  'side_table_01',
  'drawer_cabinet',
  'chinese_cabinet',
  'painted_wooden_cabinet',
  'GothicBed_01',
  'modern_ceiling_lamp_01',
  'Chandelier_03',
  'potted_plant_01',
  'potted_plant_02',
  'electric_stove',
  // V3 additions
  'mid_century_lounge_chair',
  'Ottoman_01',
  'Rockingchair_01',
  'GreenChair_01',
  'Television_01',
  'ornate_mirror_01',
  'ceramic_vase_01',
  'brass_vase_01',
  // decorative_book_set_01 ships no GLTF export — skipped.
  'Chandelier_01',
  'bar_chair_round_01',
  'metal_office_desk',
  'painted_wooden_nightstand',
  'painted_wooden_stool',
  // NOTE: Poly Haven's photoscanned trees (island_tree_02, fir_tree_01) are
  // 39–456 MB — far too heavy for the web. Trees stay parametric.
];

/** Poly Haven HDRIs (1k .hdr). */
const HDRIS = ['kloofendal_48d_partly_cloudy_puresky', 'moonless_golf'];

/** ambientCG material ids → local folder names. */
const TEXTURES = {
  'wood-floor': 'WoodFloor051',
  'wood-planks': 'Planks037B',
  marble: 'Marble012',
  granite: 'Granite002A',
  brick: 'Bricks075A',
  concrete: 'Concrete034',
  plaster: 'Plaster001',
  'stone-wall': 'PavingStones070',
  'tiles-ivory': 'Tiles101',
  'tiles-bath': 'Tiles074',
  grass: 'Grass004',
  paving: 'PavingStones128',
  // V3 additions
  'roof-tiles': 'RoofingTiles012A',
  'roof-tiles-dark': 'RoofingTiles013A',
  'wood-floor-dark': 'WoodFloor046',
  travertine: 'Travertine009',
};

const log = (...a) => console.log(...a);

async function fetchOk(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res;
}

async function download(url, dest) {
  if (existsSync(dest)) return false;
  mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetchOk(url);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  return true;
}

// ------------------------------------------------------------------ models
async function fetchModel(id) {
  const dir = path.join(MODELS_DIR, id);
  const gltfPath = path.join(dir, `${id}.gltf`);
  if (existsSync(gltfPath)) {
    log(`  = ${id} (cached)`);
    return;
  }
  const files = await (await fetchOk(`https://api.polyhaven.com/files/${id}`)).json();
  const entry = files.gltf?.['1k'] ?? files.gltf?.['2k'];
  if (!entry) throw new Error(`no 1k/2k gltf for ${id}`);
  const main = entry.gltf ?? entry;
  await download(main.url, gltfPath);
  // The bin + texture list lives INSIDE the gltf file record.
  const include = main.include ?? entry.include ?? {};
  for (const [rel, info] of Object.entries(include)) {
    await download(info.url, path.join(dir, rel));
  }
  if (Object.keys(include).length === 0) throw new Error(`no include files for ${id}`);
  log(`  + ${id} (${Object.keys(include).length + 1} files)`);
}

// ------------------------------------------------------------------ hdris
async function fetchHdri(id) {
  const dest = path.join(HDRI_DIR, `${id}_1k.hdr`);
  if (existsSync(dest)) return log(`  = ${id} (cached)`);
  await download(`https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/${id}_1k.hdr`, dest);
  log(`  + ${id}`);
}

// ---------------------------------------------------------------- textures
function extractZip(zip, dest) {
  if (process.platform === 'win32') {
    execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath "${zip}" -DestinationPath "${dest}" -Force`,
    ]);
  } else {
    mkdirSync(dest, { recursive: true });
    execFileSync('unzip', ['-oq', zip, '-d', dest]);
  }
}

async function fetchTexture(key, acgId) {
  const dir = path.join(TEX_DIR, key);
  if (existsSync(path.join(dir, 'color.jpg'))) return log(`  = ${key} (cached)`);
  const zip = path.join(TMP, `${acgId}.zip`);
  await download(`https://ambientcg.com/get?file=${acgId}_1K-JPG.zip`, zip);
  const raw = path.join(TMP, acgId);
  rmSync(raw, { recursive: true, force: true });
  extractZip(zip, raw);
  mkdirSync(dir, { recursive: true });
  const wanted = { Color: 'color.jpg', NormalGL: 'normal.jpg', Roughness: 'roughness.jpg' };
  for (const f of readdirSync(raw)) {
    for (const [suffix, name] of Object.entries(wanted)) {
      if (f.endsWith(`_${suffix}.jpg`)) renameSync(path.join(raw, f), path.join(dir, name));
    }
  }
  if (!existsSync(path.join(dir, 'color.jpg'))) throw new Error(`no Color map in ${acgId}`);
  log(`  + ${key} (${acgId})`);
}

// -------------------------------------------------------------------- main
mkdirSync(TMP, { recursive: true });
let failures = 0;

log('Models (Poly Haven, CC0):');
for (const id of MODELS) {
  try {
    await fetchModel(id);
  } catch (e) {
    failures++;
    log(`  ! ${id}: ${e.message}`);
  }
}

log('HDRIs (Poly Haven, CC0):');
for (const id of HDRIS) {
  try {
    await fetchHdri(id);
  } catch (e) {
    failures++;
    log(`  ! ${id}: ${e.message}`);
  }
}

log('Textures (ambientCG, CC0):');
for (const [key, acgId] of Object.entries(TEXTURES)) {
  try {
    await fetchTexture(key, acgId);
  } catch (e) {
    failures++;
    log(`  ! ${key}: ${e.message}`);
  }
}

// License note.
await writeFile(
  path.join(ROOT, 'public', 'assets', 'LICENSE.md'),
  `# Bundled assets

All 3D models and HDRIs in \`models/\` and \`hdri/\` are from [Poly Haven](https://polyhaven.com) (CC0).
All PBR textures in \`textures/\` are from [ambientCG](https://ambientcg.com) (CC0).

CC0 1.0 Universal — no attribution required, free for commercial use.
Fetched by \`scripts/fetch-assets.mjs\`.
`,
);

rmSync(TMP, { recursive: true, force: true });
log(failures === 0 ? 'All assets ready.' : `${failures} download(s) failed — re-run to retry.`);
process.exit(failures === 0 ? 0 : 1);
