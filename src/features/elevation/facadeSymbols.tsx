import { Circle, Group, Line, Rect, Shape } from 'react-konva';
import type { FacadeSymbol } from '../../library/facadeCatalog';

/**
 * Schematic façade-view symbols (front view, meters). Local space: origin at
 * the element CENTER, +x right, +y DOWN on screen (so "up" is -y), w × h box.
 */

interface Props {
  kind: FacadeSymbol;
  w: number;
  h: number;
  color: string;
}

const S = '#4a463d';
const thin = { stroke: S, strokeWidth: 1, strokeScaleEnabled: false } as const;

export function FacadeSymbolShape({ kind, w, h, color }: Props) {
  const hw = w / 2;
  const hh = h / 2;
  const frame = <Rect x={-hw} y={-hh} width={w} height={h} fill={color} {...thin} />;

  switch (kind) {
    case 'window-4pane':
    case 'window-tall':
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#bcd7e8" {...thin} />
          <Line points={[0, -hh, 0, hh]} {...thin} />
          <Line points={[-hw, 0, hw, 0]} {...thin} />
        </Group>
      );
    case 'window-arch':
      return (
        <Group>
          <Shape
            sceneFunc={(ctx, shape) => {
              const r = hw;
              const springY = -hh + r; // arch springs r below the top
              ctx.beginPath();
              ctx.moveTo(-hw, hh);
              ctx.lineTo(-hw, springY);
              ctx.arc(0, springY, r, Math.PI, 0, false);
              ctx.lineTo(hw, hh);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fill="#bcd7e8"
            {...thin}
          />
          <Line points={[0, -hh + hw, 0, hh]} {...thin} />
        </Group>
      );
    case 'window-round':
      return (
        <Group>
          <Circle radius={hw} fill="#bcd7e8" {...thin} />
          <Line points={[0, -hw, 0, hw]} {...thin} />
          <Line points={[-hw, 0, hw, 0]} {...thin} />
        </Group>
      );
    case 'door-panel':
      return (
        <Group>
          {frame}
          <Rect x={-hw + 0.08} y={-hh + 0.08} width={w - 0.16} height={h - 0.16} {...thin} />
          <Circle x={hw - 0.14} y={0.05} radius={0.03} fill={S} />
        </Group>
      );
    case 'door-double':
      return (
        <Group>
          {frame}
          <Line points={[0, -hh, 0, hh]} {...thin} />
          <Circle x={-0.08} y={0.05} radius={0.03} fill={S} />
          <Circle x={0.08} y={0.05} radius={0.03} fill={S} />
        </Group>
      );
    case 'railing': {
      const bars = Math.max(4, Math.round(w / 0.15));
      return (
        <Group>
          <Line points={[-hw, -hh, hw, -hh]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
          <Line points={[-hw, hh, hw, hh]} {...thin} />
          {Array.from({ length: bars + 1 }, (_, i) => {
            const x = -hw + (i * w) / bars;
            return <Line key={i} points={[x, -hh, x, hh]} {...thin} />;
          })}
        </Group>
      );
    }
    case 'cladding': {
      const rows = Math.max(3, Math.round(h / 0.3));
      const lines = [];
      for (let i = 1; i < rows; i++) {
        const y = -hh + (i * h) / rows;
        lines.push(<Line key={`r${i}`} points={[-hw, y, hw, y]} {...thin} />);
        const off = i % 2 === 0 ? 0 : w / 4;
        for (let x = -hw + off; x < hw; x += w / 2) {
          lines.push(<Line key={`v${i}-${x}`} points={[x, y - h / rows, x, y]} {...thin} />);
        }
      }
      return (
        <Group>
          {frame}
          {lines}
        </Group>
      );
    }
    case 'tiles': {
      const cols = Math.max(2, Math.round(w / 0.3));
      const rows = Math.max(3, Math.round(h / 0.3));
      const lines = [];
      for (let i = 1; i < rows; i++)
        lines.push(<Line key={`h${i}`} points={[-hw, -hh + (i * h) / rows, hw, -hh + (i * h) / rows]} {...thin} />);
      for (let i = 1; i < cols; i++)
        lines.push(<Line key={`v${i}`} points={[-hw + (i * w) / cols, -hh, -hw + (i * w) / cols, hh]} {...thin} />);
      return (
        <Group>
          {frame}
          {lines}
        </Group>
      );
    }
    case 'panel':
      return (
        <Group>
          {frame}
          <Rect x={-hw + 0.06} y={-hh + 0.06} width={w - 0.12} height={h - 0.12} {...thin} />
        </Group>
      );
    case 'pergola': {
      const slats = Math.max(4, Math.round(w / 0.25));
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h * 0.35} fill={color} {...thin} />
          {Array.from({ length: slats }, (_, i) => {
            const x = -hw + ((i + 0.5) * w) / slats;
            return <Line key={i} points={[x, -hh + h * 0.35, x, hh]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />;
          })}
        </Group>
      );
    }
    case 'sconce':
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#f2e3b8" {...thin} cornerRadius={0.02} />
          <Line points={[-hw, hh, hw, hh]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
        </Group>
      );
    case 'column':
      return (
        <Group>
          {frame}
          <Rect x={-hw - 0.05} y={-hh} width={w + 0.1} height={0.12} fill={color} {...thin} />
          <Rect x={-hw - 0.05} y={hh - 0.12} width={w + 0.1} height={0.12} fill={color} {...thin} />
        </Group>
      );
    case 'gate': {
      const bars = Math.max(6, Math.round(w / 0.18));
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} {...thin} />
          {Array.from({ length: bars }, (_, i) => {
            const x = -hw + ((i + 0.5) * w) / bars;
            return <Line key={i} points={[x, -hh + 0.05, x, hh - 0.05]} {...thin} />;
          })}
          <Line points={[-hw, 0, hw, 0]} {...thin} />
        </Group>
      );
    }
    case 'parapet':
      return (
        <Group>
          {frame}
          <Line points={[-hw, -hh + 0.08, hw, -hh + 0.08]} {...thin} />
        </Group>
      );
    case 'awning':
      return (
        <Group>
          {frame}
          <Line points={[-hw, hh, -hw + 0.15, hh + 0.25]} {...thin} />
          <Line points={[hw, hh, hw - 0.15, hh + 0.25]} {...thin} />
        </Group>
      );
    case 'solar': {
      const cols = Math.max(2, Math.round(w / 0.3));
      const rows = Math.max(2, Math.round(h / 0.3));
      const lines = [];
      for (let i = 1; i < rows; i++)
        lines.push(<Line key={`h${i}`} points={[-hw, -hh + (i * h) / rows, hw, -hh + (i * h) / rows]} stroke="#dfe8f0" strokeWidth={1} strokeScaleEnabled={false} />);
      for (let i = 1; i < cols; i++)
        lines.push(<Line key={`v${i}`} points={[-hw + (i * w) / cols, -hh, -hw + (i * w) / cols, hh]} stroke="#dfe8f0" strokeWidth={1} strokeScaleEnabled={false} />);
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill="#2b3d55" {...thin} />
          {lines}
        </Group>
      );
    }
    case 'tree':
      return (
        <Group>
          <Rect x={-0.06} y={hh - h * 0.35} width={0.12} height={h * 0.35} fill="#8a6845" {...thin} />
          <Circle y={-hh + h * 0.32} radius={hw * 0.9} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          <Circle x={-hw * 0.4} y={-hh + h * 0.5} radius={hw * 0.55} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          <Circle x={hw * 0.4} y={-hh + h * 0.5} radius={hw * 0.55} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
        </Group>
      );
    case 'shrub':
      return (
        <Group>
          <Circle x={-hw * 0.35} y={hh * 0.3} radius={hw * 0.5} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          <Circle x={hw * 0.35} y={hh * 0.3} radius={hw * 0.5} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          <Circle y={-hh * 0.2} radius={hw * 0.55} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
        </Group>
      );
    case 'shutters': {
      // Central 2-pane window flanked by slatted shutter leaves.
      const winW = w * 0.55;
      const shW = (w - winW) / 2;
      const slats = Math.max(4, Math.round(h / 0.18));
      const slat = (side: -1 | 1) =>
        Array.from({ length: slats - 1 }, (_, i) => {
          const y = -hh + ((i + 1) * h) / slats;
          const x0 = side === -1 ? -hw : hw - shW;
          return <Line key={`${side}${i}`} points={[x0 + 0.02, y, x0 + shW - 0.02, y]} {...thin} />;
        });
      return (
        <Group>
          <Rect x={-winW / 2} y={-hh} width={winW} height={h} fill="#bcd7e8" {...thin} />
          <Line points={[0, -hh, 0, hh]} {...thin} />
          <Rect x={-hw} y={-hh} width={shW} height={h} fill={color} {...thin} />
          <Rect x={hw - shW} y={-hh} width={shW} height={h} fill={color} {...thin} />
          {slat(-1)}
          {slat(1)}
        </Group>
      );
    }
    case 'louver': {
      const slats = Math.max(3, Math.round(h / 0.09));
      return (
        <Group>
          {frame}
          {Array.from({ length: slats - 1 }, (_, i) => {
            const y = -hh + ((i + 1) * h) / slats;
            return <Line key={i} points={[-hw + 0.03, y, hw - 0.03, y]} {...thin} />;
          })}
        </Group>
      );
    }
    case 'arch-door':
      return (
        <Group>
          <Shape
            sceneFunc={(ctx, shape) => {
              const r = hw;
              const springY = -hh + r;
              ctx.beginPath();
              ctx.moveTo(-hw, hh);
              ctx.lineTo(-hw, springY);
              ctx.arc(0, springY, r, Math.PI, 0, false);
              ctx.lineTo(hw, hh);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fill={color}
            {...thin}
          />
          <Rect x={-hw + 0.09} y={-hh + hw + 0.05} width={w - 0.18} height={h - hw - 0.14} {...thin} />
          <Circle x={hw - 0.16} y={hh - h * 0.45} radius={0.03} fill={S} />
        </Group>
      );
    case 'balcony': {
      const slabH = 0.18;
      const railH = h - slabH;
      const bars = Math.max(5, Math.round(w / 0.14));
      return (
        <Group>
          <Rect x={-hw} y={hh - slabH} width={w} height={slabH} fill={color} {...thin} />
          <Line points={[-hw, -hh, hw, -hh]} stroke={S} strokeWidth={2} strokeScaleEnabled={false} />
          {Array.from({ length: bars + 1 }, (_, i) => {
            const x = -hw + (i * w) / bars;
            return <Line key={i} points={[x, -hh, x, -hh + railH]} {...thin} />;
          })}
        </Group>
      );
    }
    case 'cornice':
      return (
        <Group>
          {frame}
          <Line points={[-hw, -hh + h * 0.35, hw, -hh + h * 0.35]} {...thin} />
          <Line points={[-hw, hh - h * 0.25, hw, hh - h * 0.25]} {...thin} />
        </Group>
      );
    case 'steps': {
      const n = 3;
      return (
        <Group>
          {Array.from({ length: n }, (_, i) => {
            const sw = w * (1 - i * 0.18);
            const sh = h / n;
            return <Rect key={i} x={-sw / 2} y={hh - (i + 1) * sh} width={sw} height={sh} fill={color} {...thin} />;
          })}
        </Group>
      );
    }
    case 'canopy':
      return (
        <Group>
          <Line points={[-hw, hh, hw, -hh]} stroke={color} strokeWidth={4} strokeScaleEnabled={false} />
          <Line points={[-hw, hh, -hw, -hh + h * 0.2]} {...thin} />
          <Line points={[hw * 0.2, -hh + h * 0.45, hw, -hh]} {...thin} />
          <Rect x={-hw} y={-hh} width={w} height={0.06} fill={color} {...thin} />
        </Group>
      );
    case 'planter':
      return (
        <Group>
          <Shape
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              ctx.moveTo(-hw, -hh + h * 0.35);
              ctx.lineTo(hw, -hh + h * 0.35);
              ctx.lineTo(hw * 0.82, hh);
              ctx.lineTo(-hw * 0.82, hh);
              ctx.closePath();
              ctx.fillStrokeShape(shape);
            }}
            fill={color}
            {...thin}
          />
          {[-0.3, 0, 0.3].map((fx) => (
            <Circle key={fx} x={hw * fx * 2} y={-hh + h * 0.16} radius={h * 0.22} fill="#7fae6b" stroke="#5c8a4c" strokeWidth={1} strokeScaleEnabled={false} />
          ))}
        </Group>
      );
    case 'downpipe':
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill={color} {...thin} />
          {[0.2, 0.5, 0.8].map((fy) => (
            <Line key={fy} points={[-hw - 0.03, -hh + h * fy, hw + 0.03, -hh + h * fy]} {...thin} />
          ))}
        </Group>
      );
    case 'spot':
      return (
        <Group>
          <Rect x={-hw} y={-h * 0.12} width={w} height={h * 0.24} fill={color} {...thin} cornerRadius={0.015} />
          <Line points={[-hw * 0.6, -h * 0.14, -hw * 1.6, -hh]} stroke="#e8d9a8" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[hw * 0.6, -h * 0.14, hw * 1.6, -hh]} stroke="#e8d9a8" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[-hw * 0.6, h * 0.14, -hw * 1.6, hh]} stroke="#e8d9a8" strokeWidth={1} strokeScaleEnabled={false} />
          <Line points={[hw * 0.6, h * 0.14, hw * 1.6, hh]} stroke="#e8d9a8" strokeWidth={1} strokeScaleEnabled={false} />
        </Group>
      );
    case 'nameboard':
      return (
        <Group>
          <Rect x={-hw} y={-hh} width={w} height={h} fill={color} {...thin} cornerRadius={0.03} />
          <Line points={[-hw + 0.12, -hh + h * 0.42, hw - 0.12, -hh + h * 0.42]} stroke="#efe6d4" strokeWidth={2} strokeScaleEnabled={false} />
          <Line points={[-hw + 0.2, -hh + h * 0.68, hw - 0.2, -hh + h * 0.68]} stroke="#efe6d4" strokeWidth={1} strokeScaleEnabled={false} />
        </Group>
      );
    case 'grille': {
      const n = Math.max(3, Math.round(w / 0.12));
      return (
        <Group>
          {frame}
          {Array.from({ length: n - 1 }, (_, i) => {
            const x = -hw + ((i + 1) * w) / n;
            return <Line key={`v${i}`} points={[x, -hh + 0.03, x, hh - 0.03]} {...thin} />;
          })}
          {Array.from({ length: 2 }, (_, i) => {
            const y = -hh + ((i + 1) * h) / 3;
            return <Line key={`h${i}`} points={[-hw + 0.03, y, hw - 0.03, y]} {...thin} />;
          })}
        </Group>
      );
    }
    default:
      return frame;
  }
}
