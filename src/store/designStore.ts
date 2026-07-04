import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DesignDocument, Element, Facade, Level, Point, UnitSystem, WallElement } from '../types';
import { createEmptyDocument, newId } from '../types';
import { wallAngle, wallLength } from '../geometry/walls';
import { dist } from '../geometry/vec';

export type ToolId =
  | 'select'
  | 'plot'
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'beam'
  | 'staircase'
  | 'room'
  | 'roof'
  | 'furniture'
  | 'note'
  | 'measure'
  | 'facade-item';

export type ViewMode = 'plan' | '3d' | 'elevation';

/** Selection sentinel for the plot (it is not an Element). */
export const PLOT_ID = '@plot';
/** Selection sentinel for the hand-edited buildable footprint. */
export const BUILDABLE_ID = '@buildable';

const HISTORY_LIMIT = 60;

/**
 * Keep a wall's generic transform/dimensions in sync with its canonical
 * endpoint representation, so consumers that only know ElementBase still see
 * correct values. Called by every store mutation that touches endpoints.
 */
export function syncWallDerived(wall: WallElement): void {
  const len = wallLength(wall);
  wall.transform.position.x = (wall.start.x + wall.end.x) / 2;
  wall.transform.position.y = (wall.start.y + wall.end.y) / 2;
  wall.transform.rotation = wallAngle(wall);
  wall.dimensions.width = len;
  wall.dimensions.depth = wall.dimensions.thickness ?? wall.dimensions.depth;
}

interface FoundElement {
  element: Element;
  /** The array that owns it (a level's or a facade's element list). */
  collection: Element[];
}

function findElement(doc: DesignDocument, id: string): FoundElement | null {
  for (const level of doc.levels) {
    const element = level.elements.find((e) => e.id === id);
    if (element) return { element, collection: level.elements };
  }
  for (const facade of doc.facades) {
    const element = facade.elements.find((e) => e.id === id);
    if (element) return { element, collection: facade.elements as Element[] };
  }
  return null;
}

export interface DesignState {
  doc: DesignDocument;
  activeLevelId: string;
  activeFacadeId: string;
  selectedIds: string[];
  tool: ToolId;
  viewMode: ViewMode;
  dayNight: 'day' | 'night';
  /** Time of day (6–18) driving the sun position in the 3D view. */
  sunHour: number;
  gridSize: number;
  snapEnabled: boolean;
  showDimensions: boolean;
  /** Show a faded underlay of the level below in the plan. */
  showLevelGhost: boolean;
  past: DesignDocument[];
  future: DesignDocument[];

  // -- ui --
  setTool: (tool: ToolId) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelection: (ids: string[]) => void;
  setDayNight: (v: 'day' | 'night') => void;
  setSunHour: (hour: number) => void;
  setGridSize: (size: number) => void;
  setSnapEnabled: (on: boolean) => void;
  setShowDimensions: (on: boolean) => void;
  setShowLevelGhost: (on: boolean) => void;
  setActiveLevel: (id: string) => void;
  setActiveFacade: (id: string) => void;

  // -- document --
  setDocName: (name: string) => void;
  setUnitSystem: (u: UnitSystem) => void;
  newDocument: () => void;
  loadDocument: (doc: DesignDocument) => void;

  /**
   * Snapshot the current document into the undo stack. Call ONCE before a
   * user-visible change (or at drag start), then apply mutations. Continuous
   * mutations during a drag should not push again.
   */
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // -- plot --
  setPlotBoundary: (points: Point[]) => void;
  updatePlot: (partial: Partial<DesignDocument['plot']>) => void;

  // -- levels --
  addLevel: () => void;
  addBasement: () => void;
  removeLevel: (id: string) => void;
  updateLevel: (id: string, partial: Partial<Pick<Level, 'name' | 'elevation' | 'height'>>) => void;

  // -- elements --
  addElement: (element: Element, opts?: { levelId?: string; facadeId?: string; select?: boolean }) => void;
  /** Apply an immer recipe to one element (searched across levels + facades). */
  updateElement: (id: string, recipe: (el: Element) => void) => void;
  removeElements: (ids: string[]) => void;
  /** Clone the selected elements 0.4 m away and select the clones. */
  duplicateElements: (ids: string[]) => void;
  /** Translate elements in plan (arrow-key nudge). */
  nudgeElements: (ids: string[], dx: number, dy: number) => void;
  /** Give the elements a shared groupId so they select/move together. */
  groupElements: (ids: string[]) => void;
  ungroupElements: (ids: string[]) => void;
  lockElements: (ids: string[], locked: boolean) => void;
  moveWallEndpoint: (wallId: string, end: 'start' | 'end', point: Point) => void;

  // -- facades --
  updateFacade: (id: string, partial: Partial<Pick<Facade, 'name' | 'width' | 'height' | 'backdropColor'>>) => void;
  addFacade: () => void;
  removeFacade: (id: string) => void;
}

const initialDoc = createEmptyDocument();

export const useDesignStore = create<DesignState>()(
  immer((set) => ({
    doc: initialDoc,
    activeLevelId: initialDoc.levels[0].id,
    activeFacadeId: initialDoc.facades[0].id,
    selectedIds: [],
    tool: 'select',
    viewMode: 'plan',
    dayNight: 'day',
    sunHour: 13,
    gridSize: 0.5,
    snapEnabled: true,
    showDimensions: true,
    showLevelGhost: true,
    past: [],
    future: [],

    setTool: (tool) => set({ tool }),
    setViewMode: (viewMode) => set({ viewMode }),
    setSelection: (selectedIds) => set({ selectedIds }),
    setDayNight: (dayNight) => set({ dayNight }),
    setSunHour: (sunHour) => set({ sunHour: Math.min(18, Math.max(6, sunHour)) }),
    setGridSize: (gridSize) => set({ gridSize }),
    setSnapEnabled: (snapEnabled) => set({ snapEnabled }),
    setShowDimensions: (showDimensions) => set({ showDimensions }),
    setShowLevelGhost: (showLevelGhost) => set({ showLevelGhost }),
    setActiveLevel: (activeLevelId) => set({ activeLevelId, selectedIds: [] }),
    setActiveFacade: (activeFacadeId) => set({ activeFacadeId, selectedIds: [] }),

    setDocName: (name) =>
      set((s) => {
        s.doc.name = name;
      }),

    setUnitSystem: (u) =>
      set((s) => {
        s.doc.unitSystem = u;
      }),

    newDocument: () => {
      const doc = createEmptyDocument();
      set({
        doc,
        activeLevelId: doc.levels[0].id,
        activeFacadeId: doc.facades[0].id,
        selectedIds: [],
        past: [],
        future: [],
        tool: 'select',
        viewMode: 'plan',
      });
    },

    loadDocument: (doc) => {
      set({
        doc,
        activeLevelId: doc.levels[0]?.id ?? '',
        activeFacadeId: doc.facades[0]?.id ?? '',
        selectedIds: [],
        past: [],
        future: [],
      });
    },

    pushHistory: () =>
      set((s) => {
        s.past.push(JSON.parse(JSON.stringify(s.doc)));
        if (s.past.length > HISTORY_LIMIT) s.past.shift();
        s.future = [];
      }),

    undo: () =>
      set((s) => {
        const prev = s.past.pop();
        if (!prev) return;
        s.future.push(JSON.parse(JSON.stringify(s.doc)));
        s.doc = prev;
        s.selectedIds = [];
      }),

    redo: () =>
      set((s) => {
        const next = s.future.pop();
        if (!next) return;
        s.past.push(JSON.parse(JSON.stringify(s.doc)));
        s.doc = next;
        s.selectedIds = [];
      }),

    setPlotBoundary: (points) =>
      set((s) => {
        s.doc.plot.boundary = points;
      }),

    updatePlot: (partial) =>
      set((s) => {
        Object.assign(s.doc.plot, partial);
      }),

    addLevel: () =>
      set((s) => {
        const NAMES = ['Ground Floor', 'First Floor', 'Second Floor', 'Third Floor', 'Fourth Floor'];
        const sorted = [...s.doc.levels].sort((a, b) => a.elevation - b.elevation);
        const top = sorted[sorted.length - 1];
        const aboveGroundCount = s.doc.levels.filter((l) => l.elevation >= 0).length;
        const level: Level = {
          id: newId(),
          name: NAMES[aboveGroundCount] ?? `Floor ${aboveGroundCount}`,
          elevation: top ? top.elevation + top.height : 0,
          height: 3,
          elements: [],
        };
        s.doc.levels.push(level);
        s.activeLevelId = level.id;
      }),

    addBasement: () =>
      set((s) => {
        const sorted = [...s.doc.levels].sort((a, b) => a.elevation - b.elevation);
        const bottom = sorted[0];
        const basements = s.doc.levels.filter((l) => l.elevation < 0).length;
        const height = 2.8;
        const level: Level = {
          id: newId(),
          name: basements === 0 ? 'Basement' : `Basement ${basements + 1}`,
          elevation: (bottom ? bottom.elevation : 0) - height,
          height,
          elements: [],
        };
        s.doc.levels.unshift(level);
        s.activeLevelId = level.id;
      }),

    removeLevel: (id) =>
      set((s) => {
        if (s.doc.levels.length <= 1) return; // never delete the last level
        s.doc.levels = s.doc.levels.filter((l) => l.id !== id);
        if (s.activeLevelId === id) s.activeLevelId = s.doc.levels[0].id;
      }),

    updateLevel: (id, partial) =>
      set((s) => {
        const level = s.doc.levels.find((l) => l.id === id);
        if (level) Object.assign(level, partial);
      }),

    addElement: (element, opts) =>
      set((s) => {
        if (element.type === 'facade-element') {
          const facade =
            s.doc.facades.find((f) => f.id === (opts?.facadeId ?? s.activeFacadeId)) ?? s.doc.facades[0];
          facade?.elements.push(element);
        } else {
          const level =
            s.doc.levels.find((l) => l.id === (opts?.levelId ?? s.activeLevelId)) ?? s.doc.levels[0];
          if (element.type === 'wall') syncWallDerived(element);
          level?.elements.push(element);
        }
        if (opts?.select !== false) s.selectedIds = [element.id];
      }),

    updateElement: (id, recipe) =>
      set((s) => {
        const found = findElement(s.doc, id);
        if (!found) return;
        recipe(found.element);
        if (found.element.type === 'wall') {
          syncWallDerived(found.element);
          clampOpeningsToWall(found.collection, found.element);
        }
      }),

    removeElements: (ids) =>
      set((s) => {
        const idSet = new Set(ids);
        // Cascade: openings hosted on removed walls go too.
        for (const level of s.doc.levels) {
          for (const e of level.elements) {
            if ((e.type === 'door' || e.type === 'window') && idSet.has(e.wallId)) idSet.add(e.id);
          }
        }
        for (const level of s.doc.levels) {
          level.elements = level.elements.filter((e) => !idSet.has(e.id));
        }
        for (const facade of s.doc.facades) {
          facade.elements = facade.elements.filter((e) => !idSet.has(e.id));
        }
        s.selectedIds = s.selectedIds.filter((sid) => !idSet.has(sid));
      }),

    duplicateElements: (ids) =>
      set((s) => {
        const OFF = 0.4;
        const newIds: string[] = [];
        for (const level of s.doc.levels) {
          const idMap = new Map<string, string>();
          const clones: Element[] = [];
          for (const el of level.elements) {
            if (!ids.includes(el.id)) continue;
            const clone = JSON.parse(JSON.stringify(el)) as Element;
            clone.id = newId();
            idMap.set(el.id, clone.id);
            if (clone.type === 'wall' || clone.type === 'beam') {
              clone.start = { x: clone.start.x + OFF, y: clone.start.y + OFF };
              clone.end = { x: clone.end.x + OFF, y: clone.end.y + OFF };
              if (clone.type === 'wall') syncWallDerived(clone);
            } else if (clone.type === 'room') {
              clone.boundary = clone.boundary.map((p) => ({ x: p.x + OFF, y: p.y + OFF }));
            } else if (clone.type !== 'door' && clone.type !== 'window') {
              clone.transform.position.x += OFF;
              clone.transform.position.y += OFF;
            }
            clones.push(clone);
          }
          for (const clone of clones) {
            if (clone.type === 'door' || clone.type === 'window') {
              const mappedHost = idMap.get(clone.wallId);
              if (mappedHost) clone.wallId = mappedHost;
              else clone.offset += clone.dimensions.width + 0.15; // shift along the same wall
            }
          }
          level.elements.push(...clones);
          newIds.push(...clones.map((c) => c.id));
        }
        for (const facade of s.doc.facades) {
          const clones = facade.elements
            .filter((el) => ids.includes(el.id))
            .map((el) => {
              const clone = JSON.parse(JSON.stringify(el)) as typeof el;
              clone.id = newId();
              clone.transform.position.x += OFF;
              return clone;
            });
          facade.elements.push(...clones);
          newIds.push(...clones.map((c) => c.id));
        }
        if (newIds.length > 0) s.selectedIds = newIds;
      }),

    groupElements: (ids) =>
      set((s) => {
        const gid = newId();
        for (const level of s.doc.levels) {
          for (const el of level.elements) if (ids.includes(el.id)) el.groupId = gid;
        }
      }),

    ungroupElements: (ids) =>
      set((s) => {
        for (const level of s.doc.levels) {
          for (const el of level.elements) if (ids.includes(el.id)) delete el.groupId;
        }
      }),

    lockElements: (ids, locked) =>
      set((s) => {
        for (const level of s.doc.levels) {
          for (const el of level.elements) if (ids.includes(el.id)) el.locked = locked;
        }
        for (const facade of s.doc.facades) {
          for (const el of facade.elements) if (ids.includes(el.id)) el.locked = locked;
        }
      }),

    nudgeElements: (ids, dx, dy) =>
      set((s) => {
        for (const level of s.doc.levels) {
          for (const el of level.elements) {
            if (!ids.includes(el.id) || el.locked) continue;
            if (el.type === 'wall' || el.type === 'beam') {
              el.start = { x: el.start.x + dx, y: el.start.y + dy };
              el.end = { x: el.end.x + dx, y: el.end.y + dy };
              if (el.type === 'wall') syncWallDerived(el);
            } else if (el.type === 'room') {
              el.boundary = el.boundary.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            } else if (el.type !== 'door' && el.type !== 'window') {
              el.transform.position.x += dx;
              el.transform.position.y += dy;
            }
          }
        }
        for (const facade of s.doc.facades) {
          for (const el of facade.elements) {
            if (!ids.includes(el.id)) continue;
            el.transform.position.x += dx;
            el.transform.position.z -= dy; // plan "up" = higher on the façade
          }
        }
        if (ids.includes(PLOT_ID)) {
          s.doc.plot.boundary = s.doc.plot.boundary.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        }
      }),

    moveWallEndpoint: (wallId, end, point) =>
      set((s) => {
        const found = findElement(s.doc, wallId);
        if (!found || found.element.type !== 'wall') return;
        const wall = found.element;
        wall[end] = { x: point.x, y: point.y };
        syncWallDerived(wall);
        clampOpeningsToWall(found.collection, wall);
      }),

    updateFacade: (id, partial) =>
      set((s) => {
        const facade = s.doc.facades.find((f) => f.id === id);
        if (facade) Object.assign(facade, partial);
      }),

    addFacade: () =>
      set((s) => {
        const facade: Facade = {
          id: newId(),
          name: `Elevation ${s.doc.facades.length + 1}`,
          width: 12,
          height: 7,
          backdropColor: '#e8e2d8',
          elements: [],
        };
        s.doc.facades.push(facade);
        s.activeFacadeId = facade.id;
      }),

    removeFacade: (id) =>
      set((s) => {
        if (s.doc.facades.length <= 1) return;
        s.doc.facades = s.doc.facades.filter((f) => f.id !== id);
        if (s.activeFacadeId === id) s.activeFacadeId = s.doc.facades[0].id;
      }),
  })),
);

/** Openings must stay on their wall when it shrinks. */
function clampOpeningsToWall(collection: Element[], wall: WallElement): void {
  const len = dist(wall.start, wall.end);
  for (const e of collection) {
    if ((e.type === 'door' || e.type === 'window') && e.wallId === wall.id) {
      const half = e.dimensions.width / 2;
      e.offset = Math.min(Math.max(e.offset, half), Math.max(half, len - half));
    }
  }
}

/** Elements of the active level (empty for none). */
export const useActiveLevel = (): Level | undefined =>
  useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));

export const useActiveFacade = (): Facade | undefined =>
  useDesignStore((s) => s.doc.facades.find((f) => f.id === s.activeFacadeId));
