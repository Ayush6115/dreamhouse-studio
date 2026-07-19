# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Modern component library: contemporary CC0 pieces from Poly Haven (Sofa 01/03, ArmChair 01, coffee tables, shelving, outdoor set, ceiling fan) replace the dated models; beds, wardrobes, kitchen modules, appliances (oven, dishwasher, microwave, chimney hood), vanity, office chair, bunk bed, wall TV, cars (sedan/SUV/hatchback), bicycle, pergola, and steel/wood railings are clean parametric designs. Folding (bi-fold) door family in 2D, 3D and DXF.
- Component-store thumbnails are now the item's actual architectural plan block, generated from the shared symbol library.
- Asset import pipeline (`scripts/import-assets.mjs`): drop `.glb`/`.gltf` files in `assets-inbox/`, and they are deduplicated, size-normalized (mm/cm auto-detected), given a plan symbol by name heuristics, categorized by folder, and merged into the library at startup.
- Asset sourcing guide (`docs/asset-sources.md`) ranking legally-usable repositories and the recommended combination.
- 3D floor plan (dollhouse) mode: one click slices the active level's walls at 1.15 m, clips the joinery, hides roofs, and frames the model on a studio backdrop with a soft shadow — the classic cutaway floor-plan render, compatible with the photoreal path tracer.
- Premium presentation plans: soft drop shadows under walls and furniture, plank/tile/paving floor linework clipped per room, material-tinted furniture, fitted room labels drawn above furnishings, and clean outer dimension chains instead of per-wall labels inside the plan.
- Level trims are now true bands (plinth and slab fascia no longer cap room floors in 3D).
- Example documents are saved with versioned snapshots alongside the canonical file.
- Stair engine (`engine/stair.ts`): risers, going, flights, landings, slope and 2R+G are solved from the envelope and floor-to-floor height, validated against configurable residential rules, with dogleg (U) and straight layouts generated consistently in plan (canvas + sheets + DXF), and 3D. The staircase panel shows the live engineering readout with an Auto riser solver.
- Door/window marks (D1…, W1…) as plan bubbles tied to generated door, window and room schedules on a dedicated PDF sheet; sheets carry drawing numbers.
- DXF (R12) floor-plan export in millimeters with a professional layer set; walls are boolean-cut at openings and all symbols flatten from the shared parametric blocks.
- Smart setback annotations: perpendicular clearances between plot boundary and buildable footprint, adaptive per edge (one label when constant, start/end/change stations plus a VARIES note when not), with collision-aware label placement — on the canvas and the working sheets.
- Shared CAD symbol block library (`library/symbolBlocks.ts`) rendered identically by the plan canvas, SVG sheets and DXF.
- Metric working drawings now dimension in millimeters per drafting convention.
- CAD-style interaction: placing a library component returns to the Select tool (hold Shift to place copies), Esc always exits to Select, and reference geometry (plot, setback outlines, buildable fill) no longer intercepts clicks while drawing.
- Construction-grade working drawings: a pen-weight hierarchy, grey wall poché with black column markers, dimension chains with extension lines and slash ticks, sanitary/kitchen fixture linework, tile hatching in wet areas, a car symbol in parking bays, numbered stair runs with break lines, property-line linetypes, a graphic scale bar, and enclosed-area statements that exclude open areas (`features/export/workingDrawing.ts`).
- Model-projected working elevations: stacked floor outlines, parapet or pitched-roof silhouettes, openings with frames, sills and chajjas, a ground line with earth hatch, GL/FFL/ROOF/PARAPET level datums, and width/height dimension chains — generated from the plan model, with the composed facade as fallback.
- First-person walkthrough in the 3D view: pointer-lock look with WASD movement at eye height, run, and rise/descend keys; element picking and editor hotkeys pause while touring.
- 3D construction detail: chajjas and sills over openings, architrave door frames with paneled leaves and handles, physically-based reflective glazing, plinth courses, floor-slab fascia bands, and parapet coping.
- Two-storey Urban Residence example with an open terrace, matching its 16-riser staircase.
- Working-drawing export style: monochrome plan sheets with hierarchical dimension chains (opening jambs, wall lines, overall) on all four sides, solid column markers at wall junctions, room name + width × depth labels, stair UP arrows, hatched casework, a north arrow, a sheet frame, and a title block with the enclosed-area statement. Elevations get a matching monochrome style. Selectable per export (SVG/PNG/PDF) from the export menu.
- Photoreal rendering: an in-viewport progressive GPU path tracer with draft/standard/fine sample targets, live progress, stop-early, and PNG download. First render on a device compiles the shader (up to a couple of minutes); later renders start quickly.
- Facade kit category: glass railings, wood slat screens, cove strip lights, and planters. Strip lights glow and cast light in evening and night modes.
- Evening scene mode: the day/night toggle now cycles day → evening → night; evening uses a low warm sun with lamps lit.
- Plan canvas room labels now show width × depth alongside the area.
- Matte dark fascia material for modern slab edges and parapet bands.

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

[1.0.0]: https://github.com/Ayush6115/dreamhouse-studio/releases/tag/v1.0.0
