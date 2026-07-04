/**
 * Resolve a public asset path against the build's base URL, so the app works
 * both at the domain root (dev, `/`) and under a sub-path deployment such as
 * GitHub Pages (`/dreamhouse-studio/`).
 */
export const assetUrl = (path: string): string =>
  import.meta.env.BASE_URL + path.replace(/^\//, '');
