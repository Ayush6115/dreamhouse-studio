import { useMemo } from 'react';
import { Group, Line, Rect, Shape } from 'react-konva';
import { isWall } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { wallsUnionOutlines } from '../../../geometry/walls';

const GHOST = 'rgba(90, 96, 110, 0.28)';

/**
 * Faded underlay of the level BELOW the active one — walls, room outlines
 * and staircases — so upper floors can be aligned to the structure beneath.
 * Non-interactive; toggled from the Levels panel.
 */
export function GhostLayer() {
  const doc = useDesignStore((s) => s.doc);
  const activeLevelId = useDesignStore((s) => s.activeLevelId);
  const showGhost = useDesignStore((s) => s.showLevelGhost);

  const below = useMemo(() => {
    if (!showGhost) return null;
    const active = doc.levels.find((l) => l.id === activeLevelId);
    if (!active) return null;
    const lower = doc.levels
      .filter((l) => l.elevation < active.elevation)
      .sort((a, b) => b.elevation - a.elevation);
    return lower[0] ?? null;
  }, [doc, activeLevelId, showGhost]);

  const rings = useMemo(
    () => (below ? wallsUnionOutlines(below.elements.filter(isWall)) : []),
    [below],
  );

  if (!below) return null;

  return (
    <Group listening={false}>
      <Shape
        sceneFunc={(context, shape) => {
          const ctx = context as unknown as { _context: CanvasRenderingContext2D };
          context.beginPath();
          for (const ring of rings) {
            if (ring.length < 3) continue;
            context.moveTo(ring[0].x, ring[0].y);
            for (let i = 1; i < ring.length; i++) context.lineTo(ring[i].x, ring[i].y);
            context.closePath();
          }
          ctx._context.fillStyle = GHOST;
          ctx._context.fill('evenodd');
          void shape;
        }}
      />
      {below.elements.map((el) => {
        if (el.type === 'room' && el.boundary.length >= 3) {
          return (
            <Line
              key={el.id}
              points={el.boundary.flatMap((p) => [p.x, p.y])}
              closed
              stroke={GHOST}
              strokeWidth={1}
              strokeScaleEnabled={false}
              dash={[4, 4]}
            />
          );
        }
        if (el.type === 'staircase') {
          const { width: w, depth: d } = el.dimensions;
          return (
            <Group
              key={el.id}
              x={el.transform.position.x}
              y={el.transform.position.y}
              rotation={(el.transform.rotation * 180) / Math.PI}
            >
              <Rect x={-w / 2} y={-d / 2} width={w} height={d} stroke={GHOST} strokeWidth={1.5} strokeScaleEnabled={false} dash={[6, 4]} />
              <Line points={[-w / 2, -d / 2, w / 2, d / 2]} stroke={GHOST} strokeWidth={1} strokeScaleEnabled={false} />
            </Group>
          );
        }
        return null;
      })}
    </Group>
  );
}
