# Architecture Overview

## The one-document principle

Everything in DreamHouse Studio derives from a single value: the `DesignDocument` (`src/types/document.ts`).

```
DesignDocument
├── plot            boundary polygon, setbacks, buildable footprint, orientation
├── levels[]        floors: elevation, height, elements[]
│   └── Element     wall | door | window | column | beam | staircase |
│                   room | roof | furniture | note
└── facades[]       elevation compositions of façade elements
```

The 2D plan, the 3D scene, the elevation composer, the status-bar calculations, and every export are **derived views**. None of them owns geometry; editing any property updates the document, and every view reacts. This is enforced structurally: renderers receive elements as props and registries map element `type` to drawing code.

Two consequences worth internalizing:

1. **Serializability is sacred.** The document round-trips through JSON for persistence, undo snapshots, and project files. Elements therefore carry no functions or class instances — rendering lives in registries (`features/plan/symbols2d.tsx`, `features/viewer3d/furniture3d.tsx`), not on elements.
2. **Calculations are definitions, not estimates.** Carpet area is the sum of room polygons; wall footprint is the exact union of wall outlines; built-up is the area of rooms ∪ walls. See `store/calculations.ts`.

## Element model

All elements extend `ElementBase`: id, type, name, `transform` (position/rotation/scale), `dimensions` (width/depth/height/thickness), `material`, plus optional `locked`, `groupId`, `visible`, and `meta`. Type-specific data extends this — walls carry canonical `start`/`end` points (the store keeps the generic transform in sync via `syncWallDerived`), openings carry a `wallId` and an `offset` along their host, roofs carry style/pitch/overhang/skylights/dormers.

Coordinate conventions (documented in `types/geometry.ts`): plan coordinates are meters with +x east and +y south (screen-down), so the Konva canvas needs no axis flip; 3D maps plan (x, y) to world (x, z) with +y up; rotations are radians about the vertical axis.

## State

A single Zustand store (`store/designStore.ts`) holds the document plus UI-adjacent state (active level, selection, tool, view mode). Mutations use Immer recipes. Undo/redo is snapshot-based: `pushHistory()` is called **once per user gesture** (or at drag start), after which continuous mutations during the gesture are free — calculations update live while dragging, but one Ctrl+Z reverts the whole gesture.

Ephemeral UI state that is not design data (cursor position, toasts, favorites, export quality) lives in a second small store (`store/uiStore.ts`).

## Persistence seam

`store/persistence.ts` is the only module that touches storage. It implements multi-project localStorage persistence (index + document + generated thumbnails) with forward-migration of documents saved by older versions. Replacing localStorage with a backend API means replacing this one file.

## Feature layout

Each feature directory owns its canvas and interaction logic:

- `features/plan/` — the drafting canvas. `tools.tsx` is a single state machine receiving pointer events in world meters; layers render document slices; `viewport.ts` converts screen ↔ world.
- `features/viewer3d/` — the R3F scene. Pure geometry generation (`geometry3d.ts`) is separated from React components and unit-tested.
- `features/elevation/` — the façade composer.
- `features/export/` — model-driven output (see [exports.md](exports.md)).

## Invariants that bite

- Konva `hitStrokeWidth` inside the scaled stage is in **world units**; always divide by the viewport scale.
- Interactive overlays that must win hit-testing (the buildable footprint editor) render as the **topmost** layer; Konva hit order is strictly paint order.
- Wall endpoints must coincide exactly for clean unions; the snapping system guarantees this, so bypassing snapping in new tools needs care.
