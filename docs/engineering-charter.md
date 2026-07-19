# Engineering Charter

DreamHouse Studio is built as a browser-native CAD/BIM system for residential
architecture — not a consumer floor planner. Every feature is judged as an
engineering problem first and a UI problem second.

## Principles

- **One model.** Everything derives from the design document. Geometry is
  exact (SI units internally; mm/ft-in only at presentation boundaries),
  never duplicated, and every object is parametric — editing a parameter
  updates every dependent view: plan, elevation, 3D, exports, schedules.
- **Engines, not sprites.** Building components are engineering objects.
  Stairs are solved (risers, going, landings, slope, 2R+G comfort, code
  checks) by `engine/stair.ts`, not drawn as furniture. Walls join by exact
  miters and boolean unions; openings cut their hosts; roofs trim walls.
- **Rendering is a projection.** React, Konva and Three.js visualize the
  model; they never own geometry. The 2D symbol library
  (`library/symbolBlocks.ts`) is a single primitive IR consumed by the
  canvas, the SVG sheets, and the DXF exporter, so a drawing is the same
  drawing everywhere.
- **Drafting standards.** Sheets follow construction-documentation
  conventions: pen-weight hierarchy, wall poché, column markers, extension
  lines and slash ticks on chains, opening marks tied to door/window
  schedules, wet-area hatching, property-line linetypes, north arrow, scale
  bar, and title blocks with enclosed areas (open areas excluded). Metric
  documents dimension in millimeters.
- **Interchange.** Exports are model-driven: true-vector SVG, PDF sheet sets
  with schedules, DXF (R12, mm, layered) for CAD interoperability, GLB for
  3D. Screenshot exports are limited to the 3D viewport by design.
- **Determinism and tests.** Geometry modules are pure, framework-free and
  unit-tested. New engine work lands with tests before it lands with UI.

## Decision checklist for new features

1. Is it mathematically correct — and provably so in a test?
2. Would a licensed architect expect this behavior?
3. Would a contractor understand the resulting drawing?
4. Does it follow drafting standards rather than decorative taste?
5. Does it scale, and can it participate in a future IFC/BIM workflow?
