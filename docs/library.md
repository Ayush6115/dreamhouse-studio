# Component Library

## Catalogs

Two data-only catalogs describe every placeable component:

- `src/library/catalog.ts` — 40+ interior items across Bedroom, Living, Dining, Study, Kitchen, Bathroom, Lighting, Ceiling & Floor, Decor, and Outdoor categories.
- `src/library/facadeCatalog.ts` — 31 façade components (windows, doors, balconies, cladding, cornices, canopies, porch steps, planters, downpipes, lighting, landscaping).

Each entry declares real-world dimensions (meters), a default material, a 2D symbol key, a parametric 3D model key, and — for production items — a `glb` id.

## Three representations per item

1. **2D symbol** (`features/plan/symbols2d.tsx`, `features/elevation/facadeSymbols.tsx`) — schematic architectural symbols drawn with Konva primitives. Plans intentionally stay symbolic; this matches professional drawing conventions.
2. **Parametric 3D model** (`features/viewer3d/furniture3d.tsx`) — composed primitives sized by the element's dimensions. Always available; serves as the loading and error fallback.
3. **Production 3D model** — CC0 photoscanned GLTF from the asset pack, normalized to the element's dimension box by `GltfModel.tsx`. Items using one show a "3D" badge in the store.

Because all three read the same element data, an item can be resized, recolored, rotated, grouped, or locked identically regardless of which representation renders it.

## Adding a new item

1. Add a catalog entry with honest real-world dimensions.
2. If a suitable CC0 model exists, add its id to `scripts/fetch-assets.mjs` and set `glb` on the entry (plus `glbRotation` if its front does not face local +z).
3. Add or reuse a 2D symbol case and a parametric 3D case for the fallback.
4. Icons for the store grid come from the symbol-to-icon map in `components/layout/LibraryDrawer.tsx`.

Keep placeholder geometry honest: if an item has no production model, the parametric stand-in should read clearly as furniture of that kind, not as a mystery box.

## Materials

`src/library/materials.ts` defines ~30 presets shared by walls, floors, roofs, and items. A preset is a color plus optional PBR texture-set key (`/assets/textures/<key>/{color,normal,roughness}.jpg`) and a `textureScale` in meters per tile. The swatch picker renders texture thumbnails directly from the color maps. Presets tile in real meters in 3D; the element's tint multiplies over the texture.

## Asset pipeline

`scripts/fetch-assets.mjs` reproducibly downloads the whole pack — photoscanned models (Poly Haven, 1K textures), PBR texture sets (ambientCG, 1K), and HDRIs — and writes `public/assets/LICENSE.md`. Everything is CC0. The script is idempotent; re-run it after adding ids. Oversized sources are rejected on principle (photoscanned trees measured 39–456 MB and stay parametric).
