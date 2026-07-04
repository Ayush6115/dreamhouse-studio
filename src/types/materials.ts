/** Shared material description consumed by both the 2D and 3D renderers. */
export interface Material {
  /** Preset id from the material library, or 'custom'. */
  id: string;
  name: string;
  /** Hex color, e.g. '#c8b8a0'. Always present — used to tint/fallback. */
  color: string;
  /**
   * Optional PBR texture set key: /assets/textures/<key>/{color,normal,roughness}.jpg
   * (fetched by scripts/fetch-assets.mjs; all CC0).
   */
  texture?: string;
  /** Physical size of one texture tile in meters (default 1). */
  textureScale?: number;
  finish: 'matte' | 'satin' | 'glossy' | 'textured';
  /** PBR hints for the 3D renderer (0..1). */
  roughness?: number;
  metalness?: number;
}

export const makeMaterial = (partial: Partial<Material> & Pick<Material, 'id' | 'name' | 'color'>): Material => ({
  finish: 'matte',
  roughness: 0.9,
  metalness: 0,
  ...partial,
});
