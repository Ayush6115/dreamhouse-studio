# DreamHouse Studio 1.0.0

First public release.

DreamHouse Studio is a client-side home design platform: draw a plot with engineering precision, raise parametric walls, add roofs with dormers and skylights, furnish interiors from a production-quality CC0 component library, compose the street façade, review the automatically generated 3D model, and export vector drawing sheets, a glTF model, and a compiled PDF report. Everything derives from a single, portable design document.

## Highlights

- **Exact geometry throughout** — true miter wall joins, polygon-boolean footprints, and unit-tested roof solids (flat, shed, gable, hip, barrel). An L-join's footprint area equals the exact sum of centerline length × thickness; the test suite pins this down.
- **Automatic wall-to-roof trimming** — walls stop at sloped roofs; tall gable-end walls become pitched gable walls in their own material.
- **Engineering-precise input** — type exact segment lengths in any unit (`36.4ft`, `3500mm`, `11'6"`) while drawing; edit every plot edge from a numbered list; measure anywhere.
- **Real setback workflows** — per-side and per-edge setbacks generate a legal envelope; the buildable footprint is then freely editable with continuous validation (hard errors outside the plot, waivable warnings inside setbacks).
- **Production 3D** — 32 photoscanned CC0 furniture models, PBR materials that tile in real meters, HDRI lighting, ambient occlusion, a north-aware sun-position slider, and day/night modes — with parametric fallbacks so the app works before any asset download.
- **Professional editing** — multi-floor with ghost underlays, grouping, locking, marquee selection, align/distribute, annotations, 60-step undo, and a multi-project manager with thumbnails.
- **Exports that scale** — true-vector SVG plans and elevations (generated from the model, not screenshots), raster quality up to 5×, full-scene `.glb`, and a PDF report with a metrics cover sheet and one page per floor and façade.

## Verification

Released after a 46-test geometry/unit suite and a 28-check end-to-end browser suite covering drawing, calculations, undo, grouping, footprint validation, 3D rendering, and every export path.

## Known limitations

- Compound L/U roofs are built by composing rectangular roof volumes; single-volume polygon roofs are on the roadmap.
- Dormers and skylights are visual insertions on the roof surface; they do not cut light openings through the roof solid.
- The setback inset is exact for convex plots and correct for mildly concave ones; extreme concave cases report "setbacks too large" rather than guessing.
- glTF export requires the 3D view to be open and, on very slow machines with texture-heavy scenes, may need the Fast quality toggle.
- Bathroom fittings, kitchen counters, and a few other items intentionally use parametric geometry — no suitable CC0 production models exist for them.

## Getting started

```bash
npm install
npm run fetch-assets
npm run dev
```

Import a sample from `examples/` to explore a finished design.
