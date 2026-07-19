import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Group, Layer, Line, Rect, Stage, Text } from 'react-konva';
import type { FacadeElementItem, Point } from '../../types';
import { useActiveFacade, useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { useElementSize } from '../../hooks/useElementSize';
import { facadeItemById, makeFacadeElement } from '../../library/facadeCatalog';
import { formatLength } from '../../geometry/units';
import { pointerWorld, zoomAt, type Viewport } from '../plan/viewport';
import { exportRegistry } from '../export/registry';
import { FacadeSymbolShape } from './facadeSymbols';

/**
 * Façade composer. Coordinates: x = meters along the façade, screen y = -z
 * (heights point up). The ground line is y = 0.
 */

const GRID = 0.1; // placement snap, meters

interface DragState {
  id: string;
  grab: Point; // world (x, yScreen)
  orig: { x: number; z: number };
  pushed: boolean;
}

export function ElevationCanvas() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<Konva.Stage | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 140, y: 480, scale: 55 });
  const panRef = useRef<{ pointer: Point; vp: Viewport } | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);
  const [ghost, setGhost] = useState<Point | null>(null);

  const facade = useActiveFacade();
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const tool = useDesignStore((s) => s.tool);
  const setTool = useDesignStore((s) => s.setTool);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const setSelection = useDesignStore((s) => s.setSelection);
  const pushHistory = useDesignStore((s) => s.pushHistory);
  const addElement = useDesignStore((s) => s.addElement);
  const updateElement = useDesignStore((s) => s.updateElement);
  const activeCatalogId = useUiStore((s) => s.activeCatalogId);
  const showToast = useUiStore((s) => s.showToast);
  const setCursorWorld = useUiStore((s) => s.setCursorWorld);
  const pushRecent = useUiStore((s) => s.pushRecent);

  useEffect(() => {
    const stage = stageRef.current;
    exportRegistry.elevationStage = stage;
    return () => {
      if (exportRegistry.elevationStage === stage) exportRegistry.elevationStage = null;
    };
  });

  if (!facade) return null;

  const snap = (v: number) => Math.round(v / GRID) * GRID;

  const findTargetId = (target: Konva.Node | null): string | undefined => {
    let node: Konva.Node | null = target;
    while (node) {
      const id = node.getAttr('elementId') as string | undefined;
      if (id) return id;
      node = node.getParent();
    }
    return undefined;
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (e.evt.button === 1) {
      panRef.current = { pointer, vp: viewport };
      return;
    }
    if (e.evt.button !== 0) return;
    const world = pointerWorld(stage, viewport);
    if (!world) return;

    if (tool === 'facade-item') {
      if (!activeCatalogId) {
        showToast('Pick a component from the Façade Library first');
        return;
      }
      const def = facadeItemById(activeCatalogId);
      if (!def) return;
      const z = Math.max(def.height / 2, snap(-world.y));
      pushHistory();
      const placed = makeFacadeElement(activeCatalogId, { x: snap(world.x), y: z });
      addElement(placed, { facadeId: facade.id });
      pushRecent(activeCatalogId);
      // place once, return to Select — hold Shift to keep placing copies
      if (!e.evt.shiftKey) {
        useUiStore.getState().setActiveCatalogId(null);
        useDesignStore.getState().setTool('select');
        setSelection([placed.id]);
      }
      return;
    }

    // select tool
    const id = findTargetId(e.target);
    if (!id) {
      setSelection([]);
      return;
    }
    if (!selectedIds.includes(id)) setSelection([id]);
    const el = facade.elements.find((el2) => el2.id === id);
    if (el) {
      dragRef.current = {
        id,
        grab: world,
        orig: { x: el.transform.position.x, z: el.transform.position.z },
        pushed: false,
      };
    }
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    void e;
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (panRef.current) {
      const { pointer: p0, vp } = panRef.current;
      setViewport({ ...vp, x: vp.x + pointer.x - p0.x, y: vp.y + pointer.y - p0.y });
      return;
    }
    const world = pointerWorld(stage, viewport);
    setCursorWorld(world ? { x: world.x, y: -world.y } : null);
    if (!world) return;

    if (tool === 'facade-item') {
      setGhost(world);
      return;
    }

    const drag = dragRef.current;
    if (drag) {
      if (!drag.pushed) {
        if (Math.hypot(world.x - drag.grab.x, world.y - drag.grab.y) < 2 / viewport.scale) return;
        pushHistory();
        drag.pushed = true;
      }
      const el = facade.elements.find((el2) => el2.id === drag.id);
      const half = (el?.dimensions.height ?? 0) / 2;
      const nx = snap(drag.orig.x + (world.x - drag.grab.x));
      const nz = Math.max(half, snap(drag.orig.z - (world.y - drag.grab.y)));
      updateElement(drag.id, (el2) => {
        el2.transform.position.x = nx;
        el2.transform.position.z = nz;
      });
    }
  };

  const onMouseUp = () => {
    panRef.current = null;
    dragRef.current = null;
  };

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    setViewport((vp) => zoomAt(vp, pointer, e.evt.deltaY > 0 ? 1 / 1.1 : 1.1));
  };

  // ---- touch: single finger places/drags, two fingers pinch-zoom and pan.
  const asMouse = (e: KonvaEventObject<TouchEvent>): KonvaEventObject<MouseEvent> =>
    ({ ...e, evt: { button: 0, shiftKey: false } }) as unknown as KonvaEventObject<MouseEvent>;
  const touchPoints = (e: KonvaEventObject<TouchEvent>) => {
    const rect = stageRef.current?.container().getBoundingClientRect();
    if (!rect) return [];
    return Array.from(e.evt.touches).map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }));
  };
  const onTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length >= 2) {
      onMouseUp();
      const [p1, p2] = touchPoints(e);
      pinchRef.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      };
      return;
    }
    onMouseDown(asMouse(e));
  };
  const onTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    if (e.evt.touches.length >= 2 && pinchRef.current) {
      const [p1, p2] = touchPoints(e);
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      const prev = pinchRef.current;
      setViewport((vp) => {
        const zoomed = zoomAt(vp, center, dist / Math.max(1e-6, prev.dist));
        return { ...zoomed, x: zoomed.x + center.x - prev.center.x, y: zoomed.y + center.y - prev.center.y };
      });
      pinchRef.current = { dist, center };
      return;
    }
    onMouseMove(asMouse(e));
  };
  const onTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) pinchRef.current = null;
    onMouseUp();
  };

  const ghostDef = tool === 'facade-item' && activeCatalogId ? facadeItemById(activeCatalogId) : undefined;

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: 'var(--color-paper)',
        cursor: tool === 'facade-item' ? 'crosshair' : 'default',
        touchAction: 'none',
      }}
    >
      {size.width > 0 && (
        <Stage
          ref={stageRef}
          width={size.width}
          height={size.height}
          x={viewport.x}
          y={viewport.y}
          scaleX={viewport.scale}
          scaleY={viewport.scale}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseLeave={() => {
            setCursorWorld(null);
            setGhost(null);
          }}
          onContextMenu={(e) => e.evt.preventDefault()}
        >
          <Layer>
            {/* sky hint + façade backdrop */}
            <Rect
              x={0}
              y={-facade.height}
              width={facade.width}
              height={facade.height}
              fill={facade.backdropColor}
              stroke="#6b6353"
              strokeWidth={1.5}
              strokeScaleEnabled={false}
            />

            {/* façade elements: manual layer first, then big-behind-small */}
            {[...facade.elements]
              .sort(
                (a, b) =>
                  (a.layer ?? 0) - (b.layer ?? 0) ||
                  b.dimensions.height * b.dimensions.width - a.dimensions.height * a.dimensions.width,
              )
              .map((el: FacadeElementItem) => {
                const def = facadeItemById(el.catalogId);
                const selected = selectedIds.includes(el.id);
                const { width: w, height: h } = el.dimensions;
                return (
                  <Group
                    key={el.id}
                    x={el.transform.position.x}
                    y={-el.transform.position.z}
                    rotation={(el.transform.rotation * 180) / Math.PI}
                    elementId={el.id}
                  >
                    <Rect x={-w / 2} y={-h / 2} width={w} height={h} opacity={0} />
                    <FacadeSymbolShape kind={def?.symbol ?? 'panel'} w={w} h={h} color={el.material.color} />
                    {selected && (
                      <Rect
                        x={-w / 2 - 0.05}
                        y={-h / 2 - 0.05}
                        width={w + 0.1}
                        height={h + 0.1}
                        stroke="#2f6fee"
                        strokeWidth={1.6}
                        strokeScaleEnabled={false}
                        dash={[5, 3]}
                        listening={false}
                      />
                    )}
                  </Group>
                );
              })}

            {/* ground line */}
            <Line
              points={[-30, 0, facade.width + 30, 0]}
              stroke="#6b6353"
              strokeWidth={2}
              strokeScaleEnabled={false}
              listening={false}
            />

            {/* extent labels */}
            <Text
              text={`${facade.name} — ${formatLength(facade.width, unit)} × ${formatLength(facade.height, unit)}`}
              x={0}
              y={0.25}
              fontSize={13 / viewport.scale}
              fill="#8a8272"
              listening={false}
            />

            {/* placement ghost */}
            {ghost && ghostDef && (
              <Group
                x={Math.round(ghost.x / GRID) * GRID}
                y={-Math.max(ghostDef.height / 2, Math.round(-ghost.y / GRID) * GRID)}
                opacity={0.55}
                listening={false}
              >
                <FacadeSymbolShape
                  kind={ghostDef.symbol}
                  w={ghostDef.width}
                  h={ghostDef.height}
                  color="#9ec1e8"
                />
              </Group>
            )}
          </Layer>
        </Stage>
      )}

      {/* escape hatch back to select */}
      {tool === 'facade-item' && (
        <button
          onClick={() => setTool('select')}
          className="absolute right-3 top-3 rounded-md bg-surface-2 px-3 py-1.5 text-xs text-ink shadow"
        >
          Done placing (Esc)
        </button>
      )}
    </div>
  );
}
