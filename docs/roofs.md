# Roof System

## Data model

A roof is an element over a rectangular footprint: center and base height in `transform.position`, plan size in `dimensions`, plus `roofStyle` (`flat | shed | gable | hip | barrel`), `pitch` (degrees), `overhang`, `parapetHeight` (flat roofs), `skylights[]`, and `dormers[]`. Skylights and dormers use roof-local coordinates centered on the footprint.

## Geometry (`src/geometry/roof.ts`)

`roofGeometry(style, W, D, pitch, thickness)` returns planar faces (wound outward) in roof-local space, where W and D already include the overhang:

- **flat** — a slab; parapets are rendered as perimeter boxes by the mesh component.
- **shed** — a wedge: low eave at +y, high edge at −y, rise = D·tan(pitch).
- **gable** — a triangular prism with ridge along x at rise = (D/2)·tan(pitch), closed gable end caps.
- **hip** — the ridge runs along the longer plan axis and shortens by |W−D|; equal-sided plans degenerate cleanly into pyramids. Rise = (min(W,D)/2)·tan(pitch).
- **barrel** — a circular arc through both eaves and the apex, clamped below a semicircle so the vault never bulges past the eaves; segmented into strips with arched end caps.

Two query functions drive everything that sits *on* a roof: `roofSurfaceZ(x, y)` (top-surface height, `null` outside the footprint) and `roofSurfaceNormal(x, y)` (finite-difference normal). Skylights use them to seat and tilt on the slope; wall trimming uses the surface as a clamp.

## Wall-to-roof trimming (`features/viewer3d/geometry3d.ts`)

`trimPiecesToRoofs` makes walls stop at sloped roofs automatically:

1. For each wall piece, sample its polygon corners against `roofClampAt` — the minimum covering-roof surface height (in world plan coordinates, handling roof rotation), minus a 2 cm tuck.
2. Untouched pieces pass through unchanged.
3. Clamped pieces are sliced into 15 cm strips along the wall axis; each strip's top is clamped to the surface at its own location. Degenerate sliver polygons from clipping are filtered (they would produce NaN geometry).
4. The stair-stepped tops hide inside the roof solid, so the visible junction is a clean slope line.

The practical result: raise a gable-end wall above the roof base and it becomes a pitched gable wall in the wall's own material. Flat roofs never trim.

All strips merge with the wall's other pieces into a single mesh (see [rendering.md](rendering.md)).

## Dormers

A dormer is a parametric assembly seated on the slope: a vertical front wall with glazing, side cheeks, and a small gable cap whose ridge runs upslope. Its front automatically faces the nearer eave (sign of local y). Seams sink into the roof solid, avoiding boolean subtraction; like skylights, dormers are visual insertions and do not cut light holes through the roof volume.

## Compound shapes

L- and U-shaped roofs are built by composition: place two or three overlapping rectangular roofs at 90° — the solids intersect into clean valleys. True single-volume polygon roofs (straight-skeleton) are on the roadmap.
