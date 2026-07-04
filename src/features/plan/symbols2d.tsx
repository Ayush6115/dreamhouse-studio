import { Arc, Circle, Ellipse, Group, Line, Rect } from 'react-konva';
import type { Symbol2D } from '../../library/catalog';

/**
 * Schematic 2D architectural symbols for library items (placeholder-grade by
 * design — see the notice in library/catalog.ts). Each symbol is drawn
 * centered at the origin in a w × d meter box, +y toward the item's "front".
 */

interface SymbolProps {
  kind: Symbol2D;
  w: number; // width, m
  d: number; // depth, m
  color: string;
}

const S = '#4a463d'; // stroke
const F = 'rgba(255,255,255,0.55)'; // fill

const thin = { stroke: S, strokeWidth: 1, strokeScaleEnabled: false } as const;

export function Symbol2DShape({ kind, w, d, color }: SymbolProps) {
  const hw = w / 2;
  const hd = d / 2;
  const body = <Rect x={-hw} y={-hd} width={w} height={d} fill={F} {...thin} cornerRadius={0.02} />;

  switch (kind) {
    case 'bed':
      return (
        <Group>
          {body}
          {/* pillows */}
          <Rect x={-hw + 0.08} y={-hd + 0.08} width={w / 2 - 0.14} height={0.35} {...thin} cornerRadius={0.05} />
          {w > 1.2 && (
            <Rect x={0.06} y={-hd + 0.08} width={w / 2 - 0.14} height={0.35} {...thin} cornerRadius={0.05} />
          )}
          {/* blanket fold */}
          <Line points={[-hw, -hd + 0.6, hw, -hd + 0.6]} {...thin} />
        </Group>
      );
    case 'sofa':
      return (
        <Group>
          {body}
          <Rect x={-hw + 0.12} y={-hd + 0.12} width={w - 0.24} height={d - 0.24} {...thin} cornerRadius={0.04} />
          <Line points={[-hw + 0.12, -hd + 0.12 + (d - 0.24) * 0.35, hw - 0.12, -hd + 0.12 + (d - 0.24) * 0.35]} {...thin} />
        </Group>
      );
    case 'sofa-l':
      return (
        <Group>
          <Line
            points={[-hw, -hd, hw, -hd, hw, -hd + 0.9, -hw + 0.9, -hd + 0.9, -hw + 0.9, hd, -hw, hd]}
            closed
            fill={F}
            {...thin}
          />
          <Line points={[-hw + 0.25, -hd + 0.25, hw - 0.2, -hd + 0.25]} {...thin} />
          <Line points={[-hw + 0.25, -hd + 0.25, -hw + 0.25, hd - 0.2]} {...thin} />
        </Group>
      );
    case 'armchair':
      return (
        <Group>
          {body}
          <Rect x={-hw + 0.1} y={-hd + 0.14} width={w - 0.2} height={d - 0.24} {...thin} cornerRadius={0.05} />
        </Group>
      );
    case 'table-rect':
    case 'counter':
    case 'island':
      return body;
    case 'table-round':
      return <Circle radius={hw} fill={F} {...thin} />;
    case 'chair':
      return (
        <Group>
          {body}
          <Line points={[-hw, -hd + 0.08, hw, -hd + 0.08]} {...thin} />
        </Group>
      );
    case 'wardrobe':
    case 'dresser':
      return (
        <Group>
          {body}
          <Line points={[-hw, 0, hw, 0]} {...thin} />
          <Line points={[0, -hd, 0, hd]} {...thin} />
        </Group>
      );
    case 'tv-unit':
      return (
        <Group>
          {body}
          <Line points={[-hw + 0.15, hd - 0.08, hw - 0.15, hd - 0.08]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
        </Group>
      );
    case 'bookshelf':
      return (
        <Group>
          {body}
          <Line points={[-hw + w * 0.33, -hd, -hw + w * 0.33, hd]} {...thin} />
          <Line points={[-hw + w * 0.66, -hd, -hw + w * 0.66, hd]} {...thin} />
        </Group>
      );
    case 'fridge':
      return (
        <Group>
          {body}
          <Line points={[-hw, -hd + 0.18, hw, -hd + 0.18]} {...thin} />
        </Group>
      );
    case 'stove':
      return (
        <Group>
          {body}
          {[
            [-w * 0.22, -d * 0.18],
            [w * 0.22, -d * 0.18],
            [-w * 0.22, d * 0.22],
            [w * 0.22, d * 0.22],
          ].map(([x, y], i) => (
            <Circle key={i} x={x} y={y} radius={Math.min(w, d) * 0.14} {...thin} />
          ))}
        </Group>
      );
    case 'sink':
      return (
        <Group>
          {body}
          <Rect x={-hw + 0.1} y={-hd + 0.1} width={w - 0.2} height={d - 0.2} {...thin} cornerRadius={0.06} />
          <Circle x={0} y={-hd + 0.14} radius={0.035} {...thin} />
        </Group>
      );
    case 'toilet':
      return (
        <Group>
          <Rect x={-hw} y={-hd} width={w} height={0.18} fill={F} {...thin} />
          <Ellipse x={0} y={0.12} radiusX={hw * 0.85} radiusY={hd - 0.22} fill={F} {...thin} />
        </Group>
      );
    case 'washbasin':
      return (
        <Group>
          {body}
          <Ellipse x={0} y={0.02} radiusX={hw * 0.7} radiusY={hd * 0.6} {...thin} />
        </Group>
      );
    case 'shower':
      return (
        <Group>
          {body}
          <Line points={[-hw, -hd, hw, hd]} {...thin} />
          <Circle x={0} y={0} radius={0.06} {...thin} />
        </Group>
      );
    case 'bathtub':
      return (
        <Group>
          {body}
          <Rect x={-hw + 0.09} y={-hd + 0.09} width={w - 0.18} height={d - 0.18} {...thin} cornerRadius={0.18} />
          <Circle x={-hw + 0.22} y={0} radius={0.04} {...thin} />
        </Group>
      );
    case 'washing-machine':
      return (
        <Group>
          {body}
          <Circle x={0} y={0.02} radius={Math.min(w, d) * 0.3} {...thin} />
        </Group>
      );
    case 'plant':
      return (
        <Group>
          <Circle radius={hw} fill="rgba(127,174,107,0.35)" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          {[0, 72, 144, 216, 288].map((a) => (
            <Line
              key={a}
              points={[0, 0, hw * 0.85 * Math.cos((a * Math.PI) / 180), hw * 0.85 * Math.sin((a * Math.PI) / 180)]}
              stroke="#5c8a4c"
              strokeWidth={1}
              strokeScaleEnabled={false}
            />
          ))}
        </Group>
      );
    case 'rug':
    case 'floor-patch':
      return (
        <Rect x={-hw} y={-hd} width={w} height={d} fill={`${color}55`} stroke={color} strokeWidth={1} strokeScaleEnabled={false} dash={kind === 'floor-patch' ? [4, 3] : undefined} cornerRadius={0.03} />
      );
    case 'ceiling-panel':
      return (
        <Rect x={-hw} y={-hd} width={w} height={d} stroke={S} strokeWidth={1} strokeScaleEnabled={false} dash={[8, 4]} />
      );
    case 'lamp-floor':
    case 'lamp-ceiling':
      return (
        <Group>
          <Circle radius={hw} {...thin} fill={F} />
          <Line points={[-hw, 0, hw, 0]} {...thin} />
          <Line points={[0, -hd, 0, hd]} {...thin} />
        </Group>
      );
    case 'box':
    default:
      return body;
  }
}

/** Door plan symbols per style: hinged (swing arc), double (two arcs), sliding (offset panels). */
export function DoorSwing({
  width,
  swing,
  style = 'single',
}: {
  width: number;
  swing: 1 | -1;
  style?: 'single' | 'double' | 'sliding' | 'casement' | 'fixed';
}) {
  if (style === 'sliding') {
    return (
      <Group>
        <Line points={[-width / 2, -0.03, 0.05, -0.03]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
        <Line points={[-0.05, 0.03, width / 2, 0.03]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
        <Line points={[0.08, 0, 0.2, 0]} stroke={S} strokeWidth={1} strokeScaleEnabled={false} />
      </Group>
    );
  }
  if (style === 'double') {
    const half = width / 2;
    return (
      <Group>
        {/* two leaves hinged at opposite jambs */}
        <Line points={[-width / 2, 0, -width / 2, -swing * half]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />
        <Arc x={-width / 2} y={0} innerRadius={half} outerRadius={half} angle={90} rotation={swing === 1 ? -90 : 0} stroke={S} strokeWidth={0.8} strokeScaleEnabled={false} />
        <Line points={[width / 2, 0, width / 2, -swing * half]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />
        <Arc x={width / 2} y={0} innerRadius={half} outerRadius={half} angle={90} rotation={swing === 1 ? 180 : 90} stroke={S} strokeWidth={0.8} strokeScaleEnabled={false} />
      </Group>
    );
  }
  return (
    <Group>
      <Line points={[-width / 2, 0, -width / 2, -swing * width]} stroke={S} strokeWidth={1.2} strokeScaleEnabled={false} />
      <Arc
        x={-width / 2}
        y={0}
        innerRadius={width}
        outerRadius={width}
        angle={90}
        rotation={swing === 1 ? -90 : 0}
        stroke={S}
        strokeWidth={0.8}
        strokeScaleEnabled={false}
      />
    </Group>
  );
}
