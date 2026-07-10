import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, PointerLockControls, SoftShadows, useTexture } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useUiStore } from '../../store/uiStore';
import type { Level, Material, OpeningElement, Point, RoofElement, RoomElement, WallElement } from '../../types';
import { isOpening, isRoom, isWall } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { ensureClockwise, polygonCentroid } from '../../geometry/polygon';
import { add, norm, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness, wallsUnionOutlines } from '../../geometry/walls';
import { catalogItemById } from '../../library/catalog';
import { materialById } from '../../library/materials';
import { trimPiecesToRoofs, wallPieces } from './geometry3d';
import { FurnitureModel } from './furniture3d';
import { GltfModel } from './GltfModel';
import { RoofMesh } from './RoofMesh';
import { assetUrl } from '../../assetUrl';
import { ElementMaterial, MaterialErrorBoundary } from './materials3d';
import { PhotorealRender } from './PhotorealRender';
import { exportRegistry } from '../export/registry';

/**
 * The 3D view is DERIVED from the design document on every change. V2 adds
 * production quality: PBR textures, CC0 GLB furniture (parametric fallback),
 * HDRI environment lighting, soft shadows and ACES tone mapping.
 * Orbit + zoom camera only (per scope).
 */

const HDRI_DAY = assetUrl('assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr');
const HDRI_NIGHT = assetUrl('assets/hdri/moonless_golf_1k.hdr');

/** Extrude a plan polygon between two heights (above `baseY`). */
function PrismMesh({
  poly,
  z0,
  z1,
  baseY,
  material,
  selected,
  onClick,
}: {
  poly: Point[];
  z0: number;
  z1: number;
  baseY: number;
  material: Material;
  selected?: boolean;
  onClick?: () => void;
}) {
  const geometry = useMemo(() => {
    const pts = ensureClockwise(poly); // shoelace-positive = CCW for THREE.Shape
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
    geo.rotateX(Math.PI / 2); // plan (x,y) → world (x,z); extrusion → -Y
    return geo;
  }, [poly, z0, z1]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position={[0, baseY + z1, 0]}
      castShadow
      receiveShadow
      onClick={
        onClick &&
        ((e) => {
          e.stopPropagation();
          onClick();
        })
      }
    >
      <ElementMaterial material={material} selected={selected} />
    </mesh>
  );
}

function Wall3D({
  wall,
  walls,
  openings,
  roofs,
  baseY,
}: {
  wall: WallElement;
  walls: WallElement[];
  openings: OpeningElement[];
  roofs: RoofElement[];
  baseY: number;
}) {
  const selected = useDesignStore((s) => s.selectedIds.includes(wall.id));
  const setSelection = useDesignStore((s) => s.setSelection);

  // All pieces (opening splits + roof-trim strips) merge into ONE geometry:
  // one draw call per wall, and exports stay lean.
  const geometry = useMemo(() => {
    const pieces = trimPiecesToRoofs(wallPieces(wall, walls, openings), wall, roofs);
    const geos = pieces
      .filter((p) => p.poly.length >= 3 && p.z1 - p.z0 > 1e-4)
      .map((p) => {
        const pts = ensureClockwise(p.poly);
        const shape = new THREE.Shape(pts.map((q) => new THREE.Vector2(q.x, q.y)));
        const geo = new THREE.ExtrudeGeometry(shape, { depth: p.z1 - p.z0, bevelEnabled: false });
        geo.rotateX(Math.PI / 2); // plan (x,y) → (x,z); extrusion → -Y
        geo.translate(0, p.z1, 0);
        return geo;
      });
    if (geos.length === 0) return null;
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    return merged;
  }, [wall, walls, openings, roofs]);

  useEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      position={[0, baseY, 0]}
      castShadow
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        setSelection([wall.id]);
      }}
    >
      <ElementMaterial material={wall.material} selected={selected} />
    </mesh>
  );
}

const FRAME_DARK = '#3c3e42'; // powder-coated window sections
const CONCRETE_TRIM = '#cfccc3'; // chajjas, sills, copings

/** Shade slab (chajja) + sill projecting on the exterior face of an opening. */
function ShadeAndSill({
  w,
  topY,
  sillY,
  th,
  outward,
  withSill,
}: {
  w: number;
  topY: number;
  sillY: number;
  th: number;
  outward: 1 | -1;
  withSill: boolean;
}) {
  const depth = 0.42;
  return (
    <>
      <mesh position={[0, topY + 0.05, outward * (th / 2 + depth / 2 - 0.06)]} castShadow receiveShadow>
        <boxGeometry args={[w + 0.32, 0.08, depth]} />
        <meshStandardMaterial color={CONCRETE_TRIM} roughness={0.92} />
      </mesh>
      {withSill && (
        <mesh position={[0, sillY - 0.03, outward * (th / 2 + 0.05)]} castShadow receiveShadow>
          <boxGeometry args={[w + 0.14, 0.06, 0.18]} />
          <meshStandardMaterial color={CONCRETE_TRIM} roughness={0.92} />
        </mesh>
      )}
    </>
  );
}

function Opening3D({
  opening,
  host,
  baseY,
  outward = 1,
}: {
  opening: OpeningElement;
  host: WallElement;
  baseY: number;
  outward?: 1 | -1;
}) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const selected = useDesignStore((s) => s.selectedIds.includes(opening.id));
  const dir = norm(sub(host.end, host.start));
  const center = add(host.start, vscale(dir, opening.offset));
  const angle = Math.atan2(dir.y, dir.x);
  const w = opening.dimensions.width;
  const h = opening.dimensions.height;
  const th = wallThickness(host);
  const leafDark = useMemo(
    () => `#${new THREE.Color(opening.material.color).multiplyScalar(0.72).getHexString()}`,
    [opening.material.color],
  );

  /** Paneled leaf with handle — the flat slab read as a toy before. */
  const leaf = (lw: number, x: number, z: number, handleSide: 1 | -1) => (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[lw, h * 0.99, 0.05]} />
        <ElementMaterial material={opening.material} selected={selected} />
      </mesh>
      {/* recessed panels on both faces */}
      {([-1, 1] as const).map((face) => (
        <group key={face}>
          <mesh position={[0, h * 0.68, face * 0.027]}>
            <boxGeometry args={[lw * 0.68, h * 0.42, 0.006]} />
            <meshStandardMaterial color={leafDark} roughness={0.7} />
          </mesh>
          <mesh position={[0, h * 0.25, face * 0.027]}>
            <boxGeometry args={[lw * 0.68, h * 0.32, 0.006]} />
            <meshStandardMaterial color={leafDark} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* handle */}
      <mesh position={[handleSide * (lw / 2 - 0.09), h * 0.48, 0.045]} castShadow>
        <cylinderGeometry args={[0.014, 0.014, 0.13, 10]} />
        <meshStandardMaterial color="#8f959b" roughness={0.3} metalness={0.9} />
      </mesh>
    </group>
  );

  return (
    <group
      position={[center.x, baseY, center.y]}
      rotation={[0, -angle, 0]}
      onClick={(e) => {
        e.stopPropagation();
        setSelection([opening.id]);
      }}
    >
      {opening.type === 'door' ? (
        <>
          {/* architrave frame */}
          {(
            [
              [-w / 2 - 0.035, h / 2, 0.07, h],
              [w / 2 + 0.035, h / 2, 0.07, h],
              [0, h + 0.035, w + 0.14, 0.07],
            ] as const
          ).map(([x, y, bw, bh], i) => (
            <mesh key={i} position={[x, y, 0]} castShadow>
              <boxGeometry args={[bw, bh, th + 0.03]} />
              <meshStandardMaterial color={leafDark} roughness={0.65} />
            </mesh>
          ))}
          {opening.style === 'double' ? (
            <>
              {leaf(w * 0.46, -(w * 0.235 + 0.005), 0, 1)}
              {leaf(w * 0.46, w * 0.235 + 0.005, 0, -1)}
            </>
          ) : opening.style === 'sliding' ? (
            <>
              {/* glazed sliding panels */}
              {([-1, 1] as const).map((side) => (
                <group key={side} position={[side * w * 0.24, 0, side * 0.03]}>
                  <mesh position={[0, h / 2, 0]}>
                    <boxGeometry args={[w * 0.5, h * 0.97, 0.045]} />
                    <meshStandardMaterial color={FRAME_DARK} roughness={0.45} metalness={0.4} />
                  </mesh>
                  <mesh position={[0, h / 2, 0]}>
                    <boxGeometry args={[w * 0.44, h * 0.86, 0.055]} />
                    <meshPhysicalMaterial
                      color="#b9d4e4"
                      roughness={0.05}
                      metalness={0}
                      transparent
                      opacity={0.32}
                      clearcoat={1}
                      envMapIntensity={1.3}
                    />
                  </mesh>
                </group>
              ))}
            </>
          ) : (
            leaf(w * 0.94, 0, 0, 1)
          )}
          {/* threshold + shade over external doors */}
          <mesh position={[0, 0.012, 0]} receiveShadow>
            <boxGeometry args={[w + 0.1, 0.024, th + 0.1]} />
            <meshStandardMaterial color={CONCRETE_TRIM} roughness={0.95} />
          </mesh>
          <ShadeAndSill w={w} topY={h + 0.07} sillY={0} th={th} outward={outward} withSill={false} />
        </>
      ) : (
        <>
          {/* glass — physically-based so the sky/env reflects in it */}
          <mesh position={[0, opening.sillHeight + h / 2, 0]}>
            <boxGeometry args={[w * 0.96, h * 0.96, 0.02]} />
            <meshPhysicalMaterial
              color={opening.material.color}
              roughness={0.04}
              metalness={0}
              transparent
              opacity={0.3}
              clearcoat={1}
              envMapIntensity={1.4}
              emissive={selected ? '#2f6fee' : '#000'}
              emissiveIntensity={selected ? 0.3 : 0}
            />
          </mesh>
          {/* outer frame */}
          {(
            [
              [0, opening.sillHeight + 0.025, w, 0.05],
              [0, opening.sillHeight + h - 0.025, w, 0.05],
              [-w / 2 + 0.025, opening.sillHeight + h / 2, 0.05, h],
              [w / 2 - 0.025, opening.sillHeight + h / 2, 0.05, h],
            ] as const
          ).map(([x, y, bw, bh], i) => (
            <mesh key={i} position={[x, y, 0]} castShadow>
              <boxGeometry args={[bw, bh, Math.min(th * 0.7, 0.1)]} />
              <meshStandardMaterial color={FRAME_DARK} roughness={0.45} metalness={0.4} />
            </mesh>
          ))}
          {/* mullions + center transom */}
          {Array.from(
            { length: opening.mullions ?? (opening.style === 'sliding' || opening.style === 'casement' ? 1 : 0) },
            (_, i) => {
              const count = (opening.mullions ?? 1) + 1;
              const x = -w / 2 + ((i + 1) * w) / count;
              return (
                <mesh key={`m${i}`} position={[x, opening.sillHeight + h / 2, 0]}>
                  <boxGeometry args={[0.04, h - 0.05, Math.min(th * 0.5, 0.07)]} />
                  <meshStandardMaterial color={FRAME_DARK} roughness={0.45} metalness={0.4} />
                </mesh>
              );
            },
          )}
          <mesh position={[0, opening.sillHeight + h / 2, 0]}>
            <boxGeometry args={[w - 0.05, 0.035, Math.min(th * 0.45, 0.06)]} />
            <meshStandardMaterial color={FRAME_DARK} roughness={0.45} metalness={0.4} />
          </mesh>
          <ShadeAndSill
            w={w}
            topY={opening.sillHeight + h}
            sillY={opening.sillHeight}
            th={th}
            outward={outward}
            withSill
          />
        </>
      )}
    </group>
  );
}

function Room3D({ room, baseY }: { room: RoomElement; baseY: number }) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const selected = useDesignStore((s) => s.selectedIds.includes(room.id));
  if (room.boundary.length < 3) return null;
  return (
    <PrismMesh
      poly={room.boundary}
      z0={0}
      z1={0.05}
      baseY={baseY}
      material={room.material}
      selected={selected}
      onClick={() => setSelection([room.id])}
    />
  );
}

const LAMP_MODELS = new Set(['lamp-floor', 'lamp-ceiling', 'strip-light']);

function Items3D({ level, lampsOn }: { level: Level; lampsOn: boolean }) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const selectedIds = useDesignStore((s) => s.selectedIds);
  const baseY = level.elevation;

  return (
    <group>
      {level.elements.map((el) => {
        if (el.visible === false) return null;
        const selected = selectedIds.includes(el.id);

        if (el.type === 'roof') {
          return <RoofMesh key={el.id} roof={el} baseY={baseY} />;
        }

        if (el.type === 'column') {
          const { width: w, depth: d, height: h } = el.dimensions;
          return (
            <group
              key={el.id}
              position={[el.transform.position.x, baseY, el.transform.position.y]}
              rotation={[0, -el.transform.rotation, 0]}
              onClick={(e) => {
                e.stopPropagation();
                setSelection([el.id]);
              }}
            >
              <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
                {el.profile === 'round' ? (
                  <cylinderGeometry args={[w / 2, w / 2, h, 20]} />
                ) : (
                  <boxGeometry args={[w, h, d]} />
                )}
                <ElementMaterial material={el.material} selected={selected} />
              </mesh>
            </group>
          );
        }

        if (el.type === 'beam') {
          const len = Math.hypot(el.end.x - el.start.x, el.end.y - el.start.y);
          const ang = Math.atan2(el.end.y - el.start.y, el.end.x - el.start.x);
          const mid = { x: (el.start.x + el.end.x) / 2, y: (el.start.y + el.end.y) / 2 };
          return (
            <mesh
              key={el.id}
              position={[mid.x, baseY + el.transform.position.z + el.dimensions.height / 2, mid.y]}
              rotation={[0, -ang, 0]}
              castShadow
              onClick={(e) => {
                e.stopPropagation();
                setSelection([el.id]);
              }}
            >
              <boxGeometry args={[len, el.dimensions.height, el.dimensions.depth]} />
              <ElementMaterial material={el.material} selected={selected} />
            </mesh>
          );
        }

        if (el.type === 'staircase') {
          const { width: w, depth: d, height: h } = el.dimensions;
          const steps = Math.max(3, el.steps);
          const stepD = d / steps;
          return (
            <group
              key={el.id}
              position={[el.transform.position.x, baseY, el.transform.position.y]}
              rotation={[0, -el.transform.rotation, 0]}
              onClick={(e) => {
                e.stopPropagation();
                setSelection([el.id]);
              }}
            >
              {Array.from({ length: steps }, (_, i) => (
                <mesh
                  key={i}
                  position={[0, ((i + 1) * h) / steps / 2, d / 2 - (i + 0.5) * stepD]}
                  castShadow
                  receiveShadow
                >
                  <boxGeometry args={[w, ((i + 1) * h) / steps, stepD]} />
                  <ElementMaterial material={el.material} selected={selected} />
                </mesh>
              ))}
            </group>
          );
        }

        if (el.type === 'furniture') {
          const def = catalogItemById(el.catalogId);
          const t = el.transform;
          const { width: w, depth: d, height: h } = el.dimensions;
          const parametric = (
            <FurnitureModel
              kind={def?.model ?? 'box'}
              w={w}
              d={d}
              h={h}
              color={el.material.color}
              roughness={el.material.roughness}
              metalness={el.material.metalness}
            />
          );
          const isLamp = def ? LAMP_MODELS.has(def.model) : false;
          return (
            <group
              key={el.id}
              position={[t.position.x, baseY + t.position.z, t.position.y]}
              rotation={[0, -t.rotation, 0]}
              scale={[t.scale.x, t.scale.z, t.scale.y]}
              onClick={(e) => {
                e.stopPropagation();
                setSelection([el.id]);
              }}
            >
              {def?.glb ? (
                <MaterialErrorBoundary fallback={parametric}>
                  <Suspense fallback={parametric}>
                    <GltfModel
                      url={assetUrl(`assets/models/${def.glb}/${def.glb}.gltf`)}
                      w={w}
                      d={d}
                      h={h}
                      rotationOffset={def.glbRotation ?? 0}
                    />
                  </Suspense>
                </MaterialErrorBoundary>
              ) : (
                parametric
              )}
              {lampsOn && isLamp && (
                <pointLight
                  position={[0, def?.model === 'lamp-floor' ? h - 0.15 : h * 0.4, 0]}
                  intensity={def?.model === 'strip-light' ? 3.5 : 7}
                  distance={def?.model === 'strip-light' ? 5 : 8}
                  color="#ffd9a0"
                />
              )}
              {selected && (
                <mesh position={[0, h / 2, 0]}>
                  <boxGeometry args={[w + 0.06, h + 0.06, d + 0.06]} />
                  <meshStandardMaterial color="#4f8cff" transparent opacity={0.18} depthWrite={false} />
                </mesh>
              )}
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}

/** Inflate a polygon slightly about its centroid (for trim bands). */
function inflatePoly(poly: Point[], factor: number): Point[] {
  const c = polygonCentroid(poly);
  return poly.map((p) => ({ x: c.x + (p.x - c.x) * factor, y: c.y + (p.y - c.y) * factor }));
}

const PLINTH_MAT = { color: '#8f8b82', roughness: 0.95 };
const FASCIA_MAT = { color: '#d6d2c8', roughness: 0.9 };

/**
 * Construction trims that break up the plain extruded box: a plinth course
 * at grade and a floor-slab fascia band at the level top when another storey
 * sits above.
 */
function LevelTrims({
  walls,
  baseY,
  height,
  hasLevelAbove,
}: {
  walls: WallElement[];
  baseY: number;
  height: number;
  hasLevelAbove: boolean;
}) {
  const rings = useMemo(() => wallsUnionOutlines(walls.filter((w) => w.visible !== false)), [walls]);
  const geos = useMemo(() => {
    const make = (factor: number, z0: number, z1: number) => {
      const parts = rings
        .filter((r) => r.length >= 3)
        .map((r) => {
          const pts = ensureClockwise(inflatePoly(r, factor));
          const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)));
          const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
          geo.rotateX(Math.PI / 2);
          geo.translate(0, z1, 0);
          return geo;
        });
      if (parts.length === 0) return null;
      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      return merged;
    };
    return {
      plinth: baseY < 0.01 ? make(1.02, -0.03, 0.16) : null,
      fascia: hasLevelAbove ? make(1.012, height - 0.16, height + 0.02) : null,
    };
  }, [rings, baseY, height, hasLevelAbove]);
  useEffect(
    () => () => {
      geos.plinth?.dispose();
      geos.fascia?.dispose();
    },
    [geos],
  );

  return (
    <>
      {geos.plinth && (
        <mesh geometry={geos.plinth} position={[0, baseY, 0]} castShadow receiveShadow>
          <meshStandardMaterial {...PLINTH_MAT} />
        </mesh>
      )}
      {geos.fascia && (
        <mesh geometry={geos.fascia} position={[0, baseY, 0]} castShadow receiveShadow>
          <meshStandardMaterial {...FASCIA_MAT} />
        </mesh>
      )}
    </>
  );
}

function Level3D({ level, lampsOn, hasLevelAbove }: { level: Level; lampsOn: boolean; hasLevelAbove: boolean }) {
  const walls = useMemo(() => level.elements.filter(isWall), [level.elements]);
  const openings = useMemo(() => level.elements.filter(isOpening), [level.elements]);
  const rooms = useMemo(() => level.elements.filter(isRoom), [level.elements]);
  const roofs = useMemo(
    () => level.elements.filter((e): e is RoofElement => e.type === 'roof'),
    [level.elements],
  );
  const baseY = level.elevation;
  const centroid = useMemo(
    () =>
      walls.length > 0
        ? polygonCentroid(walls.flatMap((w) => [w.start, w.end]))
        : { x: 0, y: 0 },
    [walls],
  );

  return (
    <group>
      {rooms.map((r) => (
        <Room3D key={r.id} room={r} baseY={baseY} />
      ))}
      {walls.map((w) =>
        w.visible === false ? null : (
          <Wall3D key={w.id} wall={w} walls={walls} openings={openings} roofs={roofs} baseY={baseY} />
        ),
      )}
      <LevelTrims walls={walls} baseY={baseY} height={level.height ?? 3} hasLevelAbove={hasLevelAbove} />
      {openings.map((o) => {
        const host = walls.find((w) => w.id === o.wallId);
        if (!host || o.visible === false) return null;
        const dir = norm(sub(host.end, host.start));
        const center = add(host.start, vscale(dir, o.offset));
        const perp = { x: -dir.y, y: dir.x };
        const outward: 1 | -1 =
          perp.x * (center.x - centroid.x) + perp.y * (center.y - centroid.y) >= 0 ? 1 : -1;
        return <Opening3D key={o.id} opening={o} host={host} baseY={baseY} outward={outward} />;
      })}
      <Items3D level={level} lampsOn={lampsOn} />
    </group>
  );
}

const GROUND_RADIUS = 220;

function GrassMaterial({ night }: { night: boolean }) {
  const raw = useTexture({
    map: assetUrl('assets/textures/grass/color.jpg'),
    normalMap: assetUrl('assets/textures/grass/normal.jpg'),
    roughnessMap: assetUrl('assets/textures/grass/roughness.jpg'),
  });
  const maps = useMemo(() => {
    const repeat = (GROUND_RADIUS * 2) / 3; // one tile ≈ 3 m on the ground
    const prep = (t: THREE.Texture, srgb: boolean) => {
      const c = t.clone();
      c.wrapS = c.wrapT = THREE.RepeatWrapping;
      c.repeat.set(repeat, repeat);
      c.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      c.anisotropy = 4;
      c.needsUpdate = true;
      return c;
    };
    return { map: prep(raw.map, true), normalMap: prep(raw.normalMap, false), roughnessMap: prep(raw.roughnessMap, false) };
  }, [raw]);
  return (
    <meshStandardMaterial
      {...maps}
      color={night ? '#2c3a2c' : '#b5c9a0'}
      roughness={1}
    />
  );
}

function Ground({ night, plot }: { night: boolean; plot: Point[] }) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const paving = useMemo(() => {
    const m = { ...materialById('paving') };
    if (night) m.color = '#55524b';
    return m;
  }, [night]);
  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.12, 0]}
        receiveShadow
        onClick={() => setSelection([])}
      >
        <circleGeometry args={[GROUND_RADIUS, 48]} />
        <MaterialErrorBoundary fallback={<meshStandardMaterial color={night ? '#141d14' : '#8aa876'} roughness={1} />}>
          <Suspense fallback={<meshStandardMaterial color={night ? '#141d14' : '#8aa876'} roughness={1} />}>
            <GrassMaterial night={night} />
          </Suspense>
        </MaterialErrorBoundary>
      </mesh>
      {plot.length >= 3 && <PrismMesh poly={plot} z0={-0.1} z1={0} baseY={0} material={paving} />}
    </group>
  );
}

/** ACES tone mapping + exposure that follows the time-of-day mode. */
function RendererSettings({ mode }: { mode: 'day' | 'evening' | 'night' }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const setFrameloop = useThree((s) => s.setFrameloop);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = mode === 'night' ? 0.7 : mode === 'evening' ? 0.9 : 1.05;
  }, [gl, mode]);
  useEffect(() => {
    exportRegistry.scene3d = scene;
    exportRegistry.three = { gl, camera, setFrameloop };
    return () => {
      if (exportRegistry.scene3d === scene) exportRegistry.scene3d = null;
      if (exportRegistry.three?.gl === gl) exportRegistry.three = null;
    };
  }, [scene, gl, camera, setFrameloop]);
  return null;
}

/**
 * Sun direction from time-of-day (6–18 h) and the plot's north angle:
 * east at sunrise, high in the south at noon (northern hemisphere), west at
 * sunset. Returns a world-space position for the directional light.
 */
function sunPosition(hour: number, northAngleDeg: number, distance = 55): [number, number, number] {
  const azimuthCompass = 90 + ((hour - 6) / 12) * 180; // 90=E → 180=S → 270=W
  const elevation = (Math.sin((Math.PI * (hour - 6)) / 12) * 62 * Math.PI) / 180;
  const az = ((azimuthCompass + northAngleDeg) * Math.PI) / 180;
  const horiz = Math.cos(elevation);
  // Compass θ → plan vector (sin θ, -cos θ); plan (x, y) → world (x, z).
  return [
    Math.sin(az) * horiz * distance,
    Math.max(4, Math.sin(elevation) * distance),
    -Math.cos(az) * horiz * distance,
  ];
}

/**
 * First-person walkthrough: pointer-lock look + WASD movement at eye height.
 * R/F change height (stairs have no collision solver — you fly between
 * floors), Shift runs, Esc releases the mouse.
 */
function WalkControls({ start, target }: { start: Point; target: Point }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const setEvents = useThree((s) => s.setEvents);
  const keys = useRef<Record<string, boolean>>({});
  const startRef = useRef({ start, target });

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const prevFov = cam.fov;
    cam.fov = 68;
    const { start: s, target: t } = startRef.current;
    cam.position.set(s.x, 1.62, s.y);
    cam.lookAt(t.x, 1.45, t.y);
    cam.updateProjectionMatrix();
    // The lock-click must not raycast-select elements while touring.
    setEvents({ enabled: false });
    const down = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
    };
    const up = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      cam.fov = prevFov;
      cam.updateProjectionMatrix();
      setEvents({ enabled: true });
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [camera, setEvents]);

  const fwd = useMemo(() => new THREE.Vector3(), []);
  const rightV = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const k = keys.current;
    const step = (k.ShiftLeft || k.ShiftRight ? 4.6 : 2.1) * Math.min(dt, 0.05);
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-6) fwd.normalize();
    rightV.set(-fwd.z, 0, fwd.x);
    if (k.KeyW || k.ArrowUp) camera.position.addScaledVector(fwd, step);
    if (k.KeyS || k.ArrowDown) camera.position.addScaledVector(fwd, -step);
    if (k.KeyA || k.ArrowLeft) camera.position.addScaledVector(rightV, -step);
    if (k.KeyD || k.ArrowRight) camera.position.addScaledVector(rightV, step);
    if (k.KeyR || k.KeyE) camera.position.y += step;
    if (k.KeyF || k.KeyQ) camera.position.y -= step;
    camera.position.y = Math.min(30, Math.max(0.55, camera.position.y));
  });

  return <PointerLockControls makeDefault domElement={gl.domElement} />;
}

export function Scene3D() {
  const doc = useDesignStore((s) => s.doc);
  const dayNight = useDesignStore((s) => s.dayNight);
  const night = dayNight === 'night';
  const evening = dayNight === 'evening';
  const lampsOn = night || evening;
  const skyColor = night ? '#0a0f1c' : evening ? '#35425f' : '#bfd9ec';
  const sunHour = useDesignStore((s) => s.sunHour);
  const highQuality = useUiStore((s) => s.renderQuality === 'high');
  const navMode = useUiStore((s) => s.navMode);
  const setNavMode = useUiStore((s) => s.setNavMode);

  // Cache a snapshot when the 3D view unmounts, so exports from other views
  // can still include a render.
  useEffect(
    () => () => {
      const canvas = exportRegistry.glCanvas;
      if (canvas) {
        try {
          exportRegistry.last3DSnapshot = canvas.toDataURL('image/png');
        } catch {
          /* context lost — keep previous snapshot */
        }
        exportRegistry.glCanvas = null;
      }
    },
    [],
  );

  const center = useMemo(() => {
    if (doc.plot.boundary.length >= 3) return polygonCentroid(doc.plot.boundary);
    const walls = doc.levels[0]?.elements.filter(isWall) ?? [];
    if (walls.length > 0) return polygonCentroid(walls.flatMap((w) => [w.start, w.end]));
    return { x: 6, y: 6 };
  }, [doc]);

  // Walkthrough spawn: a few meters in front of the building, facing it.
  const walkSpawn = useMemo(() => {
    const walls = doc.levels[0]?.elements.filter(isWall) ?? [];
    if (walls.length === 0) return { start: { x: center.x, y: center.y + 7 }, target: center };
    const c = polygonCentroid(walls.flatMap((w) => [w.start, w.end]));
    const maxY = Math.max(...walls.flatMap((w) => [w.start.y, w.end.y]));
    return { start: { x: c.x, y: maxY + 4.5 }, target: c };
  }, [doc, center]);

  return (
    <div className="relative h-full w-full" style={{ background: skyColor }}>
      {navMode !== 'walk' && <PhotorealRender />}
      {navMode === 'walk' && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-lg border border-edge bg-surface-2/90 px-3 py-2 shadow-lg backdrop-blur">
            <span className="text-[11px] leading-snug text-ink-dim">
              <b className="text-ink">Walkthrough</b> — click the view to capture the mouse ·{' '}
              <b className="text-ink">WASD</b> move · <b className="text-ink">Shift</b> run ·{' '}
              <b className="text-ink">R/F</b> up &amp; down · <b className="text-ink">Esc</b> releases
            </span>
            <button
              onClick={() => setNavMode('orbit')}
              className="h-7 shrink-0 rounded-md border border-edge px-2.5 text-xs font-medium text-ink hover:bg-surface-3"
            >
              Exit
            </button>
          </div>
        </div>
      )}
      <Canvas
        shadows
        camera={{ position: [center.x + 14, 12, center.y + 14], fov: 50 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          exportRegistry.glCanvas = gl.domElement;
        }}
      >
        <RendererSettings mode={dayNight} />
        <SoftShadows size={18} samples={10} focus={0.6} />
        <color attach="background" args={[skyColor]} />
        <fog attach="fog" args={[night ? '#0a0f1c' : evening ? '#35425f' : '#cfe0ee', 60, 220]} />

        <Suspense fallback={null}>
          <Environment
            files={night ? HDRI_NIGHT : HDRI_DAY}
            environmentIntensity={night ? 0.5 : evening ? 0.28 : 0.65}
          />
        </Suspense>

        {night ? (
          <>
            <ambientLight intensity={0.12} color="#7285a8" />
            <directionalLight position={[-25, 35, -12]} intensity={0.3} color="#9db4d6" castShadow />
          </>
        ) : evening ? (
          <>
            {/* Dusk: low warm sun raking across the facades. */}
            <ambientLight intensity={0.22} color="#8d9bb8" />
            <directionalLight
              position={sunPosition(17.6, doc.plot.northAngle)}
              intensity={1.15}
              color="#ff9e63"
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-35}
              shadow-camera-right={35}
              shadow-camera-top={35}
              shadow-camera-bottom={-35}
              shadow-bias={-0.0002}
            />
          </>
        ) : (
          <>
            <ambientLight intensity={0.15} />
            <directionalLight
              position={sunPosition(sunHour, doc.plot.northAngle)}
              intensity={1.6 + Math.sin((Math.PI * (sunHour - 6)) / 12) * 0.9}
              color={Math.abs(sunHour - 12) > 4.5 ? '#ffd9b0' : '#ffffff'}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-35}
              shadow-camera-right={35}
              shadow-camera-top={35}
              shadow-camera-bottom={-35}
              shadow-bias={-0.0002}
            />
          </>
        )}

        <Ground night={night} plot={doc.plot.boundary} />
        {doc.levels.map((level) => (
          <Level3D
            key={level.id}
            level={level}
            lampsOn={lampsOn}
            hasLevelAbove={doc.levels.some((o) => o.elevation > level.elevation + 0.1)}
          />
        ))}

        {navMode === 'walk' ? (
          <WalkControls start={walkSpawn.start} target={walkSpawn.target} />
        ) : (
          <OrbitControls
            makeDefault
            target={[center.x, 1.2, center.y]}
            maxPolarAngle={Math.PI / 2 - 0.02}
            minDistance={2}
            maxDistance={120}
            enableDamping
            dampingFactor={0.08}
          />
        )}

        {/* screen-space ambient occlusion + anti-aliasing (Quality: High) */}
        {highQuality && (
          <EffectComposer multisampling={4}>
            <N8AO aoRadius={0.5} intensity={2.5} distanceFalloff={0.6} quality="medium" />
            <SMAA />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
