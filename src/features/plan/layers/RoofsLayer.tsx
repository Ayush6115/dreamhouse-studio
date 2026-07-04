import { Group, Line, Rect, Text } from 'react-konva';
import type { RoofElement } from '../../../types';
import { useDesignStore } from '../../../store/designStore';
import { roofGeometry } from '../../../geometry/roof';

const deg = (rad: number) => (rad * 180) / Math.PI;
const ROOF = '#8a6845';

interface Props {
  vpScale: number;
}

/** Roof plan symbols: dashed eave outline, ridge, slope arrows, skylights. */
export function RoofsLayer({ vpScale }: Props) {
  const level = useDesignStore((s) => s.doc.levels.find((l) => l.id === s.activeLevelId));
  const selectedIds = useDesignStore((s) => s.selectedIds);
  if (!level) return null;

  const roofs = level.elements.filter((e): e is RoofElement => e.type === 'roof');

  return (
    <Group>
      {roofs.map((roof) => {
        if (roof.visible === false) return null;
        const selected = selectedIds.includes(roof.id);
        const W = roof.dimensions.width + 2 * roof.overhang;
        const D = roof.dimensions.depth + 2 * roof.overhang;
        const geo = roofGeometry(roof.roofStyle, W, D, roof.pitch, roof.dimensions.thickness ?? 0.15);
        const stroke = selected ? '#2f6fee' : ROOF;

        // Slope arrows point downhill from the ridge.
        const arrows: { from: [number, number]; to: [number, number] }[] = [];
        const ar = Math.min(W, D) * 0.22;
        if (roof.roofStyle === 'shed') arrows.push({ from: [0, -D * 0.2], to: [0, -D * 0.2 + ar] });
        if (roof.roofStyle === 'gable' || roof.roofStyle === 'hip' || roof.roofStyle === 'barrel') {
          arrows.push({ from: [0, -ar * 0.2], to: [0, -ar * 1.1] }, { from: [0, ar * 0.2], to: [0, ar * 1.1] });
          if (roof.roofStyle === 'hip') {
            arrows.push({ from: [-ar * 0.2, 0], to: [-ar * 1.1, 0] }, { from: [ar * 0.2, 0], to: [ar * 1.1, 0] });
          }
        }

        return (
          <Group
            key={roof.id}
            x={roof.transform.position.x}
            y={roof.transform.position.y}
            rotation={deg(roof.transform.rotation)}
            elementId={roof.id}
          >
            {/* eave outline (visual only — clicks pass through the fill so the
                plan beneath stays selectable) */}
            <Rect
              x={-W / 2}
              y={-D / 2}
              width={W}
              height={D}
              stroke={stroke}
              strokeWidth={selected ? 2 : 1.4}
              strokeScaleEnabled={false}
              dash={[9, 5]}
              fill="rgba(138,104,69,0.07)"
              listening={false}
            />
            {/* hit area: the outline itself (hit width in world units) */}
            <Rect
              x={-W / 2}
              y={-D / 2}
              width={W}
              height={D}
              stroke="#000"
              opacity={0}
              strokeWidth={2}
              hitStrokeWidth={16 / vpScale}
              fillEnabled={false}
            />
            {/* footprint (wall line) */}
            <Rect
              x={-roof.dimensions.width / 2}
              y={-roof.dimensions.depth / 2}
              width={roof.dimensions.width}
              height={roof.dimensions.depth}
              stroke={stroke}
              strokeWidth={0.8}
              strokeScaleEnabled={false}
              dash={[3, 3]}
              listening={false}
            />
            {geo.ridge && (
              <Line
                points={[geo.ridge[0].x, geo.ridge[0].y, geo.ridge[1].x, geo.ridge[1].y]}
                stroke={stroke}
                strokeWidth={2}
                strokeScaleEnabled={false}
                listening={false}
              />
            )}
            {/* hip lines from corners to ridge ends */}
            {roof.roofStyle === 'hip' && geo.ridge && (
              <>
                {[
                  [-W / 2, -D / 2, geo.ridge[0].x, geo.ridge[0].y],
                  [-W / 2, D / 2, geo.ridge[0].x, geo.ridge[0].y],
                  [W / 2, -D / 2, geo.ridge[1].x, geo.ridge[1].y],
                  [W / 2, D / 2, geo.ridge[1].x, geo.ridge[1].y],
                ].map((pts, i) => (
                  <Line key={i} points={pts} stroke={stroke} strokeWidth={1} strokeScaleEnabled={false} listening={false} />
                ))}
              </>
            )}
            {arrows.map((a, i) => (
              <Group key={`a${i}`} listening={false}>
                <Line points={[a.from[0], a.from[1], a.to[0], a.to[1]]} stroke={stroke} strokeWidth={1.2} strokeScaleEnabled={false} />
                {(() => {
                  const dx = a.to[0] - a.from[0];
                  const dy = a.to[1] - a.from[1];
                  const l = Math.hypot(dx, dy) || 1;
                  const ux = dx / l;
                  const uy = dy / l;
                  const s = 0.14;
                  return (
                    <Line
                      points={[
                        a.to[0] - ux * s - uy * s * 0.6,
                        a.to[1] - uy * s + ux * s * 0.6,
                        a.to[0],
                        a.to[1],
                        a.to[0] - ux * s + uy * s * 0.6,
                        a.to[1] - uy * s - ux * s * 0.6,
                      ]}
                      stroke={stroke}
                      strokeWidth={1.2}
                      strokeScaleEnabled={false}
                    />
                  );
                })()}
              </Group>
            ))}
            {/* dormers */}
            {roof.dormers.map((dm, i) => {
              const depth = Math.max(0.6, dm.width * 0.85);
              const s = dm.y >= 0 ? 1 : -1;
              return (
                <Group key={`dm${i}`} x={dm.x} y={dm.y} listening={false}>
                  <Rect
                    x={-dm.width / 2}
                    y={s === 1 ? -depth : 0}
                    width={dm.width}
                    height={depth}
                    stroke={stroke}
                    strokeWidth={1.4}
                    strokeScaleEnabled={false}
                    fill="rgba(236,232,223,0.85)"
                  />
                  <Line
                    points={[0, s === 1 ? -depth : 0, 0, s === 1 ? 0 : depth]}
                    stroke={stroke}
                    strokeWidth={1}
                    strokeScaleEnabled={false}
                  />
                </Group>
              );
            })}
            {/* skylights */}
            {roof.skylights.map((sk, i) => (
              <Group key={`sk${i}`} x={sk.x} y={sk.y} listening={false}>
                <Rect
                  x={-sk.width / 2}
                  y={-sk.depth / 2}
                  width={sk.width}
                  height={sk.depth}
                  stroke={stroke}
                  strokeWidth={1.2}
                  strokeScaleEnabled={false}
                  fill="rgba(170,201,221,0.5)"
                />
                <Line points={[-sk.width / 2, -sk.depth / 2, sk.width / 2, sk.depth / 2]} stroke={stroke} strokeWidth={0.8} strokeScaleEnabled={false} />
                <Line points={[sk.width / 2, -sk.depth / 2, -sk.width / 2, sk.depth / 2]} stroke={stroke} strokeWidth={0.8} strokeScaleEnabled={false} />
              </Group>
            ))}
            <Text
              text={`${roof.roofStyle} roof${roof.roofStyle === 'flat' ? '' : ` · ${roof.pitch}°`}`}
              fontSize={10.5 / vpScale}
              fill={stroke}
              x={-W / 2 + 0.12}
              y={-D / 2 + 0.1}
              listening={false}
            />
          </Group>
        );
      })}
    </Group>
  );
}
