import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Dormer, RoofElement } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { roofGeometry, roofSurfaceNormal, roofSurfaceZ, type RoofFace } from '../../geometry/roof';
import { ElementMaterial } from './materials3d';

/**
 * 3D roof: faces from geometry/roof.ts triangulated into a BufferGeometry
 * with planar per-face UVs (meters, so PBR tiles repeat correctly).
 * Roof-local (x, y, z-up) maps into the group as (x, z-up, y).
 */

export function facesToGeometry(faces: RoofFace[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const bitangent = new THREE.Vector3();

  for (const face of faces) {
    // Local (x, y, z-up) → world-ish (x, z-up, y): swap y/z.
    const pts = face.pts.map((p) => new THREE.Vector3(p.x, p.z, p.y));
    va.subVectors(pts[1], pts[0]);
    vb.subVectors(pts[2], pts[0]);
    normal.crossVectors(va, vb).normalize();
    tangent.copy(va).normalize();
    bitangent.crossVectors(normal, tangent);

    for (let i = 1; i < pts.length - 1; i++) {
      for (const p of [pts[0], pts[i], pts[i + 1]]) {
        positions.push(p.x, p.y, p.z);
        const rel = new THREE.Vector3().subVectors(p, pts[0]);
        uvs.push(rel.dot(tangent), rel.dot(bitangent));
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Dormer: vertical front wall with a window, side cheeks, and a small gable
 * cap with its ridge running upslope. Seated on the roof surface; the seam
 * is hidden inside the roof solid.
 */
function DormerMesh({ roof, dormer, selected }: { roof: RoofElement; dormer: Dormer; selected: boolean }) {
  const W = roof.dimensions.width + 2 * roof.overhang;
  const D = roof.dimensions.depth + 2 * roof.overhang;
  const th = roof.dimensions.thickness ?? 0.15;
  const s = dormer.y >= 0 ? 1 : -1; // front faces the nearer eave
  const depth = Math.max(0.6, dormer.width * 0.85);
  const zFront = roofSurfaceZ(roof.roofStyle, W, D, roof.pitch, th, dormer.x, dormer.y);

  const capGeometry = useMemo(
    () => facesToGeometry(roofGeometry('gable', depth + 0.24, dormer.width + 0.28, 35, 0.1).faces),
    [depth, dormer.width],
  );
  useEffect(() => () => capGeometry.dispose(), [capGeometry]);

  if (zFront === null) return null;
  const h = dormer.height;
  const w = dormer.width;

  return (
    <group position={[dormer.x, zFront - 0.35, dormer.y]} rotation={[0, s === 1 ? 0 : Math.PI, 0]}>
      {/* front wall */}
      <mesh position={[0, h / 2, -0.05]} castShadow>
        <boxGeometry args={[w, h, 0.1]} />
        <meshStandardMaterial color="#ece8df" roughness={0.9} emissive={selected ? '#2f6fee' : '#000'} emissiveIntensity={selected ? 0.3 : 0} />
      </mesh>
      {/* window */}
      <mesh position={[0, h * 0.55, 0.011]}>
        <boxGeometry args={[w * 0.55, h * 0.5, 0.02]} />
        <meshStandardMaterial color="#aac9dd" roughness={0.08} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, h * 0.55, 0.005]}>
        <boxGeometry args={[w * 0.62, h * 0.57, 0.015]} />
        <meshStandardMaterial color="#5c5650" roughness={0.5} />
      </mesh>
      {/* side cheeks */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (w / 2 - 0.045), h / 2, -depth / 2]} castShadow>
          <boxGeometry args={[0.09, h, depth]} />
          <meshStandardMaterial color="#ece8df" roughness={0.9} />
        </mesh>
      ))}
      {/* gable cap, ridge running upslope */}
      <mesh geometry={capGeometry} position={[0, h, -depth / 2 + 0.02]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <ElementMaterial material={roof.material} selected={selected} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export function RoofMesh({ roof, baseY }: { roof: RoofElement; baseY: number }) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const selected = useDesignStore((s) => s.selectedIds.includes(roof.id));
  const geometry = useMemo(() => {
    const W = roof.dimensions.width + 2 * roof.overhang;
    const D = roof.dimensions.depth + 2 * roof.overhang;
    return facesToGeometry(
      roofGeometry(roof.roofStyle, W, D, roof.pitch, roof.dimensions.thickness ?? 0.15).faces,
    );
  }, [roof]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const W = roof.dimensions.width + 2 * roof.overhang;
  const D = roof.dimensions.depth + 2 * roof.overhang;
  const th = roof.dimensions.thickness ?? 0.15;

  return (
    <group
      position={[roof.transform.position.x, baseY + roof.transform.position.z, roof.transform.position.y]}
      rotation={[0, -roof.transform.rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelection([roof.id]);
      }}
    >
      <mesh geometry={geometry} castShadow receiveShadow>
        <ElementMaterial material={roof.material} selected={selected} side={THREE.DoubleSide} />
      </mesh>

      {/* parapet for flat roofs */}
      {roof.roofStyle === 'flat' && roof.parapetHeight > 0.01 && (
        <group position={[0, th, 0]}>
          {(
            [
              [0, -D / 2 + 0.075, W, 0.15],
              [0, D / 2 - 0.075, W, 0.15],
              [-W / 2 + 0.075, 0, 0.15, D - 0.3],
              [W / 2 - 0.075, 0, 0.15, D - 0.3],
            ] as const
          ).map(([x, z, sx, sz], i) => (
            <mesh key={i} position={[x, roof.parapetHeight / 2, z]} castShadow receiveShadow>
              <boxGeometry args={[sx, roof.parapetHeight, sz]} />
              <ElementMaterial material={roof.material} selected={selected} />
            </mesh>
          ))}
        </group>
      )}

      {/* dormers */}
      {roof.roofStyle !== 'flat' &&
        roof.dormers.map((dm, i) => <DormerMesh key={`dm${i}`} roof={roof} dormer={dm} selected={selected} />)}

      {/* skylights seated on the slope */}
      {roof.skylights.map((sk, i) => {
        const z = roofSurfaceZ(roof.roofStyle, W, D, roof.pitch, th, sk.x, sk.y);
        if (z === null) return null;
        const n = roofSurfaceNormal(roof.roofStyle, W, D, roof.pitch, th, sk.x, sk.y);
        const nThree = new THREE.Vector3(n.x, n.z, n.y);
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), nThree);
        return (
          <group key={i} position={[sk.x, z + 0.04, sk.y]} quaternion={quat}>
            <mesh castShadow>
              <boxGeometry args={[sk.width, 0.09, sk.depth]} />
              <meshStandardMaterial color="#4c463e" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.055, 0]}>
              <boxGeometry args={[sk.width * 0.88, 0.03, sk.depth * 0.88]} />
              <meshStandardMaterial color="#aac9dd" roughness={0.08} metalness={0.1} transparent opacity={0.45} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
