# Asset Sourcing Guide

How the component library is stocked, and where to get more assets legally.

## How importing works

Drop `.glb` / `.gltf` files (or extracted ZIP contents) into `./assets-inbox/`
— use subfolders to set library categories — then run:

```
node scripts/import-assets.mjs
```

The pipeline dedupes by content hash, normalizes each asset into
`public/assets/models/`, reads the glTF bounding box (auto-detecting mm/cm
exports), infers a clean 2D plan symbol from the filename, and registers the
item in `imported-manifest.json`. The app merges the manifest into the
component library at startup — imported items place, render in 3D, and print
with proper architectural blocks immediately. Other formats (OBJ/FBX/STL/
DWG/SKP) are reported by the scanner; convert them to glTF first (Blender's
free exporter handles all of them).

## Ranked sources

| # | Source | URL | Formats | License | Style / quality | Auto-download | Notes |
|---|--------|-----|---------|---------|-----------------|---------------|-------|
| 1 | **Poly Haven** | polyhaven.com | glTF + PBR textures + HDRI | **CC0** | Photoscanned, high | **Yes — wired into `scripts/fetch-assets.mjs`** | Best legal quality/effort ratio; ~85 furniture models. Modern subset already integrated (Sofa 01/03, ArmChair 01, Coffee Tables, Shelf 01, outdoor set, ceiling fan…). No modern beds/appliances — those are parametric. |
| 2 | **Sketchfab — CC0 collections** | sketchfab.com/tags/cc0 (e.g. the curated CC0 collections by nebulousflynn, plaggy, waldbach) | glTF/GLB | CC0 (filter!) | Mixed → very high | No — downloads require a (free) login | Largest pool of genuinely modern furniture. Filter by *Downloadable + CC0* (or CC-BY if attribution is acceptable). Download ZIPs → drop in `assets-inbox/`. |
| 3 | **BlenderKit / Blendkit free tier** | blendkit.com | .blend (export to glTF) | CC0 + royalty-free tiers | Modern, high | No — account + in-Blender browsing | Strong contemporary interior content; export selections as GLB from Blender, then import. |
| 4 | **Poly Pizza** (Google Poly archive) | poly.pizza | GLB | Mostly CC-BY, some CC0 | Low-poly, clean | API exists but needs a free key | Good for trees/vehicles/props where low-poly is fine. With an API key the fetch script can be extended. |
| 5 | **Khronos glTF-Sample-Assets** | github.com/KhronosGroup/glTF-Sample-Assets | glTF | Various per-model (many CC0/CC-BY) | Reference-grade | Yes (git) | Few furniture pieces; useful for pipeline testing. |
| 6 | **ToxSam / open-source-3D-assets** | github.com/ToxSam/open-source-3D-assets | GLB registry (991+) | CC0 | Stylized/props | Yes (JSON registry) | Metaverse props; occasionally useful decor, mostly not architectural. |
| 7 | **FreeCADS / cad-blocks.net / cadblocksdwg.com / dwgmodels.com** | freecads.com, cad-blocks.net, … | **DWG/DXF 2D blocks** | Free to use (site terms; not open licenses) | Professional 2D | No | Plan symbols only. Our drawings already generate parametric blocks; DXF block import is a possible future add. Check each site's redistribution terms before committing files to the repo. |
| 8 | **Kenney / Quaternius** | kenney.nl, quaternius.com | GLB/OBJ | CC0 | Low-poly stylized | Yes | Excluded by design — cartoon style conflicts with architect-grade output. |
| — | SketchUp 3D Warehouse, BIMobject, GrabCAD, Free3D | — | SKP/RFA/DWG | **Restrictive ToS** | High | **No** | Licenses limit redistribution and automated download; not usable for a committed asset pack. |

## Recommended combination

1. **Poly Haven (automated)** for photoscanned hero pieces — already integrated.
2. **Sketchfab CC0 collections (manual ZIPs → `assets-inbox/`)** for modern
   beds, appliances, and decor gaps.
3. **Parametric components** (built into the app) for everything dimensional —
   kitchen modules, sanitaryware, cars, railings — where exact sizes matter
   more than mesh detail and every size variant must stay crisp in plan.

## License policy

Only CC0 and explicitly redistribution-safe assets are committed to the
repository or fetched by scripts. CC-BY assets may be used locally via
`assets-inbox/` (attribution is then the user's responsibility); the import
pipeline keeps them out of version control.
