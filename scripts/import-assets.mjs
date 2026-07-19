/**
 * Asset import pipeline.
 *
 * Drop downloaded model files (or extracted ZIP contents) anywhere inside
 * ./assets-inbox — organized into subfolders if you want those names used
 * as library categories — then run:
 *
 *   node scripts/import-assets.mjs
 *
 * The pipeline:
 *  - scans the inbox recursively for .glb / .gltf models (other formats are
 *    reported, not imported — convert to glTF first, e.g. with Blender);
 *  - skips duplicates by content hash;
 *  - normalizes each asset into public/assets/models/<id>/;
 *  - reads the glTF bounding box and infers real-world size (auto-detecting
 *    mm/cm exports and converting to meters);
 *  - infers a plan symbol from the filename (sofa/bed/chair/…), so every
 *    import gets a clean architectural block in 2D and its mesh in 3D;
 *  - writes public/assets/models/imported-manifest.json, which the app
 *    loads at startup to add the items to the component library.
 *
 * Re-run any time; it is idempotent.
 */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const INBOX = path.join(ROOT, 'assets-inbox');
const MODELS_DIR = path.join(ROOT, 'public', 'assets', 'models');
const MANIFEST = path.join(MODELS_DIR, 'imported-manifest.json');

if (!existsSync(INBOX)) {
  mkdirSync(INBOX, { recursive: true });
  console.log(`Created ${path.relative(ROOT, INBOX)} — drop .glb/.gltf assets there and re-run.`);
  process.exit(0);
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : { items: [], hashes: {} };

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\.(glb|gltf)$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'asset';

/** Plan-symbol heuristics from the filename. */
function guessSymbol(name) {
  const n = name.toLowerCase();
  const rules = [
    [/sofa|couch|sectional|loveseat/, 'sofa'],
    [/bunk/, 'bunk'],
    [/bed/, 'bed'],
    [/office.?chair|desk.?chair|swivel/, 'office-chair'],
    [/chair|stool|seat/, 'chair'],
    [/wardrobe|closet|cupboard|armoire/, 'wardrobe'],
    [/shelf|book|rack/, 'bookshelf'],
    [/round.*table|table.*round/, 'table-round'],
    [/table|desk|console/, 'table-rect'],
    [/toilet|\bwc\b|commode/, 'toilet'],
    [/basin|sink/, 'washbasin'],
    [/vanity/, 'vanity'],
    [/bath|tub/, 'bathtub'],
    [/shower/, 'shower'],
    [/fridge|refrigerator/, 'fridge'],
    [/oven|microwave|dishwasher|washer|appliance/, 'appliance'],
    [/hood|chimney/, 'hood'],
    [/\btv\b|television|screen|monitor/, 'tv-flat'],
    [/plant|tree|palm|ficus/, 'plant'],
    [/rug|carpet/, 'rug'],
    [/lamp|light|pendant|chandelier/, 'lamp-ceiling'],
    [/car|sedan|suv|vehicle/, 'car'],
    [/bike|bicycle|cycle/, 'bike'],
    [/pergola|gazebo/, 'pergola'],
  ];
  for (const [re, sym] of rules) if (re.test(n)) return sym;
  return 'box';
}

/** Approximate bounding box from glTF accessor min/max (POSITION). */
function gltfBounds(file) {
  let json;
  const buf = readFileSync(file);
  if (file.toLowerCase().endsWith('.glb')) {
    // GLB container: 12-byte header, then chunks; first chunk is JSON.
    if (buf.readUInt32LE(0) !== 0x46546c67) return null;
    const jsonLen = buf.readUInt32LE(12);
    json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  } else {
    json = JSON.parse(buf.toString('utf8'));
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const acc = json.accessors?.[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let i = 0; i < 3; i++) {
        min[i] = Math.min(min[i], acc.min[i]);
        max[i] = Math.max(max[i], acc.max[i]);
      }
    }
  }
  if (!Number.isFinite(min[0])) return null;
  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2] };
}

/** Convert a raw size to meters, auto-detecting mm/cm exports. */
function toMeters(v) {
  if (v > 100) return v / 1000; // millimetres
  if (v > 12) return v / 100; // centimetres
  return v;
}

const found = [];
const unsupported = [];
(function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) scan(p);
    else if (/\.(glb|gltf)$/i.test(entry)) found.push(p);
    else if (/\.(obj|fbx|stl|dae|dxf|dwg|skp|3ds|blend)$/i.test(entry)) unsupported.push(p);
  }
})(INBOX);

let added = 0;
let skipped = 0;
for (const file of found) {
  const hash = createHash('sha1').update(readFileSync(file)).digest('hex');
  if (manifest.hashes[hash]) {
    skipped++;
    continue;
  }
  const base = slug(path.basename(file));
  let id = `imp-${base}`;
  let k = 2;
  while (manifest.items.some((i) => i.id === id) || existsSync(path.join(MODELS_DIR, id))) id = `imp-${base}-${k++}`;

  const ext = path.extname(file).toLowerCase();
  if (ext === '.gltf') {
    // a .gltf references sidecar buffers/textures — they must be present
    const json = JSON.parse(readFileSync(file, 'utf8'));
    const missing = (json.buffers ?? [])
      .map((b) => b.uri)
      .filter((u) => u && !u.startsWith('data:') && !existsSync(path.join(path.dirname(file), u)));
    if (missing.length) {
      console.warn(`! ${path.relative(INBOX, file)} skipped — missing sidecar file(s): ${missing.join(', ')} (copy the whole extracted folder, or use .glb)`);
      continue;
    }
  }
  const destDir = path.join(MODELS_DIR, id);
  mkdirSync(destDir, { recursive: true });
  if (ext === '.gltf') {
    // copy the whole folder (textures/.bin live beside the .gltf)
    cpSync(path.dirname(file), destDir, { recursive: true });
    cpSync(file, path.join(destDir, `${id}.gltf`));
  } else {
    cpSync(file, path.join(destDir, `${id}.glb`));
  }

  const b = gltfBounds(file);
  const width = b ? Math.max(0.2, Math.round(toMeters(b.x) * 100) / 100) : 1;
  const height = b ? Math.max(0.1, Math.round(toMeters(b.y) * 100) / 100) : 1;
  const depth = b ? Math.max(0.2, Math.round(toMeters(b.z) * 100) / 100) : 1;

  // Category = first inbox subfolder, else "Imported".
  const rel = path.relative(INBOX, file);
  const parts = rel.split(path.sep);
  const category = parts.length > 1 ? parts[0] : 'Imported';

  const name = path
    .basename(file)
    .replace(/\.(glb|gltf)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  manifest.items.push({
    id,
    name,
    category,
    width,
    depth,
    height,
    symbol: guessSymbol(name),
    glb: `${id}/${id}${ext === '.gltf' ? '.gltf' : '.glb'}`,
  });
  manifest.hashes[hash] = id;
  added++;
  console.log(`+ ${name}  (${width}×${depth}×${height} m, ${category})`);
}

writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
console.log(`\nImported ${added} new asset(s), skipped ${skipped} duplicate(s). Library manifest updated.`);
if (unsupported.length) {
  console.log(`\n${unsupported.length} file(s) in unsupported formats (convert to glTF/GLB first, e.g. in Blender):`);
  for (const f of unsupported.slice(0, 12)) console.log('  -', path.relative(INBOX, f));
}
