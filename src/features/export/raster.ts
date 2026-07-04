/** SVG → PNG/JPEG rasterization (shared by exports and project thumbnails). */

export interface RasterOptions {
  /** Multiplier over the SVG's natural size (ignored when targetWidth set). */
  scale?: number;
  /** Absolute output width in px; height follows the aspect ratio. */
  targetWidth?: number;
  mime?: 'image/png' | 'image/jpeg';
  quality?: number;
  background?: string;
}

export function rasterizeSVG(svg: string, opts: RasterOptions = {}): Promise<string> {
  const { scale = 2, targetWidth, mime = 'image/png', quality = 0.92, background = '#f4f2ec' } = opts;
  return new Promise((resolve, reject) => {
    const widthMatch = svg.match(/width="(\d+)"/);
    const heightMatch = svg.match(/height="(\d+)"/);
    const w = widthMatch ? parseInt(widthMatch[1], 10) : 1200;
    const h = heightMatch ? parseInt(heightMatch[1], 10) : 800;
    const s = targetWidth ? targetWidth / w : scale;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * s));
      canvas.height = Math.max(1, Math.round(h * s));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no 2d context'));
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL(mime, quality));
    };
    img.onerror = () => reject(new Error('SVG rasterization failed'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}
