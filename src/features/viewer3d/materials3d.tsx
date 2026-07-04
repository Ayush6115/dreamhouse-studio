import { Component, Suspense, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import type { Material } from '../../types';

/**
 * Shared 3D material for walls/floors/ground: PBR texture set when the
 * material has one (loaded with suspense, flat-color fallback while loading
 * or if the asset is missing), plain standard material otherwise.
 */

interface Props {
  material: Material;
  selected?: boolean;
  side?: THREE.Side;
}

export class MaterialErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/** Glossy surfaces pick up more of the HDRI environment (reflections). */
const envIntensity = (roughness: number | undefined) =>
  (roughness ?? 0.9) < 0.35 ? 1.35 : 0.65;

function FlatMaterial({ material, selected, side }: Props) {
  return (
    <meshStandardMaterial
      color={material.color}
      roughness={material.roughness ?? 0.9}
      metalness={material.metalness ?? 0}
      envMapIntensity={envIntensity(material.roughness)}
      emissive={selected ? '#2f6fee' : '#000000'}
      emissiveIntensity={selected ? 0.35 : 0}
      side={side}
    />
  );
}

/**
 * Repeat-configured texture clones, shared across every mesh using the same
 * texture set + scale. Sharing matters: dozens of wall pieces reuse ONE set
 * of GPU textures, and the GLB exporter encodes each image exactly once.
 */
const cloneCache = new Map<string, { map: THREE.Texture; normalMap: THREE.Texture; roughnessMap: THREE.Texture }>();

function TexturedMaterial({ material, selected, side }: Props) {
  const base = `/assets/textures/${material.texture}/`;
  const raw = useTexture({
    map: `${base}color.jpg`,
    normalMap: `${base}normal.jpg`,
    roughnessMap: `${base}roughness.jpg`,
  });
  const scale = material.textureScale ?? 1;

  const maps = useMemo(() => {
    const key = `${material.texture}|${scale}`;
    const cached = cloneCache.get(key);
    if (cached) return cached;
    const prep = (t: THREE.Texture, srgb: boolean): THREE.Texture => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(1 / scale, 1 / scale);
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      c.anisotropy = 4;
      c.needsUpdate = true;
      return c;
    };
    const set = {
      map: prep(raw.map, true),
      normalMap: prep(raw.normalMap, false),
      roughnessMap: prep(raw.roughnessMap, false),
    };
    cloneCache.set(key, set);
    return set;
  }, [raw, scale, material.texture]);

  return (
    <meshStandardMaterial
      map={maps.map}
      normalMap={maps.normalMap}
      roughnessMap={maps.roughnessMap}
      color={material.color}
      roughness={material.roughness ?? 1}
      metalness={material.metalness ?? 0}
      envMapIntensity={envIntensity(material.roughness)}
      emissive={selected ? '#2f6fee' : '#000000'}
      emissiveIntensity={selected ? 0.3 : 0}
      side={side}
    />
  );
}

export function ElementMaterial(props: Props) {
  if (!props.material.texture) return <FlatMaterial {...props} />;
  return (
    <MaterialErrorBoundary fallback={<FlatMaterial {...props} />}>
      <Suspense fallback={<FlatMaterial {...props} />}>
        <TexturedMaterial {...props} />
      </Suspense>
    </MaterialErrorBoundary>
  );
}
