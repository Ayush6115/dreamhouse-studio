import type { FacadeElementItem, Point } from '../types';
import { identityTransform, newId } from '../types';
import { materialById } from './materials';

/**
 * Façade component library for the elevation designer. Like the interior
 * catalog, geometry is schematic/parametric placeholder art; the composer,
 * editing and export pipeline are the real deliverable.
 */

export type FacadeSymbol =
  | 'window-4pane'
  | 'window-tall'
  | 'window-arch'
  | 'window-round'
  | 'door-panel'
  | 'door-double'
  | 'railing'
  | 'cladding'
  | 'tiles'
  | 'panel'
  | 'pergola'
  | 'sconce'
  | 'column'
  | 'gate'
  | 'parapet'
  | 'awning'
  | 'solar'
  | 'tree'
  | 'shrub'
  | 'shutters'
  | 'louver'
  | 'arch-door'
  | 'balcony'
  | 'cornice'
  | 'steps'
  | 'canopy'
  | 'planter'
  | 'downpipe'
  | 'spot'
  | 'nameboard'
  | 'grille';

export interface FacadeCatalogItem {
  id: string;
  name: string;
  category: string;
  width: number;
  height: number;
  /** Default height of the element's BOTTOM edge above ground, meters. */
  baseZ: number;
  materialId: string;
  symbol: FacadeSymbol;
}

const f = (
  id: string,
  name: string,
  category: string,
  w: number,
  h: number,
  baseZ: number,
  materialId: string,
  symbol: FacadeSymbol,
): FacadeCatalogItem => ({ id, name, category, width: w, height: h, baseZ, materialId, symbol });

export const FACADE_CATALOG: FacadeCatalogItem[] = [
  // Windows
  f('fw-4pane', 'Window · 4 Pane', 'Windows', 1.2, 1.2, 0.9, 'glass', 'window-4pane'),
  f('fw-tall', 'Window · Tall', 'Windows', 0.9, 2.0, 0.45, 'glass', 'window-tall'),
  f('fw-arch', 'Window · Arched', 'Windows', 1.0, 1.5, 0.9, 'glass', 'window-arch'),
  f('fw-round', 'Window · Round', 'Windows', 0.8, 0.8, 1.4, 'glass', 'window-round'),
  f('fw-shutters', 'Window · Shutters', 'Windows', 1.9, 1.2, 0.9, 'wood-teak', 'shutters'),
  f('fw-louver', 'Louver Vent', 'Windows', 0.6, 0.4, 2.3, 'wood-teak', 'louver'),

  // Doors
  f('fd-main', 'Main Door', 'Doors', 1.0, 2.1, 0, 'wood-teak', 'door-panel'),
  f('fd-double', 'Double Door', 'Doors', 1.6, 2.1, 0, 'wood-walnut', 'door-double'),
  f('fd-arch', 'Arched Door', 'Doors', 1.1, 2.3, 0, 'wood-walnut', 'arch-door'),

  // Balcony & boundary
  f('fr-railing', 'Railing', 'Railing & Gates', 2.4, 1.0, 3.0, 'steel', 'railing'),
  f('fb-balcony', 'Balcony', 'Railing & Gates', 2.4, 1.35, 2.85, 'concrete', 'balcony'),
  f('fg-gate', 'Gate', 'Railing & Gates', 3.0, 1.5, 0, 'steel', 'gate'),

  // Wall treatments
  f('fc-cladding', 'Stone Cladding', 'Cladding & Panels', 2.0, 3.0, 0, 'stone-grey', 'cladding'),
  f('fc-tiles', 'Elevation Tiles', 'Cladding & Panels', 1.5, 2.5, 0.5, 'brick', 'tiles'),
  f('fc-panel', 'Accent Panel', 'Cladding & Panels', 1.2, 2.8, 0.2, 'wood-walnut', 'panel'),
  f('fc-cornice', 'Cornice Band', 'Cladding & Panels', 3.0, 0.25, 3.0, 'plaster-white', 'cornice'),
  f('fn-nameboard', 'Name Board', 'Cladding & Panels', 1.0, 0.3, 1.5, 'wood-walnut', 'nameboard'),
  f('fg-grille', 'Vent Grille', 'Cladding & Panels', 0.5, 0.5, 2.4, 'steel', 'grille'),

  // Structure & shading
  f('fs-column', 'Column', 'Structure & Shade', 0.35, 3.0, 0, 'concrete', 'column'),
  f('fs-pergola', 'Pergola', 'Structure & Shade', 2.5, 0.4, 2.7, 'wood-teak', 'pergola'),
  f('fs-awning', 'Chajja / Awning', 'Structure & Shade', 1.6, 0.15, 2.2, 'concrete', 'awning'),
  f('fs-canopy', 'Entry Canopy', 'Structure & Shade', 1.8, 0.35, 2.3, 'steel-black', 'canopy'),
  f('fs-parapet', 'Parapet Cap', 'Structure & Shade', 3.0, 0.45, 6.2, 'concrete', 'parapet'),
  f('fp-steps', 'Porch Steps', 'Structure & Shade', 1.8, 0.45, 0, 'concrete', 'steps'),

  // Roof extras
  f('fx-solar', 'Solar Panel', 'Roof & Energy', 1.7, 1.0, 6.4, 'steel', 'solar'),
  f('fx-downpipe', 'Downpipe', 'Roof & Energy', 0.12, 5.5, 0, 'steel', 'downpipe'),

  // Lighting & landscape
  f('fl-sconce', 'Wall Sconce', 'Lighting & Landscape', 0.18, 0.35, 2.2, 'steel', 'sconce'),
  f('fl-spot', 'Up/Down Spot', 'Lighting & Landscape', 0.14, 0.28, 2.4, 'steel-black', 'spot'),
  f('fl-planter', 'Planter Box', 'Lighting & Landscape', 1.0, 0.45, 0, 'concrete', 'planter'),
  f('fl-tree', 'Tree', 'Lighting & Landscape', 1.8, 3.5, 0, 'grass', 'tree'),
  f('fl-shrub', 'Shrub', 'Lighting & Landscape', 0.9, 0.7, 0, 'grass', 'shrub'),
];

export const FACADE_CATEGORIES = [...new Set(FACADE_CATALOG.map((i) => i.category))];

export const facadeItemById = (id: string): FacadeCatalogItem | undefined =>
  FACADE_CATALOG.find((i) => i.id === id);

/** `at.x` = horizontal position on the façade; `at.y` = height of the element CENTER. */
export function makeFacadeElement(catalogId: string, at: Point): FacadeElementItem {
  const def = facadeItemById(catalogId);
  if (!def) throw new Error(`Unknown façade item: ${catalogId}`);
  return {
    id: newId(),
    type: 'facade-element',
    name: def.name,
    catalogId,
    transform: { ...identityTransform(), position: { x: at.x, y: 0, z: at.y } },
    dimensions: { width: def.width, height: def.height, depth: 0.1 },
    material: { ...materialById(def.materialId) },
  };
}
