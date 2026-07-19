import { Arc, Circle, Ellipse, Group, Line, Path } from 'react-konva';
import type { Symbol2D } from '../../library/catalog';
import { symbolBlock, type SymbolPrim } from '../../library/symbolBlocks';

/**
 * 2D architectural blocks for library items on the plan canvas. The actual
 * linework is defined once in library/symbolBlocks.ts and shared with the
 * SVG export sheets, so the canvas and the drawings match exactly.
 */

interface SymbolProps {
  kind: Symbol2D;
  w: number; // width, m
  d: number; // depth, m
  color: string;
}

const S = '#4a463d'; // stroke ink on the canvas
const BODY = 'rgba(255,255,255,0.72)';

/** Door plan symbols per style: hinged (swing arc), double (two arcs), sliding (offset panels). */
export function DoorSwing({
  width,
  swing,
  style = 'single',
}: {
  width: number;
  swing: 1 | -1;
  style?: 'single' | 'double' | 'sliding' | 'folding' | 'casement' | 'fixed';
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
  if (style === 'folding') {
    const q = width / 4;
    const rise = -swing * width * 0.2;
    return (
      <Group>
        <Line points={[-width / 2, 0, -q, rise, 0, 0]} stroke={S} strokeWidth={1.4} strokeScaleEnabled={false} />
        <Line points={[0, 0, q, rise, width / 2, 0]} stroke={S} strokeWidth={1.4} strokeScaleEnabled={false} />
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

/** Render a list of symbol primitives with Konva (shared IR renderer). */
export function PrimGlyph({
  prims,
  stroke = S,
  body = BODY,
}: {
  prims: SymbolPrim[];
  stroke?: string;
  body?: string;
}) {
  return (
    <Group listening={false}>
      {prims.map((p, i) => {
        const strokeWidth = 'thick' in p && p.thick ? 1.4 : 1;
        const dash = 'dash' in p && p.dash ? [4, 3] : undefined;
        const fill = p.fill === 'body' ? body : p.fill === 'ink' ? stroke : undefined;
        if (p.k === 'circle') {
          return (
            <Circle key={i} x={p.x} y={p.y} radius={p.r} stroke={stroke} strokeWidth={strokeWidth} strokeScaleEnabled={false} fill={fill} dash={dash} />
          );
        }
        if (p.k === 'ellipse') {
          return (
            <Ellipse key={i} x={p.x} y={p.y} radiusX={p.rx} radiusY={p.ry} stroke={stroke} strokeWidth={strokeWidth} strokeScaleEnabled={false} fill={fill} dash={dash} />
          );
        }
        return (
          <Path key={i} data={p.d} stroke={stroke} strokeWidth={strokeWidth} strokeScaleEnabled={false} fill={fill} dash={dash} lineJoin="round" />
        );
      })}
    </Group>
  );
}

export function Symbol2DShape({ kind, w, d, color }: SymbolProps) {
  const prims = symbolBlock(kind, w, d);
  const accent = kind === 'plant' || kind === 'planter' ? '#5c8a4c' : S;
  return (
    <Group>
      <PrimGlyph prims={prims} stroke={accent} />
      {/* subtle material tint so colored items stay recognizable */}
      {kind !== 'plant' && kind !== 'rug' && (
        <Path data={`M ${-w / 2} ${-d / 2} h ${w} v ${d} h ${-w} Z`} fill={color} opacity={0.06} listening={false} />
      )}
    </Group>
  );
}
