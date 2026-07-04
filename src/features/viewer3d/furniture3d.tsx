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

const WOOD: Mat = { color: '#8a6845', roughness: 0.7 };
const DARK: Mat = { color: '#3a3d42', roughness: 0.6 };
const WHITE: Mat = { color: '#eceae4', roughness: 0.4 };

export function FurnitureModel({ kind, w, d, h, color, roughness, metalness }: ModelProps): ReactNode {
  const m: Mat = { color, roughness, metalness };

  switch (kind) {
    case 'bed':
      return (
        <group>
          <B p={[0, 0.11, 0]} s={[w, 0.22, d]} m={WOOD} />
          <B p={[0, 0.31, 0]} s={[w - 0.08, 0.18, d - 0.08]} m={m} />
          <B p={[0, 0.28 + (h - 0.4) / 2, -d / 2 + 0.04]} s={[w, h - 0.4, 0.08]} m={WOOD} />
          <B p={[-w / 4 + 0.02, 0.44, -d / 2 + 0.28]} s={[w / 2 - 0.16, 0.09, 0.36]} m={WHITE} />
          {w > 1.2 && <B p={[w / 4 - 0.02, 0.44, -d / 2 + 0.28]} s={[w / 2 - 0.16, 0.09, 0.36]} m={WHITE} />}
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
    case 'wardrobe':
      return (
        <group>
          <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />
          <B p={[0, h / 2, d / 2 + 0.006]} s={[0.02, h - 0.1, 0.012]} m={DARK} />
        </group>
      );
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
    case 'box':
    default:
      return <B p={[0, h / 2, 0]} s={[w, h, d]} m={m} />;
  }
}
