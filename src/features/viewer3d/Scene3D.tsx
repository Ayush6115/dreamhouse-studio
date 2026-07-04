import { Suspense, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { Environment, OrbitControls, SoftShadows, useTexture } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA } from '@react-three/postprocessing';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { useUiStore } from '../../store/uiStore';
import type { Level, Material, OpeningElement, Point, RoofElement, RoomElement, WallElement } from '../../types';
import { isOpening, isRoom, isWall } from '../../types';
import { useDesignStore } from '../../store/designStore';
import { ensureClockwise, polygonCentroid } from '../../geometry/polygon';
import { add, norm, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness } from '../../geometry/walls';
import { catalogItemById } from '../../library/catalog';
import { materialById } from '../../library/materials';
import { trimPiecesToRoofs, wallPieces } from './geometry3d';
import { FurnitureModel } from './furniture3d';
import { GltfModel } from './GltfModel';
import { RoofMesh } from './RoofMesh';
import { ElementMaterial, MaterialErrorBoundary } from './materials3d';
import { exportRegistry } from '../export/registry';

/**
 * The 3D view is DERIVED from the design document on every change. V2 adds
 * production quality: PBR textures, CC0 GLB furniture (parametric fallback),
 * HDRI environment lighting, soft shadows and ACES tone mapping.
 * Orbit + zoom camera only (per scope).
 */

const HDRI_DAY = '/assets/hdri/kloofendal_48d_partly_cloudy_puresky_1k.hdr';
const HDRI_NIGHT = '/assets/hdri/moonless_golf_1k.hdr';

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

function Opening3D({
  opening,
  host,
  baseY,
}: {
  opening: OpeningElement;
  host: WallElement;
  baseY: number;
}) {
  const setSelection = useDesignStore((s) => s.setSelection);
  const selected = useDesignStore((s) => s.selectedIds.includes(opening.id));
  const dir = norm(sub(host.end, host.start));
  const center = add(host.start, vscale(dir, opening.offset));
  const angle = Math.atan2(dir.y, dir.x);
  const w = opening.dimensions.width;
  const h = opening.dimensions.height;
  const th = wallThickness(host);

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
        opening.style === 'double' ? (
          <>
            {([-1, 1] as const).map((side) => (
              <mesh key={side} position={[side * (w * 0.235 + 0.005), h / 2, 0]} castShadow>
                <boxGeometry args={[w * 0.46, h * 0.99, 0.05]} />
                <ElementMaterial material={opening.material} selected={selected} />
              </mesh>
            ))}
          </>
        ) : opening.style === 'sliding' ? (
          <>
            <mesh position={[-w * 0.24, h / 2, 0.03]} castShadow>
              <boxGeometry args={[w * 0.52, h * 0.99, 0.04]} />
              <ElementMaterial material={opening.material} selected={selected} />
            </mesh>
            <mesh position={[w * 0.24, h / 2, -0.03]} castShadow>
              <boxGeometry args={[w * 0.52, h * 0.99, 0.04]} />
              <ElementMaterial material={opening.material} selected={selected} />
            </mesh>
          </>
        ) : (
          <mesh position={[0, h / 2, 0]} castShadow>
            <boxGeometry args={[w * 0.94, h * 0.99, 0.05]} />
            <ElementMaterial material={opening.material} selected={selected} />
          </mesh>
        )
      ) : (
        <>
          {/* glass */}
          <mesh position={[0, opening.sillHeight + h / 2, 0]}>
            <boxGeometry args={[w * 0.96, h * 0.96, 0.02]} />
            <meshStandardMaterial
              color={opening.material.color}
              roughness={0.08}
              metalness={0.1}
              transparent
              opacity={0.3}
              emissive={selected ? '#2f6fee' : '#000'}
              emissiveIntensity={selected ? 0.3 : 0}
            />
          </mesh>
          {/* frame */}
          {(
            [
              [0, opening.sillHeight + 0.02, w, 0.04],
              [0, opening.sillHeight + h - 0.02, w, 0.04],
              [-w / 2 + 0.02, opening.sillHeight + h / 2, 0.04, h],
              [w / 2 - 0.02, opening.sillHeight + h / 2, 0.04, h],
            ] as const
          ).map(([x, y, bw, bh], i) => (
            <mesh key={i} position={[x, y, 0]} castShadow>
              <boxGeometry args={[bw, bh, Math.min(th * 0.6, 0.08)]} />
              <meshStandardMaterial color="#5c5650" roughness={0.5} />
            </mesh>
          ))}
          {/* mullions */}
          {Array.from(
            { length: opening.mullions ?? (opening.style === 'sliding' || opening.style === 'casement' ? 1 : 0) },
            (_, i) => {
              const count = (opening.mullions ?? 1) + 1;
              const x = -w / 2 + ((i + 1) * w) / count;
              return (
                <mesh key={`m${i}`} position={[x, opening.sillHeight + h / 2, 0]}>
                  <boxGeometry args={[0.035, h - 0.04, Math.min(th * 0.5, 0.06)]} />
                  <meshStandardMaterial color="#5c5650" roughness={0.5} />
                </mesh>
              );
            },
          )}
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

const LAMP_MODELS = new Set(['lamp-floor', 'lamp-ceiling']);

function Items3D({ level, night }: { level: Level; night: boolean }) {
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
                      url={`/assets/models/${def.glb}/${def.glb}.gltf`}
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
              {night && isLamp && (
                <pointLight
                  position={[0, def?.model === 'lamp-floor' ? h - 0.15 : h * 0.4, 0]}
                  intensity={7}
                  distance={8}
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

function Level3D({ level, night }: { level: Level; night: boolean }) {
  const walls = useMemo(() => level.elements.filter(isWall), [level.elements]);
  const openings = useMemo(() => level.elements.filter(isOpening), [level.elements]);
  const rooms = useMemo(() => level.elements.filter(isRoom), [level.elements]);
  const roofs = useMemo(
    () => level.elements.filter((e): e is RoofElement => e.type === 'roof'),
    [level.elements],
  );
  const baseY = level.elevation;

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
      {openings.map((o) => {
        const host = walls.find((w) => w.id === o.wallId);
        return host && o.visible !== false ? (
          <Opening3D key={o.id} opening={o} host={host} baseY={baseY} />
        ) : null;
      })}
      <Items3D level={level} night={night} />
    </group>
  );
}

const GROUND_RADIUS = 220;

function GrassMaterial({ night }: { night: boolean }) {
  const raw = useTexture({
    map: '/assets/textures/grass/color.jpg',
    normalMap: '/assets/textures/grass/normal.jpg',
    roughnessMap: '/assets/textures/grass/roughness.jpg',
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

/** ACES tone mapping + exposure that follows day/night. */
function RendererSettings({ night }: { night: boolean }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = night ? 0.7 : 1.05;
  }, [gl, night]);
  useEffect(() => {
    exportRegistry.scene3d = scene;
    return () => {
      if (exportRegistry.scene3d === scene) exportRegistry.scene3d = null;
    };
  }, [scene]);
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

export function Scene3D() {
  const doc = useDesignStore((s) => s.doc);
  const night = useDesignStore((s) => s.dayNight === 'night');
  const sunHour = useDesignStore((s) => s.sunHour);
  const highQuality = useUiStore((s) => s.renderQuality === 'high');

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

  return (
    <div className="h-full w-full" style={{ background: night ? '#0a0f1c' : '#bfd9ec' }}>
      <Canvas
        shadows
        camera={{ position: [center.x + 14, 12, center.y + 14], fov: 50 }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={({ gl }) => {
          exportRegistry.glCanvas = gl.domElement;
        }}
      >
        <RendererSettings night={night} />
        <SoftShadows size={18} samples={10} focus={0.6} />
        <color attach="background" args={[night ? '#0a0f1c' : '#bfd9ec']} />
        <fog attach="fog" args={[night ? '#0a0f1c' : '#cfe0ee', 60, 220]} />

        <Suspense fallback={null}>
          <Environment files={night ? HDRI_NIGHT : HDRI_DAY} environmentIntensity={night ? 0.5 : 0.65} />
        </Suspense>

        {night ? (
          <>
            <ambientLight intensity={0.12} color="#7285a8" />
            <directionalLight position={[-25, 35, -12]} intensity={0.3} color="#9db4d6" castShadow />
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
          <Level3D key={level.id} level={level} night={night} />
        ))}

        <OrbitControls
          makeDefault
          target={[center.x, 1.2, center.y]}
          maxPolarAngle={Math.PI / 2 - 0.02}
          minDistance={2}
          maxDistance={120}
          enableDamping
          dampingFactor={0.08}
        />

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
