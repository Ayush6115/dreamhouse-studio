import { useEffect, useRef, useState } from 'react';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { Layer, Stage } from 'react-konva';
import { useElementSize } from '../../hooks/useElementSize';
import { useDesignStore } from '../../store/designStore';
import { useUiStore } from '../../store/uiStore';
import { GridLayer } from './GridLayer';
import { elementIdFromTarget, usePlanTools } from './tools';
import { PlanContextMenu } from './PlanContextMenu';
import { pointerWorld, zoomAt, type Viewport } from './viewport';
import { exportRegistry } from '../export/registry';
import { PlotLayer } from './layers/PlotLayer';
import { RoomsLayer } from './layers/RoomsLayer';
import { WallsLayer } from './layers/WallsLayer';
import { OpeningsLayer } from './layers/OpeningsLayer';
import { ItemsLayer } from './layers/ItemsLayer';
import { RoofsLayer } from './layers/RoofsLayer';
import { GhostLayer } from './layers/GhostLayer';
import { BuildableLayer } from './layers/BuildableLayer';

/** The 2D drafting canvas: pan/zoom viewport + all plan layers + tools. */
export function PlanCanvas() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  const [viewport, setViewport] = useState<Viewport>({ x: 120, y: 120, scale: 50 });
  const stageRef = useRef<Konva.Stage | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);
  const panRef = useRef<{ pointer: { x: number; y: number }; vp: Viewport } | null>(null);

  const gridSize = useDesignStore((s) => s.gridSize);
  const setCursorWorld = useUiStore((s) => s.setCursorWorld);
  const setZoom = useUiStore((s) => s.setZoom);
  const tool = useDesignStore((s) => s.tool);
  const setTool = useDesignStore((s) => s.setTool);
  const isEmpty = useDesignStore(
    (s) =>
      s.doc.plot.boundary.length < 3 &&
      (s.doc.levels.find((l) => l.id === s.activeLevelId)?.elements.length ?? 0) === 0,
  );

  const tools = usePlanTools(viewport);

  useEffect(() => setZoom(viewport.scale), [viewport.scale, setZoom]);

  // Expose the stage to the export pipeline.
  useEffect(() => {
    const stage = stageRef.current;
    exportRegistry.planStage = stage;
    return () => {
      if (exportRegistry.planStage === stage) exportRegistry.planStage = null;
    };
  });

  // Space-to-pan.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const onWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = e.evt.deltaY > 0 ? 1 / 1.1 : 1.1;
    setViewport((vp) => zoomAt(vp, pointer, factor));
  };

  const onMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    if (e.evt.button === 1 || (e.evt.button === 0 && spaceDown)) {
      e.evt.preventDefault();
      panRef.current = { pointer, vp: viewport };
      return;
    }
    const world = pointerWorld(stage, viewport);
    if (world) tools.onMouseDown(world, e);
  };

  const onMouseMove = (e: KonvaEventObject<MouseEvent>) => {
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
    setCursorWorld(world);
    if (world) tools.onMouseMove(world, e);
  };

  const onMouseUp = (e: KonvaEventObject<MouseEvent>) => {
    panRef.current = null;
    const stage = stageRef.current;
    const world = stage && pointerWorld(stage, viewport);
    if (world) tools.onMouseUp(world, e);
  };

  const onDblClick = (e: KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    const world = stage && pointerWorld(stage, viewport);
    if (world) tools.onDblClick(world, e);
  };

  // ---- touch: single finger draws/selects, two fingers pinch-zoom and pan.
  const pinchRef = useRef<{ dist: number; center: { x: number; y: number } } | null>(null);

  const asMouse = (e: KonvaEventObject<TouchEvent>): KonvaEventObject<MouseEvent> =>
    ({ ...e, evt: { button: 0, shiftKey: false } }) as unknown as KonvaEventObject<MouseEvent>;

  const touchPoints = (e: KonvaEventObject<TouchEvent>) => {
    const rect = stageRef.current?.container().getBoundingClientRect();
    if (!rect) return [];
    return Array.from(e.evt.touches).map((t) => ({ x: t.clientX - rect.left, y: t.clientY - rect.top }));
  };

  const onTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length >= 2) {
      // Entering pinch: cancel any in-progress single-touch gesture.
      tools.onMouseUp({ x: 0, y: 0 }, asMouse(e));
      const [p1, p2] = touchPoints(e);
      pinchRef.current = {
        dist: Math.hypot(p2.x - p1.x, p2.y - p1.y),
        center: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      };
      return;
    }
    const stage = stageRef.current;
    const world = stage && pointerWorld(stage, viewport);
    if (world) tools.onMouseDown(world, asMouse(e));
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
    const stage = stageRef.current;
    const world = stage && pointerWorld(stage, viewport);
    if (world) {
      setCursorWorld(world);
      tools.onMouseMove(world, asMouse(e));
    }
  };

  const onTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    if (e.evt.touches.length < 2) pinchRef.current = null;
    tools.onMouseUp({ x: 0, y: 0 }, asMouse(e));
  };

  const onContextMenu = (e: KonvaEventObject<MouseEvent>) => {
    e.evt.preventDefault();
    // Drawing tools consume right-clicks (undo last point / cancel / delete vertex).
    const stage = stageRef.current;
    const world = stage && pointerWorld(stage, viewport);
    if (world && tools.onRightClick(world, e)) {
      setMenu(null);
      return;
    }
    const { id } = elementIdFromTarget(e.target);
    if (!id || id.startsWith('@')) {
      setMenu(null);
      return;
    }
    const { selectedIds, setSelection } = useDesignStore.getState();
    if (!selectedIds.includes(id)) setSelection([id]);
    setMenu({ x: e.evt.offsetX, y: e.evt.offsetY, id });
  };

  return (
    <div
      ref={ref}
      className="relative h-full w-full overflow-hidden"
      style={{
        background: 'var(--color-paper)',
        cursor: spaceDown || panRef.current ? 'grab' : tools.cursor,
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
          onDblClick={onDblClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onDblTap={(e) => onDblClick(e as unknown as KonvaEventObject<MouseEvent>)}
          onMouseLeave={() => setCursorWorld(null)}
          onContextMenu={onContextMenu}
        >
          <GridLayer viewport={viewport} width={size.width} height={size.height} gridSize={gridSize} />
          <Layer>
            <PlotLayer vpScale={viewport.scale} />
            <GhostLayer />
            <RoomsLayer vpScale={viewport.scale} />
            <ItemsLayer />
            <WallsLayer vpScale={viewport.scale} />
            <OpeningsLayer />
            <RoofsLayer vpScale={viewport.scale} />
            <BuildableLayer vpScale={viewport.scale} />
          </Layer>
          <Layer listening={false}>{tools.overlay}</Layer>
        </Stage>
      )}
      {menu && <PlanContextMenu x={menu.x} y={menu.y} targetId={menu.id} onClose={() => setMenu(null)} />}
      {tools.hud}

      {/* onboarding for an empty design */}
      {isEmpty && tool === 'select' && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="anim-scale-in pointer-events-auto w-80 rounded-xl border border-edge bg-surface-1/95 p-5 text-center shadow-2xl backdrop-blur">
            <h2 className="mb-1 text-sm font-semibold text-ink">Design your dream home</h2>
            <p className="mb-4 text-xs leading-relaxed text-ink-dim">
              Start with the plot boundary, raise walls, then furnish and explore in 3D.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setTool('plot')}
                className="rounded-md bg-accent-strong px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-accent"
              >
                1 · Draw the plot <span className="opacity-70">(P)</span>
              </button>
              <button
                onClick={() => setTool('wall')}
                className="rounded-md bg-surface-2 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-surface-3"
              >
                2 · Draw walls <span className="text-ink-faint">(W)</span>
              </button>
            </div>
            <p className="mt-3 text-[10px] text-ink-faint">Scroll to zoom · hold Space to pan</p>
          </div>
        </div>
      )}
    </div>
  );
}
