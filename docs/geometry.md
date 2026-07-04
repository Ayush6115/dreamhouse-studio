# Geometry Engine

`src/geometry/` is a pure, dependency-light math library: no React, no store access, no side effects. Every module has unit tests beside it. The only external dependency is `polygon-clipping` for exact boolean operations.

## Modules

| Module | Responsibility |
| --- | --- |
| `vec.ts` | 2D vector helpers, line intersection, closest-point-on-segment |
| `polygon.ts` | Shoelace area, centroid, winding, point-in-polygon, bounds |
| `walls.ts` | Wall outlines with miter joins; exact union areas |
| `setbacks.ts` | Edge classification, polygon inset, buildable regions, boolean validation |
| `roof.ts` | Roof solids (flat/shed/gable/hip/barrel), surface height and normal |
| `snapping.ts` | Prioritized snapping: points > segments > angle lock > grid |
| `obb.ts` | Oriented-bounding-box overlap (SAT) and rotated AABB |
| `units.ts` | Meter-based formatting and parsing (`36.4ft`, `11'6"`, `3500mm`) |

## Wall joins

Walls are centerline segments with thickness. `wallOutline` produces the plan polygon:

- **Free ends** get square butt caps.
- **Two walls at a joint** get a true miter: each wall's side lines are intersected with the neighbor's. The pairing is combinatorial (left-of-travel with left-of-travel), which makes it robust for perpendicular joins where dot-product heuristics degenerate. Extreme acute angles fall back to butt caps via a miter limit.
- **Three or more walls (T/X)** keep butt caps; the polygon union resolves the junction.

The invariant the tests pin down: for a mitered L-join, the union area equals the exact sum of centerline-length × thickness — zero overlap, zero gap. This is why the built-up area figure can be trusted.

## Setbacks and the buildable footprint

`classifyEdges` assigns each plot edge front/rear/left/right from its outward normal relative to the road direction. `insetPolygon` offsets each edge line inward by its distance and re-intersects consecutive edges — exact for convex plots, correct for mildly concave ones, and collapses to `null` (reported to the user) rather than produce a self-intersecting result.

The hand-edited buildable footprint is validated with polygon booleans: `polygonDifference(footprint, plot)` yields hard-error regions (outside the land), and `difference(footprint, legalEnvelope) ∩ plot` yields warning regions (setback intrusion, waivable by the user).

## Snapping

`snapPoint` applies the strongest applicable rule within tolerance: existing significant points (wall endpoints, plot vertices), then sliding along segments, then angle locking from a drawing anchor (45° steps, combined with length quantization), then the grid. Tolerances are provided by the canvas in world units derived from the current zoom, so snapping feels identical at every scale.

## Numeric conventions

All model math is SI: meters, radians, square meters. `units.ts` is the single boundary where display formatting and input parsing happen, including feet-and-inches round-tripping. Keeping conversion at the boundary eliminates an entire class of unit bugs.
