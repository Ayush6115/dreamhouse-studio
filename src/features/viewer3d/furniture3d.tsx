import type { ReactNode } from 'react';
import type { Model3D } from '../../library/catalog';

/**
 * Parametric placeholder 3D models composed from primitives (see the notice
 * in library/catalog.ts). Local space: x = width, z = depth, y = up,
 * origin at the item's base center.
 */

interface Mat {
  color: string;
  roughness?: number;
  metalness?: number;
}

interface ModelProps extends Mat {
  kind: Model3D;
  w: number;
  d: number;
  h: number;
}

function B({
  p,
  s,
  m,
  transparent,
  opacity,
}: {
  p: [number, number, number];
  s: [number, number, number];
  m: Mat;
  transparent?: boolean;
  opacity?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial
        color={m.color}
        roughness={m.roughness ?? 0.8}
        metalness={m.metalness ?? 0}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  );
}

function Cyl({
  p,
  r,
  h,
  m,
  rTop,
}: {
  p: [number, number, number];
  r: number;
  h: number;
  m: Mat;
  rTop?: number;
}) {
  return (
    <mesh position={p} castShadow receiveShadow>
      <cylinderGeometry args={[rTop ?? r, r, h, 20]} />
      <meshStandardMaterial color={m.color} roughness={m.roughness ?? 0.8} metalness={m.metalness ?? 0} />
    </mesh>
  );
}

const DARK: Mat = { color: '#3a3d42', roughness: 0.6 };
const WHITE: Mat = { color: '#eceae4', roughness: 0.4 };

export function FurnitureModel({ kind, w, d, h, color, roughness, metalness }: ModelProps): ReactNode {
  const m: Mat = { color, roughness, metalness };

  switch (kind) {
    case 'bed': {
      // Modern platform bed: floating base, thick mattress, upholstered
      // headboard, duvet with a folded end and throw band.
      const duvet: Mat = { color: '#e8e4dc', roughness: 0.95 };
      return (
        <group>
          <B p={[0, 0.14, 0.03]} s={[w - 0.06, 0.12, d - 0.05]} m={{ color: '#4a4139', roughness: 0.7 }} />
          <B p={[0, 0.26, 0.03]} s={[w, 0.16, d]} m={{ color: '#d9d5cc', roughness: 0.9 }} />
          {/* upholstered headboard */}
          <B p={[0, h / 2 + 0.12, -d / 2 + 0.035]} s={[w + 0.08, h + 0.24, 0.07]} m={m} />
          {/* duvet covering the lower 2/3, slightly proud */}
          <B p={[0, 0.36, d * 0.14 + 0.015]} s={[w + 0.02, 0.09, d * 0.72]} m={duvet} />
          <B p={[0, 0.36, d / 2 - 0.1]} s={[w + 0.02, 0.1, 0.2]} m={duvet} />
          {/* throw band at the foot */}
          <B p={[0, 0.415, d / 2 - 0.32]} s={[w + 0.03, 0.02, 0.34]} m={{ color: '#8d7a63', roughness: 1 }} />
          {/* pillows */}
          <B p={[-w / 4 + 0.02, 0.47, -d / 2 + 0.3]} s={[w / 2 - 0.14, 0.12, 0.42]} m={WHITE} />
          {w > 1.2 && <B p={[w / 4 - 0.02, 0.47, -d / 2 + 0.3]} s={[w / 2 - 0.14, 0.12, 0.42]} m={WHITE} />}
        </group>
      );
    }
    case 'bunk': {
      const rail: Mat = { color: m.color, roughness: 0.7 };
      return (
        <group>
          {[0.28, h - 0.42].map((y, i) => (
            <group key={i}>
              <B p={[0, y, 0]} s={[w, 0.1, d]} m={rail} />
              <B p={[0, y + 0.11, 0]} s={[w - 0.06, 0.12, d - 0.06]} m={{ color: '#d9d5cc', roughness: 0.9 }} />
              <B p={[0, y + 0.22, -d / 2 + 0.22]} s={[w - 0.12, 0.08, 0.34]} m={WHITE} />
            </group>
          ))}
          {/* posts + upper guard rail + ladder */}
          {([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sz) => (
              <B key={`${sx}${sz}`} p={[sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03)]} s={[0.06, h, 0.06]} m={rail} />
            )),
          )}
          <B p={[0, h - 0.18, d / 2 - 0.02]} s={[w, 0.04, 0.04]} m={rail} />
          {[0.35, 0.7, 1.05, 1.4].map((y) => (
            <B key={y} p={[w / 2 - 0.01, y, d / 2 + 0.12]} s={[0.04, 0.04, 0.3]} m={rail} />
          ))}
          <B p={[w / 2 - 0.01, h * 0.52, d / 2 + 0.26]} s={[0.04, h, 0.04]} m={rail} />
        </group>
      );
    }
    case 'office-chair': {
      const dark: Mat = { color: '#33353a', roughness: 0.6 };
      return (
        <group>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i * Math.PI * 2) / 5;
            return (
              <B key={i} p={[Math.cos(a) * w * 0.28, 0.04, Math.sin(a) * w * 0.28]} s={[w * 0.34, 0.04, 0.05]} m={dark} />
            );
          })}
          <Cyl p={[0, 0.25, 0]} r={0.025} h={0.4} m={{ color: '#8f959b', roughness: 0.3, metalness: 0.9 }} />
          <B p={[0, 0.48, 0.02]} s={[w * 0.8, 0.07, d * 0.78]} m={m} />
          <B p={[0, 0.75, -d / 2 + 0.07]} s={[w * 0.72, h * 0.55, 0.07]} m={m} />
        </group>
      );
    }
    case 'tv-flat':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, 0.035]} m={{ color: '#141518', roughness: 0.35 }} />
          <B p={[0, h / 2, 0.008]} s={[w - 0.04, h - 0.04, 0.03]} m={{ color: '#0a0b0d', roughness: 0.1, metalness: 0.3 }} />
        </group>
      );
    case 'oven':
    case 'dishwasher':
    case 'microwave': {
      const face: Mat = kind === 'dishwasher' ? { color: '#9aa1a8', roughness: 0.35, metalness: 0.8 } : { color: '#2b2d31', roughness: 0.4, metalness: 0.5 };
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <B p={[0, h / 2, d / 2 - 0.008]} s={[w - 0.04, h - 0.05, 0.02]} m={face} />
          {kind !== 'dishwasher' && (
            <B p={[0, h * 0.55, d / 2 + 0.001]} s={[w * 0.72, h * 0.5, 0.015]} m={{ color: '#101113', roughness: 0.15 }} />
          )}
          {/* handle bar */}
          <B p={[0, kind === 'dishwasher' ? h - 0.07 : h * 0.86, d / 2 + 0.03]} s={[w * 0.8, 0.025, 0.025]} m={{ color: '#b8bcc0', roughness: 0.3, metalness: 0.9 }} />
        </group>
      );
    }
    case 'hood':
      return (
        <group>
          {/* canopy tapering to a chimney */}
          <B p={[0, 0.05, 0]} s={[w, 0.1, d]} m={{ color: '#9aa1a8', roughness: 0.35, metalness: 0.8 }} />
          <B p={[0, 0.18, -d * 0.1]} s={[w * 0.6, 0.16, d * 0.55]} m={{ color: '#9aa1a8', roughness: 0.35, metalness: 0.8 }} />
          <B p={[0, h * 0.66, -d * 0.1]} s={[w * 0.28, h * 0.68, d * 0.35]} m={{ color: '#a8adb2', roughness: 0.4, metalness: 0.7 }} />
        </group>
      );
    case 'vanity':
      return (
        <group>
          <B p={[0, (h - 0.12) / 2, 0]} s={[w, h - 0.12, d]} m={m} />
          <B p={[0, h - 0.05, 0]} s={[w + 0.03, 0.05, d + 0.02]} m={{ color: '#e8e4da', roughness: 0.25 }} />
          <Cyl p={[0, h + 0.03, 0.02]} r={Math.min(w, d) * 0.22} h={0.1} m={{ color: '#f2efe8', roughness: 0.2 }} />
          <B p={[0, h + 0.1, -d / 2 + 0.05]} s={[0.05, 0.16, 0.05]} m={{ color: '#8f959b', roughness: 0.3, metalness: 0.9 }} />
          <B p={[0, (h - 0.12) / 2, d / 2 + 0.005]} s={[w - 0.05, h - 0.2, 0.012]} m={{ color: '#6b5a45', roughness: 0.6 }} />
        </group>
      );
    case 'sofa':
    case 'armchair':
      return (
        <group>
          <B p={[0, 0.2, 0.06]} s={[w, 0.4, d - 0.12]} m={m} />
          <B p={[0, h / 2, -d / 2 + 0.11]} s={[w, h, 0.22]} m={m} />
          <B p={[-w / 2 + 0.08, 0.33, 0.05]} s={[0.16, 0.66, d - 0.1]} m={m} />
          <B p={[w / 2 - 0.08, 0.33, 0.05]} s={[0.16, 0.66, d - 0.1]} m={m} />
        </group>
      );
    case 'sofa-l':
      return (
        <group>
          {/* top run + left leg, matching the 2D symbol */}
          <B p={[0, 0.22, -d / 2 + 0.45]} s={[w, 0.44, 0.9]} m={m} />
          <B p={[-w / 2 + 0.45, 0.22, 0.45]} s={[0.9, 0.44, d - 0.9]} m={m} />
          <B p={[0, 0.42, -d / 2 + 0.11]} s={[w, 0.85, 0.22]} m={m} />
          <B p={[-w / 2 + 0.11, 0.42, 0.35]} s={[0.22, 0.85, d - 0.7]} m={m} />
        </group>
      );
    case 'table':
      return (
        <group>
          <B p={[0, h - 0.025, 0]} s={[w, 0.05, d]} m={m} />
          {[
            [-w / 2 + 0.05, -d / 2 + 0.05],
            [w / 2 - 0.05, -d / 2 + 0.05],
            [-w / 2 + 0.05, d / 2 - 0.05],
            [w / 2 - 0.05, d / 2 - 0.05],
          ].map(([x, z], i) => (
            <B key={i} p={[x, (h - 0.05) / 2, z]} s={[0.06, h - 0.05, 0.06]} m={m} />
          ))}
        </group>
      );
    case 'table-round':
      return (
        <group>
          <Cyl p={[0, h - 0.025, 0]} r={w / 2} h={0.05} m={m} />
          <Cyl p={[0, (h - 0.05) / 2, 0]} r={0.06} h={h - 0.05} m={m} />
          <Cyl p={[0, 0.02, 0]} r={w / 5} h={0.04} m={m} />
        </group>
      );
    case 'chair':
      return (
        <group>
          <B p={[0, 0.44, 0]} s={[w, 0.05, d]} m={m} />
          <B p={[0, 0.44 + (h - 0.46) / 2, -d / 2 + 0.025]} s={[w, h - 0.46, 0.05]} m={m} />
          {[
            [-w / 2 + 0.03, -d / 2 + 0.03],
            [w / 2 - 0.03, -d / 2 + 0.03],
            [-w / 2 + 0.03, d / 2 - 0.03],
            [w / 2 - 0.03, d / 2 - 0.03],
          ].map(([x, z], i) => (
            <B key={i} p={[x, 0.21, z]} s={[0.045, 0.42, 0.045]} m={m} />
          ))}
        </group>
      );
    case 'wardrobe': {
      // Modern sliding wardrobe: carcass, door panels with reveals, handles,
      // recessed plinth.
      const doors = Math.max(2, Math.round(w / 0.6));
      const dw = (w - 0.04) / doors;
      return (
        <group>
          <B p={[0, 0.04, 0]} s={[w - 0.1, 0.08, d - 0.08]} m={DARK} />
          <B p={[0, h / 2 + 0.04, 0]} s={[w, h - 0.08, d]} m={m} />
          {Array.from({ length: doors }, (_, i) => {
            const x = -w / 2 + 0.02 + dw * (i + 0.5);
            return (
              <group key={i}>
                <B
                  p={[x, h / 2 + 0.04, d / 2 + 0.008]}
                  s={[dw - 0.015, h - 0.12, 0.014]}
                  m={{ color: i % 2 ? '#efece5' : m.color, roughness: 0.55 }}
                />
                <B p={[x + (i % 2 ? -1 : 1) * (dw / 2 - 0.05), h / 2 + 0.04, d / 2 + 0.024]} s={[0.02, 0.5, 0.02]} m={{ color: '#8f959b', roughness: 0.3, metalness: 0.9 }} />
              </group>
            );
          })}
        </group>
      );
    }
    case 'tv-unit':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <B p={[0, h + 0.45, -d / 2 + 0.03]} s={[Math.min(w - 0.4, 1.25), 0.72, 0.05]} m={DARK} />
        </group>
      );
    case 'bookshelf':
      return (
        <group>
          <B p={[0, h / 2, -d / 2 + 0.015]} s={[w, h, 0.03]} m={m} />
          <B p={[-w / 2 + 0.015, h / 2, 0]} s={[0.03, h, d]} m={m} />
          <B p={[w / 2 - 0.015, h / 2, 0]} s={[0.03, h, d]} m={m} />
          {[0.02, 0.25, 0.5, 0.75, 0.98].map((f, i) => (
            <B key={i} p={[0, f * h, 0]} s={[w, 0.03, d]} m={m} />
          ))}
        </group>
      );
    case 'counter':
      return (
        <group>
          <B p={[0, (h - 0.04) / 2, 0]} s={[w, h - 0.04, d]} m={{ color: '#b9a888', roughness: 0.8 }} />
          <B p={[0, h - 0.02, 0]} s={[w + 0.03, 0.04, d + 0.03]} m={m} />
        </group>
      );
    case 'sink':
      return (
        <group>
          <B p={[0, (h - 0.04) / 2, 0]} s={[w, h - 0.04, d]} m={{ color: '#b9a888', roughness: 0.8 }} />
          <B p={[0, h - 0.02, 0]} s={[w + 0.03, 0.04, d + 0.03]} m={m} />
          <B p={[0, h + 0.002, 0]} s={[w * 0.6, 0.02, d * 0.55]} m={DARK} />
          <Cyl p={[0, h + 0.12, -d / 4]} r={0.02} h={0.24} m={{ color: '#9aa1a8', metalness: 0.8, roughness: 0.3 }} />
        </group>
      );
    case 'stove':
      return (
        <group>
          <B p={[0, (h - 0.04) / 2, 0]} s={[w, h - 0.04, d]} m={{ color: '#b9a888', roughness: 0.8 }} />
          <B p={[0, h - 0.02, 0]} s={[w + 0.03, 0.04, d + 0.03]} m={DARK} />
          {[
            [-w * 0.22, -d * 0.18],
            [w * 0.22, -d * 0.18],
            [-w * 0.22, d * 0.22],
            [w * 0.22, d * 0.22],
          ].map(([x, z], i) => (
            <Cyl key={i} p={[x, h + 0.005, z]} r={Math.min(w, d) * 0.13} h={0.015} m={{ color: '#1e1f22' }} />
          ))}
          {/* chimney hood */}
          <B p={[0, h + 0.75, -d * 0.15]} s={[w * 0.8, 0.06, d * 0.6]} m={{ color: '#9aa1a8', metalness: 0.7, roughness: 0.35 }} />
        </group>
      );
    case 'fridge':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <B p={[0, h * 0.66, d / 2 + 0.005]} s={[w - 0.06, 0.015, 0.01]} m={DARK} />
        </group>
      );
    case 'washing-machine':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <Cyl p={[0, h * 0.55, d / 2 - 0.028]} r={Math.min(w, h) * 0.3} h={0.06} m={DARK} />
        </group>
      );
    case 'toilet':
      return (
        <group>
          <B p={[0, 0.4, -d / 2 + 0.09]} s={[w, 0.8, 0.18]} m={WHITE} />
          <Cyl p={[0, 0.2, 0.08]} r={Math.min(w, d - 0.2) / 2} h={0.4} m={WHITE} />
        </group>
      );
    case 'washbasin':
      return (
        <group>
          <Cyl p={[0, (h - 0.1) / 2, 0]} r={0.07} h={h - 0.1} m={WHITE} />
          <Cyl p={[0, h - 0.06, 0]} r={Math.min(w, d) / 2} h={0.12} m={WHITE} />
        </group>
      );
    case 'shower':
      return (
        <group>
          <B p={[0, 0.03, 0]} s={[w, 0.06, d]} m={WHITE} />
          <B p={[0, h / 2, d / 2 - 0.01]} s={[w, h, 0.02]} m={{ color: '#aac9dd', roughness: 0.1 }} transparent opacity={0.3} />
          <B p={[w / 2 - 0.01, h / 2, 0]} s={[0.02, h, d]} m={{ color: '#aac9dd', roughness: 0.1 }} transparent opacity={0.3} />
          <Cyl p={[-w / 4, h - 0.15, -d / 4]} r={0.02} h={0.3} m={{ color: '#9aa1a8', metalness: 0.8, roughness: 0.3 }} />
        </group>
      );
    case 'bathtub':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={WHITE} />
          <B p={[0, h - 0.02, 0]} s={[w - 0.16, 0.06, d - 0.16]} m={{ color: '#cfe3ea', roughness: 0.2 }} />
        </group>
      );
    case 'plant':
      return (
        <group>
          <Cyl p={[0, h * 0.14, 0]} r={w * 0.32} rTop={w * 0.4} h={h * 0.28} m={{ color: '#9a6b43', roughness: 0.9 }} />
          <mesh position={[0, h * 0.62, 0]} castShadow>
            <sphereGeometry args={[w * 0.52, 16, 12]} />
            <meshStandardMaterial color={m.color} roughness={1} />
          </mesh>
          <mesh position={[w * 0.18, h * 0.82, 0.05]} castShadow>
            <sphereGeometry args={[w * 0.34, 14, 10]} />
            <meshStandardMaterial color={m.color} roughness={1} />
          </mesh>
        </group>
      );
    case 'tree': {
      const trunkH = h * 0.35;
      const leaf: Mat = { color: '#6d9c58', roughness: 1 };
      return (
        <group>
          <Cyl p={[0, trunkH / 2, 0]} r={w * 0.06} h={trunkH} m={{ color: '#7a5b3e', roughness: 1 }} />
          <mesh position={[0, h * 0.62, 0]} castShadow>
            <sphereGeometry args={[w * 0.42, 16, 12]} />
            <meshStandardMaterial color={leaf.color} roughness={1} />
          </mesh>
          <mesh position={[w * 0.2, h * 0.5, w * 0.12]} castShadow>
            <sphereGeometry args={[w * 0.3, 14, 10]} />
            <meshStandardMaterial color="#7fae6b" roughness={1} />
          </mesh>
          <mesh position={[-w * 0.18, h * 0.55, -w * 0.1]} castShadow>
            <sphereGeometry args={[w * 0.28, 14, 10]} />
            <meshStandardMaterial color="#5c8a4c" roughness={1} />
          </mesh>
        </group>
      );
    }
    case 'tree-fir': {
      const trunkH = h * 0.22;
      const tiers = [
        [h * 0.32, w * 0.5, h * 0.35],
        [h * 0.55, w * 0.4, h * 0.3],
        [h * 0.76, w * 0.28, h * 0.26],
      ] as const;
      return (
        <group>
          <Cyl p={[0, trunkH / 2, 0]} r={w * 0.05} h={trunkH} m={{ color: '#6e5138', roughness: 1 }} />
          {tiers.map(([y, r, th], i) => (
            <mesh key={i} position={[0, y, 0]} castShadow>
              <coneGeometry args={[r, th, 12]} />
              <meshStandardMaterial color={i % 2 ? '#4f7a44' : '#5c8a4c'} roughness={1} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'rug':
    case 'floor-patch':
      return <B p={[0, 0.01, 0]} s={[w, 0.02, d]} m={m} />;
    case 'ceiling-panel':
      return <B p={[0, 0.05, 0]} s={[w, 0.1, d]} m={m} />;
    case 'lamp-floor':
      return (
        <group>
          <Cyl p={[0, 0.02, 0]} r={w * 0.4} h={0.04} m={DARK} />
          <Cyl p={[0, h / 2, 0]} r={0.015} h={h - 0.3} m={DARK} />
          <Cyl p={[0, h - 0.15, 0]} r={w * 0.5} rTop={w * 0.32} h={0.3} m={{ color: '#e8dcc2', roughness: 0.9 }} />
        </group>
      );
    case 'lamp-ceiling':
      return (
        <group>
          <Cyl p={[0, h - 0.03, 0]} r={0.012} h={Math.max(0.02, h - 0.16)} m={DARK} />
          <Cyl p={[0, 0.08, 0]} r={w / 2} rTop={w * 0.3} h={0.16} m={{ color: '#e8dcc2', roughness: 0.9 }} />
        </group>
      );
    case 'railing': {
      // Frameless glass balustrade: steel shoe, glass panels, slim handrail.
      const posts = Math.max(2, Math.round(w / 1.2) + 1);
      return (
        <group>
          <B p={[0, 0.04, 0]} s={[w, 0.08, Math.max(0.06, d)]} m={DARK} />
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w - 0.04, h - 0.12, 0.016]} />
            <meshPhysicalMaterial
              color="#bcd6e4"
              roughness={0.05}
              metalness={0}
              transparent
              opacity={0.28}
              transmission={0.6}
            />
          </mesh>
          {Array.from({ length: posts }, (_, i) => (
            <B
              key={i}
              p={[-w / 2 + 0.03 + ((w - 0.06) * i) / (posts - 1), h / 2, 0]}
              s={[0.03, h - 0.08, 0.03]}
              m={{ color: '#8f979e', roughness: 0.35, metalness: 0.85 }}
            />
          ))}
          <B p={[0, h - 0.02, 0]} s={[w, 0.04, Math.max(0.05, d * 0.7)]} m={{ color: '#7c848b', roughness: 0.3, metalness: 0.9 }} />
        </group>
      );
    }
    case 'slats': {
      // Vertical wood-slat privacy screen.
      const count = Math.max(3, Math.round(w / 0.15));
      const slatW = (w / count) * 0.55;
      return (
        <group>
          <B p={[0, 0.03, 0]} s={[w, 0.06, Math.max(0.05, d)]} m={DARK} />
          <B p={[0, h - 0.03, 0]} s={[w, 0.06, Math.max(0.05, d)]} m={DARK} />
          {Array.from({ length: count }, (_, i) => (
            <B
              key={i}
              p={[-w / 2 + (w * (i + 0.5)) / count, h / 2, 0]}
              s={[slatW, h - 0.1, Math.max(0.04, d * 0.6)]}
              m={m}
            />
          ))}
        </group>
      );
    }
    case 'strip-light':
      // Cove/profile LED strip: aluminium channel + emissive diffuser.
      return (
        <group>
          <B p={[0, h * 0.75, 0]} s={[w, h * 0.5, d]} m={DARK} />
          <mesh position={[0, h * 0.25, 0]}>
            <boxGeometry args={[w - 0.02, h * 0.5, d * 0.8]} />
            <meshStandardMaterial color="#fff2d8" emissive="#ffd9a0" emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        </group>
      );
    case 'planter': {
      const soilH = h * 0.85;
      const shrubs = Math.max(1, Math.round(w / 0.45));
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <B p={[0, soilH, 0]} s={[w - 0.08, 0.04, d - 0.08]} m={{ color: '#4a3b2c', roughness: 1 }} />
          {Array.from({ length: shrubs }, (_, i) => (
            <mesh key={i} position={[-w / 2 + (w * (i + 0.5)) / shrubs, soilH + d * 0.35, 0]} castShadow>
              <sphereGeometry args={[Math.min(d, w / shrubs) * 0.42, 12, 10]} />
              <meshStandardMaterial color={i % 2 ? '#5c8a4c' : '#6d9c58'} roughness={1} />
            </mesh>
          ))}
        </group>
      );
    }
    case 'car-sedan':
    case 'car-suv':
    case 'car-hatch': {
      // Clean massing model: body, cabin greenhouse, wheels, glass, lights.
      const suv = kind === 'car-suv';
      const hatch = kind === 'car-hatch';
      const bodyH = suv ? h * 0.45 : h * 0.42;
      const cabinH = h - bodyH;
      const cabinD = d * (hatch ? 0.5 : 0.45);
      const cabinZ = hatch ? d * 0.1 : suv ? d * 0.05 : 0;
      const wheelR = h * (suv ? 0.24 : 0.22);
      const paint: Mat = { color: m.color, roughness: 0.25, metalness: 0.6 };
      const glass: Mat = { color: '#1d2a33', roughness: 0.1, metalness: 0.4 };
      return (
        <group>
          <B p={[0, wheelR + bodyH / 2 - 0.05, 0]} s={[w, bodyH, d]} m={paint} />
          {/* cabin */}
          <B p={[0, wheelR + bodyH + cabinH / 2 - 0.08, cabinZ]} s={[w - 0.18, cabinH, cabinD]} m={paint} />
          <B p={[0, wheelR + bodyH + cabinH / 2 - 0.08, cabinZ]} s={[w - 0.24, cabinH - 0.08, cabinD + 0.02]} m={glass} />
          {/* wheels */}
          {([-1, 1] as const).flatMap((sx) =>
            ([-1, 1] as const).map((sz) => (
              <mesh
                key={`${sx}${sz}`}
                position={[sx * (w / 2 - 0.06), wheelR, sz * (d / 2 - d * 0.22)]}
                rotation={[0, 0, Math.PI / 2]}
                castShadow
              >
                <cylinderGeometry args={[wheelR, wheelR, 0.16, 18]} />
                <meshStandardMaterial color="#17181a" roughness={0.9} />
              </mesh>
            )),
          )}
          {/* lights */}
          <B p={[-w * 0.3, wheelR + bodyH * 0.55, -d / 2 - 0.005]} s={[w * 0.2, 0.07, 0.02]} m={{ color: '#e8ecef', roughness: 0.2 }} />
          <B p={[w * 0.3, wheelR + bodyH * 0.55, -d / 2 - 0.005]} s={[w * 0.2, 0.07, 0.02]} m={{ color: '#e8ecef', roughness: 0.2 }} />
          <B p={[-w * 0.3, wheelR + bodyH * 0.55, d / 2 + 0.005]} s={[w * 0.2, 0.06, 0.02]} m={{ color: '#a33227', roughness: 0.3 }} />
          <B p={[w * 0.3, wheelR + bodyH * 0.55, d / 2 + 0.005]} s={[w * 0.2, 0.06, 0.02]} m={{ color: '#a33227', roughness: 0.3 }} />
        </group>
      );
    }
    case 'bike': {
      const wheelR = d * 0.22;
      const frame: Mat = { color: m.color, roughness: 0.4, metalness: 0.7 };
      const wheel = (z: number) => (
        <mesh position={[0, wheelR, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <torusGeometry args={[wheelR, 0.02, 8, 24]} />
          <meshStandardMaterial color="#1c1d1f" roughness={0.8} />
        </mesh>
      );
      return (
        <group>
          {wheel(-d / 2 + wheelR)}
          {wheel(d / 2 - wheelR)}
          <B p={[0, wheelR * 1.7, 0]} s={[0.035, 0.035, d * 0.52]} m={frame} />
          <B p={[0, wheelR * 1.15, -d * 0.12]} s={[0.03, wheelR * 1.4, 0.03]} m={frame} />
          <B p={[0, h - 0.12, -d / 2 + wheelR]} s={[w, 0.03, 0.03]} m={frame} />
          <B p={[0, h - 0.18, d * 0.16]} s={[0.25, 0.04, 0.08]} m={{ color: '#2a2b2e', roughness: 0.8 }} />
        </group>
      );
    }
    case 'pergola': {
      const post: Mat = { color: m.color, roughness: 0.7 };
      const p: { x: number; z: number }[] = [
        { x: -w / 2 + 0.08, z: -d / 2 + 0.08 },
        { x: w / 2 - 0.08, z: -d / 2 + 0.08 },
        { x: -w / 2 + 0.08, z: d / 2 - 0.08 },
        { x: w / 2 - 0.08, z: d / 2 - 0.08 },
      ];
      const slats = Math.max(5, Math.round(w / 0.35));
      return (
        <group>
          {p.map((q, i) => (
            <B key={i} p={[q.x, (h - 0.15) / 2, q.z]} s={[0.14, h - 0.15, 0.14]} m={post} />
          ))}
          <B p={[0, h - 0.12, -d / 2 + 0.08]} s={[w, 0.14, 0.1]} m={post} />
          <B p={[0, h - 0.12, d / 2 - 0.08]} s={[w, 0.14, 0.1]} m={post} />
          {Array.from({ length: slats }, (_, i) => (
            <B key={`s${i}`} p={[-w / 2 + (w * (i + 0.5)) / slats, h - 0.03, 0]} s={[0.06, 0.1, d]} m={post} />
          ))}
        </group>
      );
    }
    case 'box':
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />;
  }
}
