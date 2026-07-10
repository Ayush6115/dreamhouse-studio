import type { Material } from '../types';
import { makeMaterial } from '../types';

/**
 * Material presets shared by walls, floors, furniture and façade elements.
 * `texture` keys reference CC0 PBR sets under /assets/textures/<key>/
 * (color/normal/roughness, fetched by scripts/fetch-assets.mjs); the 3D
 * renderer tints them with `color`. 2D always uses the flat color.
 */
export const MATERIALS: Material[] = [
  // Walls & paint
  makeMaterial({ id: 'plaster-white', name: 'Plaster · White', color: '#ece8df', texture: 'plaster', textureScale: 2.5, roughness: 0.95 }),
  makeMaterial({ id: 'plaster-warm', name: 'Plaster · Warm', color: '#e3d7c3', texture: 'plaster', textureScale: 2.5, roughness: 0.95 }),
  makeMaterial({ id: 'paint-sage', name: 'Paint · Sage', color: '#a8b59a', roughness: 0.9 }),
  makeMaterial({ id: 'paint-terracotta', name: 'Paint · Terracotta', color: '#c47b58', roughness: 0.9 }),
  makeMaterial({ id: 'paint-slate', name: 'Paint · Slate Blue', color: '#7d93a8', roughness: 0.9 }),
  makeMaterial({ id: 'paint-ivory', name: 'Paint · Ivory', color: '#f0ead9', roughness: 0.9 }),
  makeMaterial({ id: 'paint-charcoal', name: 'Paint · Charcoal', color: '#3f434a', roughness: 0.9 }),
  makeMaterial({ id: 'paint-blush', name: 'Paint · Blush', color: '#d9b3a5', roughness: 0.9 }),
  makeMaterial({ id: 'paint-olive', name: 'Paint · Olive', color: '#8a8a5c', roughness: 0.9 }),
  makeMaterial({ id: 'paint-sky', name: 'Paint · Sky', color: '#b9d2e0', roughness: 0.9 }),
  makeMaterial({ id: 'paint-mustard', name: 'Paint · Mustard', color: '#cfa348', roughness: 0.9 }),
  makeMaterial({ id: 'brick', name: 'Brick · Exposed', color: '#ffffff', texture: 'brick', textureScale: 2, finish: 'textured', roughness: 1 }),
  makeMaterial({ id: 'concrete', name: 'Concrete', color: '#ffffff', texture: 'concrete', textureScale: 2, roughness: 1 }),
  makeMaterial({ id: 'stone-grey', name: 'Stone · Grey', color: '#ffffff', texture: 'stone-wall', textureScale: 1.6, finish: 'textured', roughness: 1 }),

  // Wood
  makeMaterial({ id: 'wood-oak', name: 'Wood · Oak', color: '#c89a6a', texture: 'wood-planks', textureScale: 1.4, finish: 'satin', roughness: 0.7 }),
  makeMaterial({ id: 'wood-walnut', name: 'Wood · Walnut', color: '#7a563d', texture: 'wood-planks', textureScale: 1.4, finish: 'satin', roughness: 0.7 }),
  makeMaterial({ id: 'wood-teak', name: 'Wood · Teak', color: '#a8754a', texture: 'wood-planks', textureScale: 1.4, finish: 'satin', roughness: 0.65 }),
  makeMaterial({ id: 'wood-floor', name: 'Flooring · Oak Boards', color: '#ffffff', texture: 'wood-floor', textureScale: 1.8, finish: 'satin', roughness: 0.6 }),
  makeMaterial({ id: 'wood-floor-dark', name: 'Flooring · Dark Walnut', color: '#ffffff', texture: 'wood-floor-dark', textureScale: 1.8, finish: 'satin', roughness: 0.6 }),

  // Stone & tile floors
  makeMaterial({ id: 'tile-ivory', name: 'Tile · Ivory', color: '#ffffff', texture: 'tiles-ivory', textureScale: 1.2, finish: 'glossy', roughness: 0.3 }),
  makeMaterial({ id: 'tile-bath', name: 'Tile · Bathroom', color: '#ffffff', texture: 'tiles-bath', textureScale: 0.9, finish: 'glossy', roughness: 0.25 }),
  makeMaterial({ id: 'marble', name: 'Marble · Calacatta', color: '#ffffff', texture: 'marble', textureScale: 1.6, finish: 'glossy', roughness: 0.25 }),
  makeMaterial({ id: 'travertine', name: 'Travertine', color: '#ffffff', texture: 'travertine', textureScale: 1.6, finish: 'satin', roughness: 0.5 }),
  makeMaterial({ id: 'granite', name: 'Granite · Dark', color: '#ffffff', texture: 'granite', textureScale: 1.4, finish: 'glossy', roughness: 0.35 }),
  makeMaterial({ id: 'paving', name: 'Paving Stones', color: '#ffffff', texture: 'paving', textureScale: 1.6, roughness: 1 }),

  // Roofing
  makeMaterial({ id: 'roof-tiles', name: 'Roof · Clay Tiles', color: '#ffffff', texture: 'roof-tiles', textureScale: 1.5, finish: 'textured', roughness: 1 }),
  makeMaterial({ id: 'roof-tiles-dark', name: 'Roof · Slate Tiles', color: '#ffffff', texture: 'roof-tiles-dark', textureScale: 1.5, finish: 'textured', roughness: 1 }),
  makeMaterial({ id: 'roof-metal', name: 'Roof · Metal Sheet', color: '#7d8489', finish: 'satin', roughness: 0.45, metalness: 0.7 }),
  makeMaterial({ id: 'fascia-dark', name: 'Fascia · Matte Dark', color: '#26282c', roughness: 0.85 }),

  // Glass & metal
  makeMaterial({ id: 'glass', name: 'Glass', color: '#aac9dd', finish: 'glossy', roughness: 0.08, metalness: 0.1 }),
  makeMaterial({ id: 'steel', name: 'Steel', color: '#9aa1a8', finish: 'satin', roughness: 0.4, metalness: 0.8 }),
  makeMaterial({ id: 'steel-black', name: 'Steel · Black', color: '#2e3033', finish: 'satin', roughness: 0.45, metalness: 0.75 }),
  makeMaterial({ id: 'brass', name: 'Brass', color: '#b8905c', finish: 'glossy', roughness: 0.3, metalness: 0.9 }),

  // Fabric & leather
  makeMaterial({ id: 'fabric-linen', name: 'Fabric · Linen', color: '#cfc4ae', roughness: 1 }),
  makeMaterial({ id: 'fabric-charcoal', name: 'Fabric · Charcoal', color: '#4a4d52', roughness: 1 }),
  makeMaterial({ id: 'leather-tan', name: 'Leather · Tan', color: '#a5714b', finish: 'satin', roughness: 0.55 }),

  // Outdoor
  makeMaterial({ id: 'grass', name: 'Grass', color: '#ffffff', texture: 'grass', textureScale: 2, roughness: 1 }),
];

export const materialById = (id: string): Material =>
  MATERIALS.find((m) => m.id === id) ?? MATERIALS[0];

export const DEFAULT_WALL_MATERIAL = materialById('plaster-white');
export const DEFAULT_FLOOR_MATERIAL = materialById('tile-ivory');
