import { useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';

/**
 * Production GLB/GLTF model, normalized to the element's parametric box:
 * scaled so its bounding box matches (w × h × d) and grounded at y = 0.
 * This keeps GLB items fully editable — resizing the element resizes the
 * model — and interchangeable with the parametric fallbacks.
 */
interface Props {
  url: string;
  w: number;
  d: number;
  h: number;
  /** Extra yaw (radians) to align the model's "front" with local +z. */
  rotationOffset?: number;
}

export function GltfModel({ url, w, d, h, rotationOffset = 0 }: Props) {
  const gltf = useGLTF(url);

  const { object, scale, position } = useMemo(() => {
    // Clone (shares geometry/materials) so multiple placements don't fight.
    const object = gltf.scene.clone(true);
    object.rotation.y = rotationOffset;
    object.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    const sx = w / Math.max(size.x, 1e-6);
    const sy = h / Math.max(size.y, 1e-6);
    const sz = d / Math.max(size.z, 1e-6);
    return {
      object,
      scale: [sx, sy, sz] as const,
      position: [-center.x * sx, -box.min.y * sy, -center.z * sz] as const,
    };
  }, [gltf.scene, w, d, h, rotationOffset]);

  return (
    <group scale={[scale[0], scale[1], scale[2]]} position={[position[0], position[1], position[2]]}>
      <primitive object={object} />
    </group>
  );
}
