# Export System

## Model-driven sheets

Plan and elevation exports are **generated from the design document, not screenshotted from the canvas** (`features/export/svg.ts`). The SVG builders re-draw the document — plot, setbacks, buildable footprint, room fills and labels, the walls' even-odd union path, opening symbols, roofs, furniture outlines, text notes, and dimension lines — in meter coordinates. Consequences:

- Exports are true vector: infinitely scalable, tiny files.
- They work from any view; you do not need the plan open to export it.
- Visual fidelity is a deliberate subset: drawing-sheet conventions rather than editor chrome.

PNG exports rasterize those same SVGs (`raster.ts`) at the user-selected quality (Draft 1× to Ultra 5×, ~55 px/m at 1×). The PDF report (`exporters.ts`, jsPDF) composes a metrics cover page plus one sheet per floor and per non-empty façade at the same quality setting.

## Drawing styles

Every sheet renders in one of two styles, selected in the export menu and applied to SVG, PNG, and PDF alike:

- **Presentation** — the colored sheet: room fills, tinted plot, labeled areas.
- **Working drawing** (`workingDrawing.ts`) — a monochrome construction-documentation sheet with a pen-weight hierarchy: grey wall poché with black column markers at junctions, sanitary and kitchen fixture linework, tile hatching clipped to wet areas, a car in parking bays, numbered stair runs with break lines, and a property-line linetype. Around the building, `geometry/dimchains.ts` derives hierarchical dimension chains per side — opening jambs, wall lines, overall — drawn with extension lines and slash ticks. The sheet closes with a frame, north arrow, graphic scale bar, and a title block stating the enclosed area (open rooms such as porches and terraces excluded). Working elevations are projected from the model itself — floor stack, roof silhouette, openings with sills and chajjas, earth-hatched ground line, and GL/FFL/ROOF/PARAPET datums — falling back to the composed facade only when the document has no walls.

## Photoreal renders

The 3D view's **Photoreal** button (`viewer3d/PhotorealRender.tsx`) runs `three-gpu-pathtracer` over the live scene: the realtime frameloop pauses, a `WebGLPathTracer` takes over the same canvas, and samples accumulate progressively (draft 120 / standard 350 / fine 800). The image can be saved as PNG at any point. The path-tracing megashader compiles in the driver on first use — up to a couple of minutes on some machines (the UI says so); the browser's shader cache makes subsequent renders start quickly. Multiple importance sampling is disabled deliberately: it keeps the shader small enough for ANGLE/D3D compilers on Windows.

## 3D outputs

- **Snapshot PNG** — reads the live WebGL canvas (`preserveDrawingBuffer`). When the 3D view is closed, the last snapshot taken on leaving the view is used; the PDF notes when none exists.
- **glTF (.glb)** — exports the live scene via three's GLTFExporter, textures embedded. Requires the 3D view to be open. A 45-second safety timeout turns any stuck export into a user-visible error instead of a hang. Because walls merge into single meshes and texture clones are cached, exported files stay reasonable.

## The registry

Canvases register their live surfaces in `features/export/registry.ts` (plan stage, elevation stage, WebGL canvas, three scene, last 3D snapshot). The export pipeline is the only consumer. In development builds the registry is exposed as `window.__dreamhouse` for the end-to-end suite.

## Project files

`.dreamhouse.json` files are the raw design document (`store/persistence.ts`). Import assigns a fresh id so a shared file never overwrites an existing project. Loading forward-migrates documents saved by older versions (missing fields get defaults).

## Adding an export format

1. Build from the document, not from a canvas, unless the format is inherently a raster of the live view.
2. Put pure generation in its own module; wire downloads through `exporters.ts` helpers.
3. Add a menu item in `ExportMenu.tsx`; long-running work must respect the busy state and surface failures as toasts.
4. Extend the smoke suite with a download assertion.
