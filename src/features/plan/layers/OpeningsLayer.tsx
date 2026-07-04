import { Group, Line, Rect } from 'react-konva';
import type { OpeningElement, WallElement } from '../../../types';
import { isOpening, isWall } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { add, norm, scale as vscale, sub } from '../../../geometry/vec';
import { wallThickness } from '../../../geometry/walls';
import { DoorSwing } from '../symbols2d';

const PAPER = '#f4f2ec';
const S = '#4a463d';

/** Door/window symbols drawn over the wall fill; they follow their host wall. */
export function OpeningsLayer() {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const selectedIds = useDesignStore((s) => s.selectedIds);
  if (!level) return null;

  const walls = level.elements.filter(isWall);
  const openings = level.elements.filter(isOpening);

  return (
    <Group>
      {openings.map((o: OpeningElement) => {
        const host: WallElement | undefined = walls.find((w) => w.id === o.wallId);
        if (!host || o.visible === false) return null;
        const dir = norm(sub(host.end, host.start));
        const center = add(host.start, vscale(dir, o.offset));
        const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
        const th = wallThickness(host);
        const w = o.dimensions.width;
        const selected = selectedIds.includes(o.id);

        return (
          <Group key={o.id} x={center.x} y={center.y} rotation={angle} elementId={o.id}>
            {/* gap in the wall */}
            <Rect x={-w / 2} y={-th / 2 - 0.008} width={w} height={th + 0.016} fill={PAPER} />
            {/* jambs */}
            <Line points={[-w / 2, -th / 2, -w / 2, th / 2]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />
            <Line points={[w / 2, -th / 2, w / 2, th / 2]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />

            {o.type === 'door' ? (
              <DoorSwing width={w} swing={o.swing ?? 1} style={o.style} />
            ) : (
              <>
                {/* window: frame + glazing lines + mullions */}
                <Rect x={-w / 2} y={-th / 2} width={w} height={th} stroke={S} strokeWidth={0.9} strokeScaleEnabled={false} />
                <Line points={[-w / 2, -th / 6, w / 2, -th / 6]} stroke={S} strokeWidth={0.9} strokeScaleEnabled={false} />
                <Line points={[-w / 2, th / 6, w / 2, th / 6]} stroke={S} strokeWidth={0.9} strokeScaleEnabled={false} />
                {Array.from(
                  { length: o.mullions ?? (o.style === 'sliding' || o.style === 'casement' ? 1 : 0) },
                  (_, i) => {
                    const n = (o.mullions ?? 1) + 1;
                    const x = -w / 2 + ((i + 1) * w) / n;
                    return <Line key={i} points={[x, -th / 2, x, th / 2]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />;
                  },
                )}
                {o.style === 'casement' && (
                  <>
                    <Line points={[-w / 2, -th / 2, -w / 4, -th / 2 - 0.12]} stroke={S} strokeWidth={0.8} strokeScaleEnabled={false} />
                    <Line points={[w / 2, -th / 2, w / 4, -th / 2 - 0.12]} stroke={S} strokeWidth={0.8} strokeScaleEnabled={false} />
                  </>
                )}
              </>
            )}

            {selected && (
              <Rect
                x={-w / 2 - 0.06}
                y={-Math.max(th, w) / 2 - 0.06}
                width={w + 0.12}
                height={Math.max(th, w) + 0.12}
                stroke="#2f6fee"
                strokeWidth={1.5}
                strokeScaleEnabled={false}
                dash={[5, 3]}
                listening={false}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}
