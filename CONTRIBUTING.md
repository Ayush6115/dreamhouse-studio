# Contributing to DreamHouse Studio

Thank you for considering a contribution. This document covers the development setup, project conventions, and the pull-request process.

## Development setup

```bash
git clone <repository-url>
cd dreamhouse-studio
npm install
npm run fetch-assets   # optional but recommended (CC0 asset pack)
npm run dev
```

Node.js 20.11+ is required.

## Before you open a pull request

Run the full verification locally:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For changes touching canvas interaction, rendering, or exports, also run the end-to-end suite (it opens a browser window):

```bash
npm run dev -- --port 5199   # in one terminal
npm run smoke                # in another
```

All checks must pass. New geometry or algorithmic code should come with unit tests beside the module (`*.test.ts`).

## Architecture ground rules

These invariants keep the codebase maintainable — changes that break them need a strong justification in the PR description:

1. **The design document is the single source of truth.** Views (plan, 3D, elevation) and calculations derive from it; they never own geometry.
2. **Elements are pure data.** The document must remain JSON-serializable at all times. Rendering lives in registries keyed by element type, never on the element.
3. **Geometry is pure and tested.** `src/geometry/` has no React, no store, no side effects.
4. **Storage goes through one seam.** Only `src/store/persistence.ts` touches localStorage; a future backend replaces that file alone.
5. **Canvas hit-widths are screen-space.** Konva `hitStrokeWidth` inside the scaled stage must be divided by the viewport scale (`14 / vpScale`), never a bare pixel constant.

See `docs/architecture.md` for the reasoning behind each.

## Coding conventions

- TypeScript strict mode; no `any` (enforced by lint). Prefer `unknown` plus narrowing.
- Small, focused files; one component or concern per file.
- Comments explain constraints the code cannot show — not what the next line does.
- Model values are SI (meters, radians, m²); unit conversion happens only at display and input boundaries (`src/geometry/units.ts`).
- User-visible changes need a `CHANGELOG.md` entry under *Unreleased*.

## Commit and PR guidelines

- Keep commits scoped; write imperative subject lines ("Add barrel roof style", not "Added…").
- Fill in the pull-request template. Screenshots or short clips are expected for visual changes.
- PRs should preserve all existing functionality unless the linked issue says otherwise. The smoke suite is the contract.

## Reporting issues

Use the issue templates. For bugs, include the steps to reproduce, the expected and actual behavior, and — when relevant — an exported `.dreamhouse.json` that demonstrates the problem.
