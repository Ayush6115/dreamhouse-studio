import type { FurnitureElement, Point } from '../types';
import { identityTransform, newId } from '../types';
import { materialById } from './materials';

/**
 * Interior library catalog.
 *
 * PLACEHOLDER GEOMETRY NOTICE: every item is rendered from parametric
 * primitives — a schematic architectural symbol in 2D and a composed-primitive
 * stand-in in 3D (see plan/symbols2d.tsx and viewer3d/furniture3d.ts).
 * The placement/editing system is real; swapping in production 3D models
 * (GLB assets) is a content task — drop files in /assets/models and extend
 * the `model` mapping.
 */

export type Symbol2D =
  | 'bed'
  | 'sofa'
  | 'sofa-l'
  | 'armchair'
  | 'table-rect'
  | 'table-round'
  | 'chair'
  | 'wardrobe'
  | 'dresser'
  | 'tv-unit'
  | 'bookshelf'
  | 'counter'
  | 'island'
  | 'fridge'
  | 'stove'
  | 'sink'
  | 'toilet'
  | 'washbasin'
  | 'shower'
  | 'bathtub'
  | 'washing-machine'
  | 'plant'
  | 'rug'
  | 'lamp-floor'
  | 'lamp-ceiling'
  | 'ceiling-panel'
  | 'floor-patch'
  | 'railing'
  | 'slats'
  | 'strip-light'
  | 'planter'
  | 'box';

export type Model3D =
  | 'bed'
  | 'sofa'
  | 'sofa-l'
  | 'armchair'
  | 'table'
  | 'table-round'
  | 'chair'
  | 'wardrobe'
  | 'tv-unit'
  | 'bookshelf'
  | 'counter'
  | 'fridge'
  | 'stove'
  | 'sink'
  | 'toilet'
  | 'washbasin'
  | 'shower'
  | 'bathtub'
  | 'washing-machine'
  | 'plant'
  | 'rug'
  | 'lamp-floor'
  | 'lamp-ceiling'
  | 'ceiling-panel'
  | 'floor-patch'
  | 'tree'
  | 'tree-fir'
  | 'railing'
  | 'slats'
  | 'strip-light'
  | 'planter'
  | 'box';

export interface CatalogItem {
  id: string;
  name: string;
  category: string;
  /** Footprint + height in meters: width (x), depth (y), height (z). */
  width: number;
  depth: number;
  height: number;
  /** Vertical offset of the item's base above the floor. */
  zOffset?: number;
  materialId: string;
  symbol: Symbol2D;
  /** Parametric 3D fallback (always available). */
  model: Model3D;
  /**
   * Production model id under /assets/models/<glb>/<glb>.gltf (CC0, fetched
   * by scripts/fetch-assets.mjs). When present the 3D view renders it,
   * normalized to this item's dimensions; the parametric model remains the
   * loading/error fallback.
   */
  glb?: string;
  /** Yaw (radians) aligning the model's front with local +z. */
  glbRotation?: number;
}

const item = (
  id: string,
  name: string,
  category: string,
  w: number,
  d: number,
  h: number,
  materialId: string,
  symbol: Symbol2D,
  model: Model3D,
  zOffset = 0,
  glb?: string,
  glbRotation?: number,
): CatalogItem => ({ id, name, category, width: w, depth: d, height: h, materialId, symbol, model, zOffset, glb, glbRotation });

export const CATALOG: CatalogItem[] = [
  // Bedroom
  item('bed-king', 'King Bed', 'Bedroom', 1.8, 2.1, 1.2, 'fabric-linen', 'bed', 'bed', 0, 'GothicBed_01'),
  item('bed-queen', 'Queen Bed', 'Bedroom', 1.5, 2.05, 1.15, 'fabric-linen', 'bed', 'bed', 0, 'GothicBed_01'),
  item('bed-single', 'Single Bed', 'Bedroom', 0.95, 2.0, 1.0, 'fabric-linen', 'bed', 'bed', 0, 'GothicBed_01'),
  item('wardrobe-3', 'Wardrobe · 3 Door', 'Bedroom', 1.8, 0.6, 2.2, 'wood-walnut', 'wardrobe', 'wardrobe', 0, 'chinese_cabinet'),
  item('wardrobe-2', 'Wardrobe · 2 Door', 'Bedroom', 1.2, 0.6, 2.0, 'wood-walnut', 'wardrobe', 'wardrobe', 0, 'painted_wooden_cabinet'),
  item('dresser', 'Dresser', 'Bedroom', 1.0, 0.5, 0.9, 'wood-oak', 'dresser', 'box', 0, 'drawer_cabinet'),
  item('side-table', 'Bedside Table', 'Bedroom', 0.5, 0.45, 0.6, 'wood-oak', 'table-rect', 'table', 0, 'side_table_01'),
  item('nightstand', 'Nightstand', 'Bedroom', 0.5, 0.4, 0.75, 'wood-oak', 'dresser', 'box', 0, 'painted_wooden_nightstand'),

  // Living
  item('sofa-3', 'Sofa · 3 Seater', 'Living', 2.1, 0.95, 0.8, 'fabric-charcoal', 'sofa', 'sofa', 0, 'sofa_02'),
  item('sofa-2', 'Sofa · 2 Seater', 'Living', 1.6, 0.95, 0.8, 'fabric-charcoal', 'sofa', 'sofa', 0, 'sofa_02'),
  item('sofa-l', 'Sofa · L Sectional', 'Living', 2.6, 1.8, 0.85, 'fabric-linen', 'sofa-l', 'sofa-l'),
  item('armchair', 'Armchair', 'Living', 0.85, 0.85, 0.8, 'leather-tan', 'armchair', 'armchair', 0, 'modern_arm_chair_01'),
  item('lounge-chair', 'Lounge Chair', 'Living', 0.8, 0.85, 0.75, 'leather-tan', 'armchair', 'armchair', 0, 'mid_century_lounge_chair'),
  item('accent-chair', 'Accent Chair', 'Living', 0.7, 0.75, 0.8, 'fabric-linen', 'armchair', 'armchair', 0, 'GreenChair_01'),
  item('rocking-chair', 'Rocking Chair', 'Living', 0.6, 0.95, 1.0, 'wood-oak', 'armchair', 'armchair', 0, 'Rockingchair_01'),
  item('ottoman', 'Ottoman', 'Living', 0.65, 0.65, 0.42, 'fabric-linen', 'armchair', 'box', 0, 'Ottoman_01'),
  item('coffee-table', 'Coffee Table', 'Living', 1.1, 0.6, 0.42, 'wood-walnut', 'table-rect', 'table', 0, 'modern_coffee_table_01'),
  item('tv-unit', 'TV Unit', 'Living', 1.6, 0.45, 0.55, 'wood-walnut', 'tv-unit', 'tv-unit', 0, 'modern_wooden_cabinet'),
  item('bookshelf', 'Bookshelf', 'Living', 0.9, 0.35, 1.8, 'wood-oak', 'bookshelf', 'bookshelf', 0, 'painted_wooden_shelves'),

  // Dining
  item('dining-6', 'Dining Table · 6', 'Dining', 1.9, 1.0, 0.76, 'wood-teak', 'table-rect', 'table', 0, 'dining_table'),
  item('dining-4', 'Dining Table · 4', 'Dining', 1.4, 0.85, 0.76, 'wood-teak', 'table-rect', 'table', 0, 'gallinera_table'),
  item('dining-round', 'Dining Table · Round', 'Dining', 1.2, 1.2, 0.76, 'wood-teak', 'table-round', 'table-round', 0, 'round_wooden_table_01'),
  item('chair', 'Dining Chair', 'Dining', 0.48, 0.52, 0.9, 'wood-oak', 'chair', 'chair', 0, 'dining_chair_02'),
  item('bar-stool', 'Bar Stool', 'Dining', 0.42, 0.42, 0.75, 'wood-oak', 'chair', 'chair', 0, 'bar_chair_round_01'),
  item('stool', 'Wooden Stool', 'Dining', 0.4, 0.4, 0.45, 'wood-oak', 'chair', 'chair', 0, 'painted_wooden_stool'),

  // Study
  item('office-desk', 'Office Desk', 'Study', 1.35, 0.7, 0.76, 'steel', 'table-rect', 'table', 0, 'metal_office_desk'),

  // Kitchen (modular — parametric: counters are size-driven by design)
  item('counter-straight', 'Counter · Straight', 'Kitchen', 2.4, 0.6, 0.9, 'granite', 'counter', 'counter'),
  item('counter-short', 'Counter · Short', 'Kitchen', 1.2, 0.6, 0.9, 'granite', 'counter', 'counter'),
  item('island', 'Kitchen Island', 'Kitchen', 1.5, 0.9, 0.9, 'marble', 'island', 'counter'),
  item('sink-unit', 'Sink Unit', 'Kitchen', 0.8, 0.6, 0.9, 'steel', 'sink', 'sink'),
  item('stove', 'Cooking Stove', 'Kitchen', 0.75, 0.65, 0.95, 'steel', 'stove', 'stove', 0, 'electric_stove'),
  item('fridge', 'Refrigerator', 'Kitchen', 0.75, 0.7, 1.8, 'steel', 'fridge', 'fridge'),
  item('washing-machine', 'Washing Machine', 'Kitchen', 0.6, 0.6, 0.85, 'steel', 'washing-machine', 'washing-machine'),

  // Bathroom (parametric — no suitable CC0 production models found)
  item('toilet', 'Toilet (WC)', 'Bathroom', 0.4, 0.7, 0.75, 'tile-ivory', 'toilet', 'toilet'),
  item('washbasin', 'Washbasin', 'Bathroom', 0.55, 0.45, 0.85, 'tile-ivory', 'washbasin', 'washbasin'),
  item('shower', 'Shower Enclosure', 'Bathroom', 0.9, 0.9, 2.1, 'glass', 'shower', 'shower'),
  item('bathtub', 'Bathtub', 'Bathroom', 1.7, 0.8, 0.55, 'tile-ivory', 'bathtub', 'bathtub'),

  // Lighting
  item('lamp-floor', 'Floor Lamp', 'Lighting', 0.4, 0.4, 1.6, 'steel', 'lamp-floor', 'lamp-floor'),
  item('lamp-pendant', 'Pendant Light', 'Lighting', 0.4, 0.4, 0.55, 'steel', 'lamp-ceiling', 'lamp-ceiling', 2.2, 'modern_ceiling_lamp_01'),
  item('lamp-ceiling', 'Ceiling Light', 'Lighting', 0.5, 0.5, 0.3, 'glass', 'lamp-ceiling', 'lamp-ceiling', 2.6, 'modern_ceiling_lamp_01'),
  item('chandelier', 'Chandelier', 'Lighting', 0.8, 0.8, 0.9, 'steel', 'lamp-ceiling', 'lamp-ceiling', 2.0, 'Chandelier_03'),
  item('chandelier-classic', 'Chandelier · Classic', 'Lighting', 0.9, 0.9, 1.0, 'brass', 'lamp-ceiling', 'lamp-ceiling', 1.9, 'Chandelier_01'),

  // Ceiling & surfaces
  item('false-ceiling', 'False Ceiling Panel', 'Ceiling & Floor', 3, 3, 0.1, 'plaster-white', 'ceiling-panel', 'ceiling-panel', 2.6),
  item('floor-wood', 'Flooring · Wood Patch', 'Ceiling & Floor', 3, 3, 0.02, 'wood-floor', 'floor-patch', 'floor-patch'),
  item('rug', 'Rug', 'Ceiling & Floor', 2.0, 1.4, 0.02, 'fabric-linen', 'rug', 'rug'),

  // Decor
  item('plant-large', 'Plant · Large', 'Decor', 0.6, 0.6, 1.4, 'grass', 'plant', 'plant', 0, 'potted_plant_01'),
  item('plant-small', 'Plant · Small', 'Decor', 0.35, 0.35, 0.5, 'grass', 'plant', 'plant', 0, 'potted_plant_02'),
  item('retro-tv', 'Retro TV', 'Decor', 0.6, 0.45, 0.5, 'wood-walnut', 'tv-unit', 'tv-unit', 0, 'Television_01'),
  item('wall-mirror', 'Wall Mirror', 'Decor', 0.7, 0.12, 1.1, 'brass', 'box', 'box', 1.1, 'ornate_mirror_01'),
  item('vase-ceramic', 'Vase · Ceramic', 'Decor', 0.25, 0.25, 0.4, 'tile-ivory', 'plant', 'box', 0, 'ceramic_vase_01'),
  item('vase-brass', 'Vase · Brass', 'Decor', 0.2, 0.2, 0.35, 'brass', 'plant', 'box', 0, 'brass_vase_01'),

  // Outdoor (parametric — CC0 photoscanned trees are 39–456 MB, too heavy for web)
  item('tree-leafy', 'Tree · Leafy', 'Outdoor', 3.2, 3.2, 4.5, 'grass', 'plant', 'tree'),
  item('tree-fir', 'Tree · Fir', 'Outdoor', 2.4, 2.4, 5.5, 'grass', 'plant', 'tree-fir'),

  // Facade kit — modern-villa vocabulary: glass balustrades, slat screens,
  // cove lighting and planters for terraces and balconies.
  item('railing-glass', 'Glass Railing', 'Facade Kit', 2.0, 0.08, 1.05, 'glass', 'railing', 'railing'),
  item('railing-glass-long', 'Glass Railing · Long', 'Facade Kit', 3.6, 0.08, 1.05, 'glass', 'railing', 'railing'),
  item('slat-screen', 'Wood Slat Screen', 'Facade Kit', 2.4, 0.12, 2.7, 'wood-teak', 'slats', 'slats'),
  item('slat-screen-wide', 'Wood Slat Screen · Wide', 'Facade Kit', 3.6, 0.12, 2.7, 'wood-teak', 'slats', 'slats'),
  item('strip-light', 'Cove Strip Light', 'Facade Kit', 2.4, 0.08, 0.06, 'plaster-white', 'strip-light', 'strip-light', 2.85),
  item('strip-light-short', 'Cove Strip Light · Short', 'Facade Kit', 1.2, 0.08, 0.06, 'plaster-white', 'strip-light', 'strip-light', 2.85),
  item('planter-long', 'Planter · Long', 'Facade Kit', 1.8, 0.45, 0.45, 'concrete', 'planter', 'planter'),
  item('planter-cube', 'Planter · Cube', 'Facade Kit', 0.5, 0.5, 0.5, 'concrete', 'planter', 'planter'),
];

export const CATALOG_CATEGORIES = [...new Set(CATALOG.map((i) => i.category))];

export const catalogItemById = (id: string): CatalogItem | undefined => CATALOG.find((i) => i.id === id);

export function makeFurniture(catalogId: string, at: Point): FurnitureElement {
  const def = catalogItemById(catalogId);
  if (!def) throw new Error(`Unknown catalog item: ${catalogId}`);
  return {
    id: newId(),
    type: 'furniture',
    name: def.name,
    catalogId,
    transform: { ...identityTransform(), position: { x: at.x, y: at.y, z: def.zOffset ?? 0 } },
    dimensions: { width: def.width, height: def.height, depth: def.depth },
    material: { ...materialById(def.materialId) },
    meta: {},
  };
}
