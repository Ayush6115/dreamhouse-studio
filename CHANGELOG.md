# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] — 2026-07-04

First public release. Highlights across the pre-release development line:

### Core (0.1.x)
- Shared parametric data model: one JSON-serializable design document drives the 2D plan, 3D scene, elevations, and all calculations.
- Plot designer: irregular polygons, vertex editing, per-side setbacks classified by road direction, north/road markers, live dimensions.
- Parametric walls with exact miter joins and polygon-union footprints; doors and windows anchored to walls; room tagging with area figures.
- Automatic 2D-to-3D generation (wall slicing without CSG), orbitable camera, day/night lighting.
- Interior library and façade composer with parametric placeholder geometry.
- Exports: true-vector SVG plans and elevations, PNG, 3D snapshots, compiled PDF report.

### Production quality (0.2.x)
- CC0 asset pipeline: photoscanned furniture (Poly Haven), PBR texture sets (ambientCG), HDRI environment lighting; reproducible fetch script.
- GLB models normalized to parametric element boxes with automatic fallbacks.
- Component stores with search, favorites, and recents; multi-project manager with thumbnails; alignment guides and collision awareness; context menus.

### Roofs and floors (0.3.x)
- Roof designer: flat (with parapets), shed, gable, and hip styles; pitch, overhang, and skylights; tested geometry core.
- Multi-floor workflows: basement and floor presets, floor switcher, ghost underlay, floor-height staircases.
- Measure tool, sun-position slider, glTF (.glb) scene export, arrow-key nudge, material swatch picker.

### Advanced editing (0.4.x)
- Automatic wall-to-roof trimming (tall gable-end walls become pitched gable walls), merged single-mesh walls.
- Barrel vaults and dormers; richer door/window styles with configurable mullions.
- Marquee selection, grouping, locking, align/distribute; N8AO ambient occlusion, SMAA, quality toggle.

### Precision and setbacks (0.5.x)
- Typed exact-length input while drawing, with unit parsing and direction locking; right-click point control; editable plot edge list.
- Per-edge setback overrides and a hand-editable buildable footprint with continuous legal validation (hard errors outside the plot, acceptable warnings inside setbacks).
- Export quality selector (1× to 5×); free text annotations; dimension labels always placed outside dimension lines; hover-highlighted vertex handles.

[1.0.0]: https://example.com/releases/1.0.0
