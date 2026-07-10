# DreamHouse Studio

Design a house in the browser — from an empty plot to a furnished, exportable home — without CAD knowledge.

DreamHouse Studio is a client-side home design platform. Draw your plot with engineering precision, raise parametric walls, cut doors and windows, tag rooms, add roofs with dormers and skylights, furnish interiors from a production-quality component library, compose the street façade, orbit the automatically generated 3D model, and export true-vector drawing sheets, 3D models, and a compiled PDF report.

Everything is driven by **one design document**: the 2D plan, the 3D scene, the elevation composer, and every calculation are derived views of the same state.

## Mission

Make residential design approachable for homeowners while remaining precise enough for serious planning work. Professional CAD tools demand training; consumer floor planners sacrifice correctness. DreamHouse Studio aims for both: an intuitive drag-and-drop workflow backed by exact geometry — true miter joins, real polygon booleans, legally validated setbacks, and dimensioned vector output.

## Key features

- **Plot designer** — irregular polygons with typed exact lengths (`36.4ft`, `3.5m`, `3500mm`, `11'6"`), vertex editing, per-side and per-edge setbacks, and a freely reshapeable buildable footprint with live legal validation.
- **Parametric walls** — chained drawing with grid, endpoint, and 45° snapping; exact miter geometry at corners; polygon-union footprints so areas never double-count.
- **Openings** — doors (single, double, sliding) and windows (sliding, fixed, casement, configurable mullions) anchored to walls; they cut, follow, and slide along their host.
- **Rooms** — tagged polygons (bedroom, kitchen, pooja, balcony, parking, and more) driving carpet-area figures and 3D floor finishes.
- **Roof designer** — flat (with parapets), shed, gable, hip, and barrel styles with pitch, overhang, skylights, and dormers. Walls trim themselves to roof slopes automatically; taller gable-end walls become pitched gable walls.
- **Multi-floor** — basements through terraces with named presets, a floor switcher, a ghost underlay of the level below, and floor-height-linked staircases.
- **Interior and façade stores** — 40+ interior items (32 backed by production CC0 photoscanned models) and 31 façade components; searchable with favorites and recents.
- **Live calculations** — plot, buildable, built-up, and carpet areas plus total wall length, recomputed on every edit. Geometric values only, by design.
- **3D viewer** — HDRI environment lighting, PBR textures, soft shadows, ambient occlusion, a sun-position slider tied to the plot's north angle, and day/evening/night modes.
- **Photoreal renders** — an in-viewport progressive GPU path tracer (physically-based global illumination, soft shadows, real glass) with draft/standard/fine sample targets and one-click PNG export.
- **Facade kit** — glass railings, wood slat screens, cove strip lights (they glow and cast light in evening/night modes), and planters for modern-villa terraces and balconies.
- **Precision editing** — measure tool, text annotations, marquee selection, grouping, locking, align/distribute, arrow-key nudge, and 60-step undo.
- **Exports** — floor plans and elevations as true-vector SVG or PNG, 3D snapshots, a full glTF (`.glb`) model, and a compiled PDF report, with selectable raster quality up to 5×. Two drawing styles: a colored presentation sheet, or a monochrome working drawing with hierarchical dimension chains, column markers, room sizes, a north arrow, and a title block with the enclosed area.
- **Projects** — multiple projects with thumbnails, rename/duplicate/delete, autosave, and portable `.dreamhouse.json` files.

## Technology stack

| Concern | Choice |
| --- | --- |
| Framework | React 19, TypeScript (strict), Vite |
| 2D drafting | Konva via react-konva |
| 3D | Three.js via React Three Fiber + drei, postprocessing (N8AO, SMAA) |
| State | Zustand + Immer (single design-document store) |
| Geometry | Internal engine + polygon-clipping for exact booleans |
| Styling | Tailwind CSS v4 |
| Exports | Model-driven SVG builders, jsPDF, three GLTFExporter |
| Testing | Vitest (geometry/unit) + Playwright (end-to-end) |

## Installation

Requires Node.js 20.11 or newer.

```bash
git clone https://github.com/Ayush6115/dreamhouse-studio.git
cd dreamhouse-studio
npm install
npm run fetch-assets   # one-time: downloads the CC0 asset pack (~90 MB)
npm run dev            # http://localhost:5173
```

The asset pack (photoscanned furniture, PBR textures, HDRIs) is not stored in the repository; `scripts/fetch-assets.mjs` downloads it reproducibly from Poly Haven and ambientCG. The application works without it — 3D falls back to parametric models and flat colors.

## Development workflow

```bash
npm run dev          # Vite dev server with HMR
npm run typecheck    # TypeScript project check
npm run lint         # ESLint
npm test             # unit tests (geometry, roof math, trimming, setbacks)
npm run smoke        # browser end-to-end suite (start `npm run dev -- --port 5199` first)
npm run build        # production build to dist/
```

The smoke suite launches a headed Chromium via Playwright, seeds a demo project, and exercises every major feature: drawing, calculations, undo, grouping, footprint editing with validation, 3D rendering, and all export paths.

## Project structure

```
src/
  types/        Shared parametric data model (DesignDocument → Plot/Level → Element)
  geometry/     Pure, unit-tested math: polygons, wall miters/unions, roofs,
                setbacks, snapping, OBB collision, unit parsing
  store/        Zustand single source of truth, undo history, derived
                calculations, persistence (multi-project, autosave)
  library/      Material presets, interior catalog, façade catalog
  features/
    plan/       Konva drafting canvas: tool state machine, layers, symbols
    viewer3d/   React Three Fiber scene: wall slicing, roof meshes, GLB pipeline
    elevation/  Façade composer canvas and symbols
    export/     SVG builders, rasterizer, PDF report, GLB export
  components/   Application chrome and UI primitives
scripts/        Asset pipeline and end-to-end suite
examples/       Sample projects (import from the top bar)
docs/           System documentation
```

See [docs/architecture.md](docs/architecture.md) for the design decisions behind this layout.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| `V P W D N C B S M O F T L` | Tools: select, plot, wall, door, window, column, beam, stair, room, roof, library, text, measure |
| `1` `2` `3` | Plan / 3D / Elevation views |
| Type digits while drawing | Exact-length input (any unit); `Enter` locks |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Ctrl+S` / `Ctrl+D` | Save project file / duplicate selection |
| `Ctrl+G` / `Ctrl+Shift+G` | Group / ungroup |
| `Enter` / `Esc` / right-click | Close polygon / cancel / remove last point |
| `R`, `Del` | Rotate / delete selection |
| Arrow keys (`Shift` = 5 cm) | Nudge selection |
| Scroll, `Space`+drag | Zoom / pan |

## Documentation

- [Architecture overview](docs/architecture.md)
- [Geometry engine](docs/geometry.md)
- [Rendering pipeline](docs/rendering.md)
- [Roof system](docs/roofs.md)
- [Component library](docs/library.md)
- [Export system](docs/exports.md)
- [Developer guide](docs/developer-guide.md)

## Roadmap

- Polygon (straight-skeleton) roofs for single-volume L/U shapes
- Wall-follows-roof growing (auto-extend short walls to the slope)
- Per-slope roof materials and gutter/fascia detailing
- Terrain: sloped plots and split-level floors
- Curved walls and arc segments
- Collaborative editing via the persistence seam (backend adapter)
- Locale packs for building-code presets (setback rules per region)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for the development setup, coding conventions, and pull-request process, and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) for community standards.

## License

MIT — see [LICENSE](LICENSE). Bundled asset downloads are CC0 from [Poly Haven](https://polyhaven.com) and [ambientCG](https://ambientcg.com); see `public/assets/LICENSE.md` after fetching.
