import { useEffect, useMemo, useRef, useState } from 'react';
import type { KonvaEventObject } from 'konva/lib/Node';
import type Konva from 'konva';
import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type { Element, OpeningElement, Point, WallElement } from '../../types';
import { isOpening, isWall } from '../../types';
import { BUILDABLE_ID, PLOT_ID, useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { snapPoint, type SnapContext, type SnapResult } from '../../geometry/snapping';
import { add, closestPointOnSegment, dist, norm, perp, scale as vscale, sub } from '../../geometry/vec';
import { wallLength, wallThickness } from '../../geometry/walls';
import { obbAabb, obbOverlap } from '../../geometry/obb';
import { formatLength, parseLength } from '../../geometry/units';
import { catalogItemById, makeFurniture } from '../../library/catalog';
import { makeBeam, makeColumn, makeDoor, makeNote, makeRoof, makeRoom, makeStaircase, makeWall, makeWindow } from './factories';
import { DimLabel } from './DimLabel';
import type { Viewport } from './viewport';

/**
 * All plan-editor tools as one state machine hook. The canvas feeds pointer
 * events in WORLD meters; tools mutate the design store (pushHistory once per
 * gesture, then live uncommitted updates so calculations react during drags).
 */

export interface PlanToolsApi {
  onMouseDown: (world: Point, e: KonvaEventObject<MouseEvent>) => void;
  onMouseMove: (world: Point, e: KonvaEventObject<MouseEvent>) => void;
  onMouseUp: (world: Point, e: KonvaEventObject<MouseEvent>) => void;
  onDblClick: (world: Point, e: KonvaEventObject<MouseEvent>) => void;
  /** Returns true when the right-click was consumed (suppress context menu). */
  onRightClick: (world: Point, e: KonvaEventObject<MouseEvent>) => boolean;
  overlay: React.ReactNode;
  /** HTML overlay (typed-length input / lock badge), rendered by the canvas. */
  hud: React.ReactNode;
  cursor: string;
}

type Handle =
  | { kind: 'wall-end'; end: 'start' | 'end' }
  | { kind: 'plot-vertex'; index: number }
  | { kind: 'buildable-vertex'; index: number }
  | { kind: 'room-vertex'; index: number };

interface DragState {
  mode: 'move' | 'wall-end' | 'plot-vertex' | 'buildable-vertex' | 'room-vertex' | 'opening-slide';
  ids: string[];
  grabWorld: Point;
  pushed: boolean;
  handle?: Handle;
  handleElementId?: string;
  /** Geometry snapshots taken at drag start, keyed by element id. */
  originals: Map<string, unknown>;
  plotOriginal?: Point[];
  buildableOriginal?: Point[];
}

const SNAP_COLORS: Record<string, string> = {
  point: '#e8a34b',
  segment: '#4f8cff',
  angle: '#34c98e',
  grid: '#b3a98f',
};

export function elementIdFromTarget(target: Konva.Node | null): { id?: string; handle?: Handle } {
  let node: Konva.Node | null = target;
  while (node) {
    const id = node.getAttr('elementId') as string | undefined;
    if (id) return { id, handle: node.getAttr('handle') as Handle | undefined };
    node = node.getParent();
  }
  return {};
}

interface OpeningPreview {
  wallId: string;
  center: Point;
  wallDir: Point;
  width: number;
  thickness: number;
  offset: number;
  valid: boolean;
}

export function usePlanTools(viewport: Viewport): PlanToolsApi {
  const tool = useDesignStore((s) => s.tool);
  const setTool = useDesignStore((s) => s.setTool);
  const doc = useDesignStore((s) => s.doc);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const setSelection = useDesignStore((s) => s.setSelection);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const addElement = useDesignStore((s) => s.addElement);
  const updateElement = useDesignStore((s) => s.updateElement);
  const moveWallEndpoint = useDesignStore((s) => s.moveWallEndpoint);
  const setPlotBoundary = useDesignStore((s) => s.setPlotBoundary);
  const updatePlot = useDesignStore((s) => s.updatePlot);
  const snapEnabled = useDesignStore((s) => s.snapEnabled);
  const gridSize = useDesignStore((s) => s.gridSize);
  const activeCatalogId = useUiStore((s) => s.activeCatalogId);
  const showToast = useUiStore((s) => s.showToast);
  const pushRecent = useUiStore((s) => s.pushRecent);

  const level = doc.levels.find((l) => l.id === activeLevelId) ?? doc.levels[0];
  const walls = useMemo(() => (level ? level.elements.filter(isWall) : []), [level]);
  const unit = doc.unitSystem;

  const [draft, setDraft] = useState<Point[]>([]); // plot / room polygon in progress
  const [anchor, setAnchor] = useState<Point | null>(null); // wall chain / beam start
  const [hover, setHover] = useState<SnapResult | null>(null);
  const [openingPreview, setOpeningPreview] = useState<OpeningPreview | null>(null);
  const [guides, setGuides] = useState<{ v: number[]; h: number[] } | null>(null);
  const [collides, setCollides] = useState(false);
  const [frozenMeasure, setFrozenMeasure] = useState<{ a: Point; b: Point } | null>(null);
  const [marquee, setMarquee] = useState<{ a: Point; b: Point } | null>(null);
  // Typed-length input: null = closed; string = input text being edited.
  const [typedLength, setTypedLength] = useState<string | null>(null);
  const [lengthLock, setLengthLock] = useState<number | null>(null);
  const selectedPlotVertices = useUiStore((s) => s.selectedPlotVertices);
  const setSelectedPlotVertices = useUiStore((s) => s.setSelectedPlotVertices);
  const marqueeStartRef = useRef<Point | null>(null);
  // Konva's dblclick is time-based only; we gate on position ourselves.
  const clickTrailRef = useRef<{ prev: Point | null; last: Point | null }>({ prev: null, last: null });
  const dragRef = useRef<DragState | null>(null);

  const tolerance = 12 / viewport.scale;

  // Reset transient state whenever the tool changes.
  useEffect(() => {
    setDraft([]);
    setAnchor(null);
    setHover(null);
    setOpeningPreview(null);
    setFrozenMeasure(null);
    setTypedLength(null);
    setLengthLock(null);
    dragRef.current = null;
  }, [tool]);

  // Plot vertex multi-selection only lives while the plot is selected.
  useEffect(() => {
    if (!selectedIds.includes(PLOT_ID) && selectedPlotVertices.length > 0) {
      setSelectedPlotVertices([]);
    }
  }, [selectedIds, selectedPlotVertices, setSelectedPlotVertices]);

  /** The point new segments grow from (for typed lengths / right-click undo). */
  const drawAnchor = tool === 'plot' || tool === 'room' ? (draft.at(-1) ?? null) : anchor;

  /**
   * Final placement point for a locked length: exactly `lengthLock` meters
   * from the draw anchor, in the (angle-snapped) cursor direction.
   */
  const applyLengthLock = (snapped: Point): Point => {
    if (lengthLock === null || !drawAnchor) return snapped;
    const d = dist(snapped, drawAnchor);
    if (d < 1e-9) return snapped;
    const dir = norm(sub(snapped, drawAnchor));
    return add(drawAnchor, vscale(dir, lengthLock));
  };

  const buildCtx = (opts?: {
    excludeIds?: Set<string>;
    extraPoints?: Point[];
    anchor?: Point | null;
    noSegments?: boolean;
  }): SnapContext => {
    if (!snapEnabled) return { gridSize: 0, tolerance, anchor: opts?.anchor ?? undefined };
    const excluded = opts?.excludeIds;
    const points: Point[] = [...(opts?.extraPoints ?? [])];
    for (const w of walls) {
      if (excluded?.has(w.id)) continue;
      points.push(w.start, w.end);
    }
    points.push(...doc.plot.boundary);
    const segments = opts?.noSegments
      ? undefined
      : walls.filter((w) => !excluded?.has(w.id)).map((w) => ({ a: w.start, b: w.end }));
    return { gridSize, tolerance, points, segments, anchor: opts?.anchor ?? undefined, angleStep: Math.PI / 4 };
  };

  const snap = (world: Point, ctx?: SnapContext): SnapResult => snapPoint(world, ctx ?? buildCtx());

  // ---------------------------------------------------------------- commits

  const closePolygon = () => {
    if (draft.length < 3) return;
    pushHistory();
    if (tool === 'plot') {
      setPlotBoundary(draft);
      setSelection([PLOT_ID]);
      setTool('select');
      showToast('Plot boundary saved');
    } else if (tool === 'room') {
      const room = makeRoom(draft);
      addElement(room);
      showToast('Room added — set its type in Properties');
    }
    setDraft([]);
  };

  const findOpeningSpot = (world: Point, width: number): OpeningPreview | null => {
    let best: { wall: WallElement; t: number; d: number; point: Point } | null = null;
    for (const w of walls) {
      const { point, t } = closestPointOnSegment(world, w.start, w.end);
      const d = dist(world, point);
      const reach = Math.max(tolerance, wallThickness(w) / 2 + tolerance / 2);
      if (d <= reach && (!best || d < best.d)) best = { wall: w, t, d, point };
    }
    if (!best) return null;
    const w = best.wall;
    const len = wallLength(w);
    const half = width / 2;
    if (len < width + 0.1) {
      const dir = norm(sub(w.end, w.start));
      return {
        wallId: w.id,
        center: best.point,
        wallDir: dir,
        width,
        thickness: wallThickness(w),
        offset: len / 2,
        valid: false,
      };
    }
    const offset = Math.min(Math.max(best.t * len, half), len - half);
    const siblings = level?.elements.filter(
      (e): e is OpeningElement => isOpening(e) && e.wallId === w.id,
    );
    const overlaps = siblings?.some(
      (o) => Math.abs(o.offset - offset) < (o.dimensions.width + width) / 2 + 0.05,
    );
    const dir = norm(sub(w.end, w.start));
    const center = add(w.start, vscale(dir, offset));
    return {
      wallId: w.id,
      center,
      wallDir: dir,
      width,
      thickness: wallThickness(w),
      offset,
      valid: !overlaps,
    };
  };

  // -------------------------------------------------------------- selection

  /** Expand a set of ids to include every member of any touched group. */
  const expandGroups = (ids: string[]): string[] => {
    if (!level) return ids;
    const groups = new Set(
      level.elements.filter((el) => ids.includes(el.id) && el.groupId).map((el) => el.groupId as string),
    );
    if (groups.size === 0) return ids;
    const expanded = new Set(ids);
    for (const el of level.elements) {
      if (el.groupId && groups.has(el.groupId)) expanded.add(el.id);
    }
    return [...expanded];
  };

  const beginSelectDrag = (world: Point, e: KonvaEventObject<MouseEvent>) => {
    const { id, handle } = elementIdFromTarget(e.target);
    const stage = e.target.getStage();
    if (!id || e.target === stage) {
      // Empty space: start a marquee (mouse-up decides marquee vs. deselect).
      if (!e.evt.shiftKey) marqueeStartRef.current = world;
      return;
    }

    // Buildable-footprint vertex handles (single-vertex drag with snapping).
    if (id === BUILDABLE_ID && handle?.kind === 'buildable-vertex') {
      dragRef.current = {
        mode: 'buildable-vertex',
        ids: [BUILDABLE_ID],
        grabWorld: world,
        pushed: false,
        handle,
        handleElementId: BUILDABLE_ID,
        originals: new Map(),
        buildableOriginal: (doc.plot.buildableOverride ?? []).map((p) => ({ ...p })),
      };
      return;
    }
    if (id === BUILDABLE_ID) {
      // Clicking the outline: select it; dragging moves the whole footprint.
      if (!selectedIds.includes(BUILDABLE_ID)) setSelection([BUILDABLE_ID]);
      dragRef.current = {
        mode: 'move',
        ids: [BUILDABLE_ID],
        grabWorld: world,
        pushed: false,
        originals: new Map(),
        buildableOriginal: (doc.plot.buildableOverride ?? []).map((p) => ({ ...p })),
      };
      return;
    }

    // Plot vertex handles: shift-click builds a multi-vertex selection;
    // dragging any selected handle moves the whole set.
    if (id === PLOT_ID && handle?.kind === 'plot-vertex') {
      const idx = handle.index;
      if (e.evt.shiftKey) {
        setSelectedPlotVertices(
          selectedPlotVertices.includes(idx)
            ? selectedPlotVertices.filter((i) => i !== idx)
            : [...selectedPlotVertices, idx],
        );
        return;
      }
      if (!selectedPlotVertices.includes(idx)) setSelectedPlotVertices([idx]);
      dragRef.current = {
        mode: 'plot-vertex',
        ids: [PLOT_ID],
        grabWorld: world,
        pushed: false,
        handle,
        handleElementId: PLOT_ID,
        originals: new Map(),
        plotOriginal: doc.plot.boundary.map((p) => ({ ...p })),
      };
      return;
    }

    const clicked = level?.elements.find((el) => el.id === id);
    if (clicked?.locked) {
      // Selectable (so it can be unlocked) but never draggable.
      setSelection([id]);
      return;
    }

    if (e.evt.shiftKey) {
      const unit = expandGroups([id]);
      const allIn = unit.every((u) => selectedIds.includes(u));
      setSelection(allIn ? selectedIds.filter((s) => !unit.includes(s)) : [...new Set([...selectedIds, ...unit])]);
      return; // shift-click adjusts selection without starting a drag
    }
    let ids: string[];
    if (!selectedIds.includes(id)) {
      ids = expandGroups([id]);
      setSelection(ids);
    } else {
      ids = expandGroups(selectedIds);
      if (ids.length !== selectedIds.length) setSelection(ids);
    }
    // Locked members of a group stay put.
    ids = ids.filter((sid) => !level?.elements.find((el) => el.id === sid)?.locked);

    const originals = new Map<string, unknown>();
    let mode: DragState['mode'] = 'move';
    if (handle?.kind === 'wall-end') mode = 'wall-end';
    else if (handle?.kind === 'plot-vertex') mode = 'plot-vertex';
    else if (handle?.kind === 'room-vertex') mode = 'room-vertex';

    for (const sid of ids) {
      if (sid === PLOT_ID) continue;
      const el = level?.elements.find((el2) => el2.id === sid);
      if (!el) continue;
      if (el.type === 'wall' || el.type === 'beam') {
        originals.set(sid, { start: { ...el.start }, end: { ...el.end } });
      } else if (el.type === 'room') {
        originals.set(sid, el.boundary.map((p) => ({ ...p })));
      } else if (isOpening(el)) {
        originals.set(sid, el.offset);
        if (mode === 'move') mode = 'opening-slide';
      } else {
        originals.set(sid, { ...el.transform.position });
      }
    }

    dragRef.current = {
      mode,
      ids,
      grabWorld: world,
      pushed: false,
      handle,
      handleElementId: id,
      originals,
      plotOriginal: ids.includes(PLOT_ID) ? doc.plot.boundary.map((p) => ({ ...p })) : undefined,
    };
  };

  const applyDrag = (world: Point) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.pushed) {
      if (dist(world, drag.grabWorld) < 2 / viewport.scale) return; // click, not drag
      pushHistory();
      drag.pushed = true;
    }

    const excludeIds = new Set(drag.ids);

    if (drag.mode === 'wall-end' && drag.handle?.kind === 'wall-end' && drag.handleElementId) {
      const s = snap(world, buildCtx({ excludeIds: new Set([drag.handleElementId]) }));
      setHover(s);
      moveWallEndpoint(drag.handleElementId, drag.handle.end, s.point);
      return;
    }

    if (drag.mode === 'buildable-vertex' && drag.handle?.kind === 'buildable-vertex' && drag.buildableOriginal) {
      const s = snap(world, buildCtx({ extraPoints: doc.plot.boundary }));
      setHover(s);
      const pts = drag.buildableOriginal.map((p) => ({ ...p }));
      pts[drag.handle.index] = s.point;
      updatePlot({ buildableOverride: pts });
      return;
    }

    if (drag.mode === 'plot-vertex' && drag.handle?.kind === 'plot-vertex' && drag.plotOriginal) {
      const grabIdx = drag.handle.index;
      const indices = selectedPlotVertices.length > 0 ? selectedPlotVertices : [grabIdx];
      const s = snap(world, buildCtx({ noSegments: false }));
      setHover(s);
      // The grabbed vertex lands on the snapped point; companions follow.
      const delta = sub(s.point, drag.plotOriginal[grabIdx]);
      const pts = drag.plotOriginal.map((p, i) => (indices.includes(i) ? add(p, delta) : { ...p }));
      setPlotBoundary(pts);
      return;
    }

    if (drag.mode === 'room-vertex' && drag.handle?.kind === 'room-vertex' && drag.handleElementId) {
      const s = snap(world);
      setHover(s);
      const idx = drag.handle.index;
      updateElement(drag.handleElementId, (el) => {
        if (el.type === 'room') el.boundary[idx] = s.point;
      });
      return;
    }

    if (drag.mode === 'opening-slide' && drag.handleElementId) {
      const el = level?.elements.find((e2) => e2.id === drag.handleElementId);
      if (el && isOpening(el)) {
        const host = walls.find((w) => w.id === el.wallId);
        if (host) {
          const len = wallLength(host);
          const { t } = closestPointOnSegment(world, host.start, host.end);
          const half = el.dimensions.width / 2;
          const offset = Math.min(Math.max(t * len, half), Math.max(half, len - half));
          updateElement(el.id, (e2) => {
            if (isOpening(e2)) e2.offset = offset;
          });
        }
      }
      return;
    }

    // mode === 'move': translate everything selected by a snapped delta.
    const rawDelta = sub(world, drag.grabWorld);
    let refPoint: Point | null = null;
    for (const sid of drag.ids) {
      if (sid === PLOT_ID && drag.plotOriginal?.length) {
        refPoint = drag.plotOriginal[0];
        break;
      }
      if (sid === BUILDABLE_ID && drag.buildableOriginal?.length) {
        refPoint = drag.buildableOriginal[0];
        break;
      }
      const orig = drag.originals.get(sid);
      if (!orig) continue;
      if (Array.isArray(orig)) refPoint = orig[0] as Point;
      else if ((orig as { start?: Point }).start) refPoint = (orig as { start: Point }).start;
      else refPoint = orig as Point;
      break;
    }
    if (!refPoint) return;
    const snapped = snap(add(refPoint, rawDelta), buildCtx({ excludeIds, noSegments: true }));
    setHover(snapped);
    const delta = { ...sub(snapped.point, refPoint) };

    // Alignment guides + collision awareness for a single placed item.
    const isItem = (t: string) => t === 'furniture' || t === 'column' || t === 'staircase';
    const soloId = drag.ids.length === 1 ? drag.ids[0] : null;
    const soloEl = soloId ? level?.elements.find((e2) => e2.id === soloId) : undefined;
    const soloOrig = soloId ? (drag.originals.get(soloId) as (Point & { z?: number }) | undefined) : undefined;
    if (soloEl && soloOrig && isItem(soloEl.type)) {
      const alignTol = 8 / viewport.scale;
      const moved = { x: soloOrig.x + delta.x, y: soloOrig.y + delta.y };
      const myBox = obbAabb({
        c: moved,
        w: soloEl.dimensions.width,
        d: soloEl.dimensions.depth,
        rot: soloEl.transform.rotation,
      });
      const myXs = [moved.x, myBox.min.x, myBox.max.x];
      const myYs = [moved.y, myBox.min.y, myBox.max.y];
      let bestX: { adj: number; line: number } | null = null;
      let bestY: { adj: number; line: number } | null = null;
      for (const other of level?.elements ?? []) {
        if (other.id === soloEl.id || !isItem(other.type)) continue;
        const box = obbAabb({
          c: { x: other.transform.position.x, y: other.transform.position.y },
          w: other.dimensions.width,
          d: other.dimensions.depth,
          rot: other.transform.rotation,
        });
        for (const line of [other.transform.position.x, box.min.x, box.max.x]) {
          for (const mx of myXs) {
            const adj = line - mx;
            if (Math.abs(adj) < alignTol && (!bestX || Math.abs(adj) < Math.abs(bestX.adj))) bestX = { adj, line };
          }
        }
        for (const line of [other.transform.position.y, box.min.y, box.max.y]) {
          for (const my of myYs) {
            const adj = line - my;
            if (Math.abs(adj) < alignTol && (!bestY || Math.abs(adj) < Math.abs(bestY.adj))) bestY = { adj, line };
          }
        }
      }
      if (bestX) delta.x += bestX.adj;
      if (bestY) delta.y += bestY.adj;
      setGuides(bestX || bestY ? { v: bestX ? [bestX.line] : [], h: bestY ? [bestY.line] : [] } : null);

      // Advisory collision check at the final position.
      const finalC = { x: soloOrig.x + delta.x, y: soloOrig.y + delta.y };
      const hit = (level?.elements ?? []).some(
        (other) =>
          other.id !== soloEl.id &&
          isItem(other.type) &&
          obbOverlap(
            { c: finalC, w: soloEl.dimensions.width, d: soloEl.dimensions.depth, rot: soloEl.transform.rotation },
            {
              c: { x: other.transform.position.x, y: other.transform.position.y },
              w: other.dimensions.width,
              d: other.dimensions.depth,
              rot: other.transform.rotation,
            },
          ),
      );
      setCollides(hit);
    } else {
      setGuides(null);
      setCollides(false);
    }

    if (drag.plotOriginal) {
      setPlotBoundary(drag.plotOriginal.map((p) => add(p, delta)));
    }
    if (drag.buildableOriginal && drag.ids.includes(BUILDABLE_ID)) {
      updatePlot({ buildableOverride: drag.buildableOriginal.map((p) => add(p, delta)) });
    }
    for (const sid of drag.ids) {
      if (sid === PLOT_ID || sid === BUILDABLE_ID) continue;
      const orig = drag.originals.get(sid);
      if (orig === undefined) continue;
      updateElement(sid, (el: Element) => {
        if (el.type === 'wall' || el.type === 'beam') {
          const o = orig as { start: Point; end: Point };
          el.start = add(o.start, delta);
          el.end = add(o.end, delta);
        } else if (el.type === 'room') {
          el.boundary = (orig as Point[]).map((p) => add(p, delta));
        } else if (!isOpening(el)) {
          const o = orig as Point & { z?: number };
          el.transform.position.x = o.x + delta.x;
          el.transform.position.y = o.y + delta.y;
        }
      });
    }
  };

  // ------------------------------------------------------------- tool logic

  const onMouseDown = (world: Point, e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    clickTrailRef.current = { prev: clickTrailRef.current.last, last: world };
    switch (tool) {
      case 'select':
        beginSelectDrag(world, e);
        break;

      case 'plot':
      case 'room': {
        const s = snap(world, buildCtx({ extraPoints: draft, anchor: draft.at(-1) ?? null }));
        if (lengthLock !== null && draft.length > 0) {
          const p = applyLengthLock(s.point);
          setDraft([...draft, p]);
          setLengthLock(null);
        } else if (draft.length >= 3 && dist(s.point, draft[0]) <= tolerance * 1.5) {
          closePolygon();
        } else {
          setDraft([...draft, s.point]);
        }
        break;
      }

      case 'wall': {
        const s = snap(world, buildCtx({ anchor }));
        if (!anchor) {
          setAnchor(s.point);
        } else {
          const p = applyLengthLock(s.point);
          if (dist(p, anchor) > 0.05) {
            pushHistory();
            addElement(makeWall(anchor, p, { height: level?.height ?? 3 }), { select: false });
            setAnchor(p);
            setLengthLock(null);
          }
        }
        break;
      }

      case 'door':
      case 'window': {
        const width = tool === 'door' ? 0.9 : 1.2;
        const spot = findOpeningSpot(world, width);
        if (spot?.valid) {
          pushHistory();
          addElement(tool === 'door' ? makeDoor(spot.wallId, spot.offset) : makeWindow(spot.wallId, spot.offset));
        }
        break;
      }

      case 'column': {
        const s = snap(world);
        pushHistory();
        addElement(makeColumn(s.point));
        break;
      }

      case 'staircase': {
        const s = snap(world);
        pushHistory();
        addElement(makeStaircase(s.point));
        break;
      }

      case 'note': {
        const s = snap(world);
        pushHistory();
        addElement(makeNote(s.point));
        setTool('select'); // straight into editing the text in the panel
        break;
      }

      case 'beam': {
        const s = snap(world, buildCtx({ anchor }));
        if (!anchor) {
          setAnchor(s.point);
        } else {
          const p = applyLengthLock(s.point);
          if (dist(p, anchor) > 0.05) {
            pushHistory();
            addElement(makeBeam(anchor, p, level?.height ?? 3));
            setAnchor(null);
            setLengthLock(null);
          }
        }
        break;
      }

      case 'roof': {
        const s = snap(world, buildCtx({ anchor, noSegments: true }));
        if (!anchor) {
          setAnchor(s.point);
        } else if (Math.abs(s.point.x - anchor.x) > 0.3 && Math.abs(s.point.y - anchor.y) > 0.3) {
          pushHistory();
          addElement(makeRoof(anchor, s.point, level?.height ?? 3));
          setAnchor(null);
          setTool('select');
        }
        break;
      }

      case 'measure': {
        const s = snap(world);
        if (!anchor) {
          setFrozenMeasure(null);
          setAnchor(s.point);
        } else {
          setFrozenMeasure({ a: anchor, b: s.point });
          setAnchor(null);
        }
        break;
      }

      case 'furniture': {
        if (!activeCatalogId) {
          showToast('Pick an item from the Library first');
          return;
        }
        const s = snap(world);
        pushHistory();
        const placed = makeFurniture(activeCatalogId, s.point);
        addElement(placed);
        pushRecent(activeCatalogId);
        // CAD placement flow: place once, return to Select — hold Shift to
        // keep placing copies.
        if (!e.evt.shiftKey) {
          useUiStore.getState().setActiveCatalogId(null);
          setTool('select');
          setSelection([placed.id]);
        }
        break;
      }
    }
  };

  const onMouseMove = (world: Point) => {
    if (tool === 'select') {
      if (dragRef.current) applyDrag(world);
      else if (marqueeStartRef.current) setMarquee({ a: marqueeStartRef.current, b: world });
      else if (hover) setHover(null);
      return;
    }
    if (tool === 'door' || tool === 'window') {
      setOpeningPreview(findOpeningSpot(world, tool === 'door' ? 0.9 : 1.2));
      setHover(null);
      return;
    }
    const s = snap(
      world,
      buildCtx({
        extraPoints: draft,
        anchor: tool === 'wall' || tool === 'beam' || tool === 'measure' ? anchor : (draft.at(-1) ?? null),
        noSegments: tool === 'roof',
      }),
    );
    setHover(s);
  };

  const onMouseUp = () => {
    dragRef.current = null;
    setGuides(null);
    setCollides(false);

    if (marqueeStartRef.current) {
      const start = marqueeStartRef.current;
      marqueeStartRef.current = null;
      if (marquee && dist(marquee.a, marquee.b) > 0.1 && level) {
        const min = { x: Math.min(start.x, marquee.b.x), y: Math.min(start.y, marquee.b.y) };
        const max = { x: Math.max(start.x, marquee.b.x), y: Math.max(start.y, marquee.b.y) };
        const hits: string[] = [];
        for (const el of level.elements) {
          if (el.locked || el.visible === false) continue;
          let box: { min: Point; max: Point } | null = null;
          if (el.type === 'wall' || el.type === 'beam') {
            box = {
              min: { x: Math.min(el.start.x, el.end.x), y: Math.min(el.start.y, el.end.y) },
              max: { x: Math.max(el.start.x, el.end.x), y: Math.max(el.start.y, el.end.y) },
            };
          } else if (el.type === 'room') {
            if (el.boundary.length >= 3) {
              const xs = el.boundary.map((p) => p.x);
              const ys = el.boundary.map((p) => p.y);
              box = { min: { x: Math.min(...xs), y: Math.min(...ys) }, max: { x: Math.max(...xs), y: Math.max(...ys) } };
            }
          } else if (el.type === 'door' || el.type === 'window') {
            continue; // openings follow their wall
          } else {
            box = obbAabb({
              c: { x: el.transform.position.x, y: el.transform.position.y },
              w: el.dimensions.width,
              d: el.dimensions.depth,
              rot: el.transform.rotation,
            });
          }
          if (box && box.min.x <= max.x && box.max.x >= min.x && box.min.y <= max.y && box.max.y >= min.y) {
            hits.push(el.id);
          }
        }
        setSelection(expandGroups(hits));
      } else {
        setSelection([]);
      }
      setMarquee(null);
    }
  };

  const onDblClick = (world: Point) => {
    if (tool === 'plot' || tool === 'room') closePolygon();
    if (tool === 'wall') setAnchor(null);

    // Edit-plot: double-click an edge to insert a vertex there. Require both
    // clicks of the pair in the same spot (Konva's dblclick is time-only).
    const trail = clickTrailRef.current;
    const genuineDblClick = trail.prev !== null && dist(trail.prev, world) < 0.5;
    if (genuineDblClick && tool === 'select' && selectedIds.includes(PLOT_ID) && doc.plot.boundary.length >= 3) {
      const b = doc.plot.boundary;
      let best: { i: number; point: Point; d: number } | null = null;
      for (let i = 0; i < b.length; i++) {
        const { point } = closestPointOnSegment(world, b[i], b[(i + 1) % b.length]);
        const d = dist(world, point);
        if (d <= tolerance && (!best || d < best.d)) best = { i, point, d };
      }
      if (best) {
        // Don't insert on top of an existing vertex.
        if (dist(best.point, b[best.i]) > 0.1 && dist(best.point, b[(best.i + 1) % b.length]) > 0.1) {
          pushHistory();
          const pts = b.map((p) => ({ ...p }));
          pts.splice(best.i + 1, 0, best.point);
          setPlotBoundary(pts);
          setSelectedPlotVertices([best.i + 1]);
          showToast('Vertex added — drag it into place');
        }
      }
    }

    // Edit-buildable: double-click an edge of the footprint to add a vertex.
    const bo = doc.plot.buildableOverride;
    if (genuineDblClick && tool === 'select' && selectedIds.includes(BUILDABLE_ID) && bo && bo.length >= 3) {
      let best: { i: number; point: Point; d: number } | null = null;
      for (let i = 0; i < bo.length; i++) {
        const { point } = closestPointOnSegment(world, bo[i], bo[(i + 1) % bo.length]);
        const d = dist(world, point);
        if (d <= tolerance && (!best || d < best.d)) best = { i, point, d };
      }
      if (best && dist(best.point, bo[best.i]) > 0.1 && dist(best.point, bo[(best.i + 1) % bo.length]) > 0.1) {
        pushHistory();
        const pts = bo.map((p) => ({ ...p }));
        pts.splice(best.i + 1, 0, best.point);
        updatePlot({ buildableOverride: pts });
        showToast('Footprint vertex added');
      }
    }
  };

  /** Right-click: undo the last placed point / cancel / delete plot vertex. */
  const onRightClick = (world: Point, e: KonvaEventObject<MouseEvent>): boolean => {
    void world;
    if (typedLength !== null || lengthLock !== null) {
      setTypedLength(null);
      setLengthLock(null);
      return true;
    }
    if ((tool === 'plot' || tool === 'room') && draft.length > 0) {
      setDraft(draft.slice(0, -1)); // drop the most recent point
      return true;
    }
    if ((tool === 'wall' || tool === 'beam' || tool === 'roof') && anchor) {
      setAnchor(null);
      return true;
    }
    if (tool === 'measure' && (anchor || frozenMeasure)) {
      setAnchor(null);
      setFrozenMeasure(null);
      return true;
    }
    // Edit-plot / edit-buildable: right-click a vertex handle to delete it.
    if (tool === 'select') {
      const { id, handle } = elementIdFromTarget(e.target);
      if (id === PLOT_ID && handle?.kind === 'plot-vertex' && doc.plot.boundary.length > 3) {
        pushHistory();
        const pts = doc.plot.boundary.filter((_, i) => i !== handle.index);
        setPlotBoundary(pts);
        setSelectedPlotVertices([]);
        return true;
      }
      const bo = doc.plot.buildableOverride;
      if (id === BUILDABLE_ID && handle?.kind === 'buildable-vertex' && bo && bo.length > 3) {
        pushHistory();
        updatePlot({ buildableOverride: bo.filter((_, i) => i !== handle.index) });
        return true;
      }
    }
    return false;
  };

  // Keyboard: digits open the length input, Escape cancels, Enter closes,
  // R rotates selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      // Typed-length entry: start typing a number while drawing a segment.
      const drawing =
        (tool === 'plot' || tool === 'room' || tool === 'wall' || tool === 'beam') && drawAnchor !== null;
      if (drawing && typedLength === null && /^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        setTypedLength(e.key);
        return;
      }
      if (e.key === 'Escape') {
        if (typedLength !== null || lengthLock !== null) {
          setTypedLength(null);
          setLengthLock(null);
        } else if (draft.length > 0 || anchor) {
          setDraft([]);
          setAnchor(null);
        } else if (tool !== 'select') {
          setTool('select');
        } else {
          setSelection([]);
        }
      } else if (e.key === 'Enter') {
        if (tool === 'plot' || tool === 'room') closePolygon();
        if (tool === 'wall') setAnchor(null);
      } else if ((e.key === 'r' || e.key === 'R') && tool === 'select' && selectedIds.length > 0) {
        pushHistory();
        for (const id of selectedIds) {
          updateElement(id, (el) => {
            if (
              el.type === 'furniture' ||
              el.type === 'column' ||
              el.type === 'staircase' ||
              el.type === 'roof' ||
              el.type === 'note'
            ) {
              el.transform.rotation += Math.PI / 4;
            }
          });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---------------------------------------------------------------- overlay

  // With a locked length the preview pins to exactly that distance.
  const previewPt = hover ? applyLengthLock(hover.point) : null;

  const overlay = (
    <>
      {/* polygon draft (plot / room) */}
      {(tool === 'plot' || tool === 'room') && draft.length > 0 && (
        <Group listening={false}>
          <Line
            points={draft.flatMap((p) => [p.x, p.y])}
            stroke={tool === 'plot' ? '#7a6f4f' : '#4f8cff'}
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
          {previewPt && (
            <>
              <Line
                points={[draft.at(-1)!.x, draft.at(-1)!.y, previewPt.x, previewPt.y]}
                stroke={tool === 'plot' ? '#7a6f4f' : '#4f8cff'}
                strokeWidth={1}
                strokeScaleEnabled={false}
                dash={[3, 3]}
              />
              <DimLabel
                a={draft.at(-1)!}
                b={previewPt}
                vpScale={viewport.scale}
                unit={unit}
                color={lengthLock !== null ? '#e8437a' : undefined}
              />
            </>
          )}
          {draft.map((p, i) => (
            <Circle
              key={i}
              x={p.x}
              y={p.y}
              radius={(i === 0 && draft.length >= 3 ? 6 : 3.5) / viewport.scale}
              fill={i === 0 && draft.length >= 3 ? '#34c98e' : '#ffffff'}
              stroke="#5f5a4e"
              strokeWidth={1}
              strokeScaleEnabled={false}
            />
          ))}
        </Group>
      )}

      {/* wall / beam preview */}
      {(tool === 'wall' || tool === 'beam') && anchor && previewPt && (
        <Group listening={false}>
          {tool === 'wall' &&
            (() => {
              const dir = norm(sub(previewPt, anchor));
              const n = perp(dir);
              const th = 0.23 / 2;
              const c = [
                add(anchor, vscale(n, th)),
                add(previewPt, vscale(n, th)),
                add(previewPt, vscale(n, -th)),
                add(anchor, vscale(n, -th)),
              ];
              return (
                <Line
                  points={c.flatMap((p) => [p.x, p.y])}
                  closed
                  fill="rgba(90,84,72,0.25)"
                  stroke="#5a5448"
                  strokeWidth={1}
                  strokeScaleEnabled={false}
                />
              );
            })()}
          <Line
            points={[anchor.x, anchor.y, previewPt.x, previewPt.y]}
            stroke="#5a5448"
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[4, 3]}
          />
          <DimLabel
            a={anchor}
            b={previewPt}
            vpScale={viewport.scale}
            unit={unit}
            offsetM={-0.35}
            color={lengthLock !== null ? '#e8437a' : undefined}
          />
        </Group>
      )}

      {/* opening preview */}
      {openingPreview &&
        (() => {
          const p = openingPreview;
          const ang = (Math.atan2(p.wallDir.y, p.wallDir.x) * 180) / Math.PI;
          return (
            <Group listening={false} x={p.center.x} y={p.center.y} rotation={ang}>
              <Rect
                x={-p.width / 2}
                y={-(p.thickness / 2 + 0.06)}
                width={p.width}
                height={p.thickness + 0.12}
                fill={p.valid ? 'rgba(52,201,142,0.4)' : 'rgba(229,89,94,0.4)'}
                stroke={p.valid ? '#1d9d6c' : '#e5595e'}
                strokeWidth={1}
                strokeScaleEnabled={false}
              />
            </Group>
          );
        })()}

      {/* furniture ghost */}
      {tool === 'furniture' &&
        hover &&
        activeCatalogId &&
        (() => {
          const def = catalogItemById(activeCatalogId);
          if (!def) return null;
          return (
            <Group listening={false} x={hover.point.x} y={hover.point.y} opacity={0.6}>
              <Rect
                x={-def.width / 2}
                y={-def.depth / 2}
                width={def.width}
                height={def.depth}
                fill="rgba(79,140,255,0.25)"
                stroke="#4f8cff"
                strokeWidth={1}
                strokeScaleEnabled={false}
                cornerRadius={0.03}
              />
              <Text
                text={def.name}
                fontSize={10 / viewport.scale}
                fill="#2f6fee"
                x={-def.width / 2}
                y={def.depth / 2 + 2 / viewport.scale}
                width={Math.max(def.width, 1.4)}
              />
            </Group>
          );
        })()}

      {/* roof preview rect */}
      {tool === 'roof' && anchor && hover && (
        <Group listening={false}>
          <Rect
            x={Math.min(anchor.x, hover.point.x)}
            y={Math.min(anchor.y, hover.point.y)}
            width={Math.abs(hover.point.x - anchor.x)}
            height={Math.abs(hover.point.y - anchor.y)}
            stroke="#8a6845"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
            dash={[8, 5]}
            fill="rgba(138,104,69,0.08)"
          />
          <DimLabel a={anchor} b={{ x: hover.point.x, y: anchor.y }} vpScale={viewport.scale} unit={unit} offsetM={-0.3} />
          <DimLabel a={anchor} b={{ x: anchor.x, y: hover.point.y }} vpScale={viewport.scale} unit={unit} offsetM={0.3} />
        </Group>
      )}

      {/* measure tool */}
      {tool === 'measure' && anchor && hover && (
        <Group listening={false}>
          <Line
            points={[anchor.x, anchor.y, hover.point.x, hover.point.y]}
            stroke="#e8437a"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
          <DimLabel a={anchor} b={hover.point} vpScale={viewport.scale} unit={unit} offsetM={-0.2} color="#e8437a" />
        </Group>
      )}
      {tool === 'measure' && frozenMeasure && (
        <Group listening={false}>
          <Line
            points={[frozenMeasure.a.x, frozenMeasure.a.y, frozenMeasure.b.x, frozenMeasure.b.y]}
            stroke="#e8437a"
            strokeWidth={1.5}
            strokeScaleEnabled={false}
          />
          {[frozenMeasure.a, frozenMeasure.b].map((p, i) => (
            <Circle key={i} x={p.x} y={p.y} radius={3.5 / viewport.scale} fill="#e8437a" />
          ))}
          <DimLabel a={frozenMeasure.a} b={frozenMeasure.b} vpScale={viewport.scale} unit={unit} offsetM={-0.2} color="#e8437a" />
        </Group>
      )}

      {/* marquee */}
      {marquee && (
        <Rect
          listening={false}
          x={Math.min(marquee.a.x, marquee.b.x)}
          y={Math.min(marquee.a.y, marquee.b.y)}
          width={Math.abs(marquee.b.x - marquee.a.x)}
          height={Math.abs(marquee.b.y - marquee.a.y)}
          fill="rgba(79,140,255,0.08)"
          stroke="#4f8cff"
          strokeWidth={1}
          strokeScaleEnabled={false}
          dash={[4, 3]}
        />
      )}

      {/* alignment guides */}
      {guides &&
        [...guides.v.map((x) => ['v', x] as const), ...guides.h.map((y) => ['h', y] as const)].map(([axis, v], i) => (
          <Line
            key={`${axis}${i}`}
            listening={false}
            points={axis === 'v' ? [v, -500, v, 500] : [-500, v, 500, v]}
            stroke="#e8437a"
            strokeWidth={1}
            strokeScaleEnabled={false}
            dash={[6, 4]}
          />
        ))}

      {/* collision warning around the dragged item */}
      {collides &&
        (() => {
          const id = dragRef.current?.ids[0] ?? selectedIds[0];
          const el = level?.elements.find((e2) => e2.id === id);
          if (!el || !('position' in el.transform)) return null;
          if (el.type !== 'furniture' && el.type !== 'column' && el.type !== 'staircase') return null;
          const box = obbAabb({
            c: { x: el.transform.position.x, y: el.transform.position.y },
            w: el.dimensions.width,
            d: el.dimensions.depth,
            rot: el.transform.rotation,
          });
          return (
            <Rect
              listening={false}
              x={box.min.x - 0.06}
              y={box.min.y - 0.06}
              width={box.max.x - box.min.x + 0.12}
              height={box.max.y - box.min.y + 0.12}
              stroke="#e5595e"
              strokeWidth={2}
              strokeScaleEnabled={false}
              dash={[6, 4]}
            />
          );
        })()}

      {/* snap indicator */}
      {hover && hover.kind !== 'none' && tool !== 'select' && (
        <Circle
          listening={false}
          x={hover.point.x}
          y={hover.point.y}
          radius={5 / viewport.scale}
          stroke={SNAP_COLORS[hover.kind] ?? '#b3a98f'}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      )}
      {hover && hover.kind !== 'none' && tool === 'select' && dragRef.current && (
        <Circle
          listening={false}
          x={hover.point.x}
          y={hover.point.y}
          radius={5 / viewport.scale}
          stroke={SNAP_COLORS[hover.kind] ?? '#b3a98f'}
          strokeWidth={1.5}
          strokeScaleEnabled={false}
        />
      )}
    </>
  );

  // ------------------------------------------------------------------- hud

  const hud =
    typedLength !== null || lengthLock !== null ? (
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
        <div className="anim-scale-in pointer-events-auto flex items-center gap-2 rounded-lg border border-edge bg-surface-1/95 px-3 py-2 shadow-xl backdrop-blur">
          {typedLength !== null ? (
            <>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">Length</span>
              <input
                autoFocus
                value={typedLength}
                onChange={(e) => setTypedLength(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    const v = parseLength(typedLength, unit);
                    if (v !== null && v > 0.005) {
                      setLengthLock(v);
                    }
                    setTypedLength(null);
                  } else if (e.key === 'Escape') {
                    setTypedLength(null);
                  }
                }}
                className="h-7 w-32 rounded border border-accent bg-surface-2 px-2 text-xs text-ink focus:outline-none"
              />
              <span className="text-[10px] text-ink-faint">
                {unit === 'metric' ? `m — or 36.4ft · 350cm · 11'6"` : `ft — or 3.5m · 3500mm`} · Enter locks
              </span>
            </>
          ) : (
            <>
              <span className="text-xs font-semibold text-[#e8437a]">
                Length locked · {formatLength(lengthLock!, unit)}
              </span>
              <span className="text-[10px] text-ink-faint">
                move to aim, click to place exactly · Esc / right-click clears
              </span>
            </>
          )}
        </div>
      </div>
    ) : null;

  const cursor =
    tool === 'select' ? 'default' : tool === 'furniture' && !activeCatalogId ? 'not-allowed' : 'crosshair';

  return { onMouseDown, onMouseMove, onMouseUp, onDblClick, onRightClick, overlay, hud, cursor };
}
