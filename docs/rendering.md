# Rendering Pipeline

## 2D drafting canvas

The plan view (`features/plan/PlanCanvas.tsx`) is a Konva stage whose transform *is* the viewport: `scaleX/Y` = pixels per meter, `x/y` = pan offset. All shapes are therefore drawn in meter coordinates. Hairlines use `strokeScaleEnabled={false}` so line weights stay crisp at every zoom; text sizes divide by the viewport scale for the same reason.

Layer order (bottom to top) doubles as hit-testing priority: grid → plot/setbacks → ghost underlay → rooms → items → walls → openings → roofs → **buildable footprint editor** → tool overlay. The footprint editor is topmost deliberately, so its vertex handles always win over rooms or furniture beneath them.

Walls render as one filled union shape (even-odd fill over all rings from `wallsUnionOutlines`), which is what makes corners and junctions read as continuous poché. Hit-testing uses invisible per-wall centerline strokes instead, so selection is per-wall even though the fill is unified.

The tool system (`tools.tsx`) is a single hook: the canvas feeds it pointer events in world meters; it owns draft state, snapping context, drag state machines, typed-length locking, and returns a Konva overlay plus an HTML HUD.

## 3D scene

The 3D view (`features/viewer3d/Scene3D.tsx`) regenerates from the document on every change.

**Walls.** Each wall's mitered plan outline is sliced along its axis into pieces — full-height between openings, lintels above doors/windows, sill walls below windows — then trimmed against sloped roofs (see [roofs.md](roofs.md)), and finally **merged into a single BufferGeometry per wall**. One draw call per wall keeps large plans fast and keeps glTF exports lean. No CSG library is involved; slicing is exact via polygon clipping.

**Materials.** `materials3d.tsx` provides a shared material component: PBR texture sets (color/normal/roughness) load with suspense and a flat-color fallback, tile in real meters via UV repeat, and are **clone-cached per (texture, scale)** so hundreds of meshes share one GPU texture set. Glossy finishes get boosted environment-map intensity for reflections.

**Lighting.** An HDRI environment (day or night) supplies image-based lighting; a directional sun follows the time-of-day slider and the plot's north angle (east at 06:00, south at noon, west at 18:00, with warm color at low angles). At night, placed lamps emit point lights.

**Quality pipeline.** ACES tone mapping, PCSS soft shadows, and a post-processing chain (N8AO ambient occlusion + SMAA on top of 4× MSAA) behind a High/Fast toggle for weaker GPUs.

**Production models.** Catalog items with a `glb` id load photoscanned GLTF models, normalized to the element's parametric box — scaled to width × height × depth and grounded at the floor — so resizing an element resizes the model, and the parametric primitive remains the loading/error fallback (`GltfModel.tsx`).

## Elevation composer

The façade view (`features/elevation/`) reuses the same viewport math with a vertical convention: screen y = −height, ground line at 0. Components are schematic vector symbols with manual stacking order (`layer` field) on top of size-based default ordering.
