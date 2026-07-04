# Developer Guide

## Getting productive

```bash
npm install
npm run fetch-assets      # optional; 3D falls back to parametric without it
npm run dev               # http://localhost:5173
```

Fast feedback loop: `npm run test:watch` for geometry work; the dev server hot-reloads everything else. Before pushing: `npm run typecheck && npm run lint && npm test && npm run build`.

## Where things live

Follow one user action through the stack to orient yourself. *Drawing a wall*:

1. `App.tsx` hotkeys set the tool; `ToolPalette` mirrors it.
2. `PlanCanvas` converts pointer events to world meters (`viewport.ts`) and forwards them to `usePlanTools` (`tools.tsx`).
3. The wall case snaps the point (`geometry/snapping.ts`), builds the element (`factories.ts`), calls `pushHistory()` once, then `addElement`.
4. The store syncs derived wall fields (`syncWallDerived`) and every subscriber re-renders: `WallsLayer` recomputes the union fill, `calculations.ts` recomputes areas, `Scene3D` re-slices the wall in 3D.

## Testing strategy

- **Unit tests** (`vitest`, `*.test.ts` beside modules) pin down geometry invariants: miter exactness, roof rises, wall trimming clamps, setback classification, boolean validation, OBB overlap. New math requires them.
- **End-to-end** (`scripts/smoke.mjs`, Playwright, headed Chromium) seeds a legacy-format demo project (also exercising migration) and walks the real UI: drawing with typed lengths, undo, grouping, footprint editing with validation, 3D mounting, and every export as an actual download. Run against a dev server on port 5199.

The smoke suite runs headed on purpose: headless Chromium's canvas-encoding queue deadlocks three's GLTFExporter on texture-heavy scenes; real browsers are unaffected.

## Conventions and sharp edges

- **Units**: model math is meters/radians; convert only in `geometry/units.ts` consumers (fields, labels).
- **Undo**: one `pushHistory()` per user gesture, before the first mutation. Drags push once at threshold, then mutate freely.
- **Konva hit-testing**: `hitStrokeWidth` is world-space inside the scaled stage — divide by `vpScale`. Hit priority is paint order; interactive editors must render above passive content.
- **Konva double-click** is time-based only; gate handlers on click position (see `clickTrailRef` in `tools.tsx`) or two fast clicks in different places will trigger them.
- **Suspense in R3F**: textured materials and GLB models suspend; always provide a parametric/flat fallback and an error boundary (`materials3d.tsx` shows the pattern).
- **Selection sentinels**: the plot (`@plot`) and buildable footprint (`@buildable`) are selectable but are not elements; code iterating selections must filter ids starting with `@` before element lookups.
- **Locked elements** are selectable (so they can be unlocked) but must be excluded from move, nudge, delete, and align operations.

## Performance notes

- Walls render as one merged mesh each; keep it that way when extending wall geometry.
- Texture clones are cached per (set, scale); new textured materials should go through `materials3d.tsx`.
- Konva layers split static content from the tool overlay; avoid adding per-frame React state to layers that render many nodes.
