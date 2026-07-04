import { useMemo } from 'react';
import { Group, Line, Shape } from 'react-konva';
import { VertexHandle } from '../VertexHandle';
import { isWall } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { wallOutline, wallThickness, wallsUnionOutlines } from '../../../geometry/walls';
import { DimLabel } from '../DimLabel';

const WALL_FILL = '#4a443a'; // architectural poché

interface Props {
  vpScale: number;
}

/**
 * Walls are drawn as ONE filled union shape (evenodd fill over all rings) so
 * corners/junctions read as continuous solid; selection + hit-testing use the
 * per-wall centerline.
 */
export function WallsLayer({ vpScale }: Props) {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const unit = useDesignStore((s) => s.doc.unitSystem);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const tool = useDesignStore((s) => s.tool);
  const showDimensions = useDesignStore((s) => s.showDimensions);

  const walls = useMemo(() => (level ? level.elements.filter(isWall) : []), [level]);
  const rings = useMemo(() => wallsUnionOutlines(walls.filter((w) => w.visible !== false)), [walls]);

  if (!level || walls.length === 0) return null;

  return (
    <Group>
      {/* union fill */}
      <Shape
        listening={false}
        sceneFunc={(context, shape) => {
          const ctx = context as unknown as CanvasRenderingContext2D & {
            _context: CanvasRenderingContext2D;
          };
          context.beginPath();
          for (const ring of rings) {
            if (ring.length < 3) continue;
            context.moveTo(ring[0].x, ring[0].y);
            for (let i = 1; i < ring.length; i++) context.lineTo(ring[i].x, ring[i].y);
            context.closePath();
          }
          ctx._context.fillStyle = WALL_FILL;
          ctx._context.fill('evenodd');
          context.strokeShape(shape);
        }}
        stroke="#332f28"
        strokeWidth={0.8}
        strokeScaleEnabled={false}
      />

      {/* per-wall hit lines + selection highlight */}
      {walls.map((w) => {
        const selected = selectedIds.includes(w.id);
        const th = wallThickness(w);
        return (
          <Group key={w.id}>
            <Line
              points={[w.start.x, w.start.y, w.end.x, w.end.y]}
              stroke="#000"
              opacity={0}
              strokeWidth={Math.max(th, 14 / vpScale)}
              elementId={w.id}
            />
            {selected && (
              <>
                <Line
                  points={wallOutline(w, walls).flatMap((p) => [p.x, p.y])}
                  closed
                  stroke="#4f8cff"
                  strokeWidth={1.8}
                  strokeScaleEnabled={false}
                  fill="rgba(79,140,255,0.18)"
                  listening={false}
                />
                {tool === 'select' &&
                  (['start', 'end'] as const).map((end) => (
                    <VertexHandle
                      key={end}
                      x={w[end].x}
                      y={w[end].y}
                      vpScale={vpScale}
                      elementId={w.id}
                      handle={{ kind: 'wall-end', end }}
                    />
                  ))}
              </>
            )}
            {(showDimensions || selected) && (
              <DimLabel a={w.start} b={w.end} vpScale={vpScale} unit={unit} offsetM={-(th / 2 + 0.28)} color="#8a8272" />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
