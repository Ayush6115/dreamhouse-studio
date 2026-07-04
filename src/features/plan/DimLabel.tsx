import { Group, Line, Text } from 'react-konva';
import type { Point, UnitSystem } from '../../types';
import { add, dist, norm, perp, scale as vscale, sub } from '../../geometry/vec';
import { formatLength } from '../../geometry/units';

interface Props {
  a: Point;
  b: Point;
  /** Viewport scale (px per meter) — keeps text/ticks constant on screen. */
  vpScale: number;
  unit: UnitSystem;
  /** Offset the dimension line sideways (meters, along +normal of a→b). */
  offsetM?: number;
  color?: string;
}

const deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Architectural dimension: line with end ticks and a centered length label.
 * When the line is offset from the measured segment, the NUMBER sits on the
 * far side of the dimension line (outside), never between the line and the
 * geometry — computed in world space so edge direction/flips don't matter.
 */
export function DimLabel({ a, b, vpScale, unit, offsetM = 0, color = '#8a8272' }: Props) {
  const d = dist(a, b);
  if (d < 1e-6) return null;
  const dir = norm(sub(b, a));
  const n = perp(dir);
  const a2 = add(a, vscale(n, offsetM));
  const b2 = add(b, vscale(n, offsetM));
  const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };

  let ang = Math.atan2(dir.y, dir.x);
  // Keep text upright.
  if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;

  const tick = 4 / vpScale; // half tick length
  const fontSize = 11 / vpScale;

  // Anchor for the text block: past the dimension line, away from a→b.
  const gap = fontSize * 0.78 + 3 / vpScale;
  const textCenter =
    offsetM === 0 ? mid : add(mid, vscale(n, Math.sign(offsetM) * gap));
  // With no offset (draft previews), lift the label just above the line in
  // its own reading frame.
  const localY = offsetM === 0 ? -fontSize - 3 / vpScale : -fontSize / 2;

  return (
    <Group listening={false}>
      <Line
        points={[a2.x, a2.y, b2.x, b2.y]}
        stroke={color}
        strokeWidth={1}
        strokeScaleEnabled={false}
      />
      {[a2, b2].map((p, i) => (
        <Line
          key={i}
          points={[p.x - n.x * tick, p.y - n.y * tick, p.x + n.x * tick, p.y + n.y * tick]}
          stroke={color}
          strokeWidth={1}
          strokeScaleEnabled={false}
        />
      ))}
      <Group x={textCenter.x} y={textCenter.y} rotation={deg(ang)}>
        <Text
          text={formatLength(d, unit)}
          fontSize={fontSize}
          fontFamily="Inter Variable, system-ui, sans-serif"
          fill={color}
          width={Math.max(d, 2)}
          x={-Math.max(d, 2) / 2}
          y={localY}
          align="center"
        />
      </Group>
    </Group>
  );
}
