import { jsPDF } from 'jspdf';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import type { DesignDocument } from '../../types';
import { computeMetrics } from '../../store/calculations';
import { formatArea, formatLength } from '../../geometry/units';
import { elevationSVG, planSVG } from './svg';
import { rasterizeSVG } from './raster';
import { exportRegistry } from './registry';

/** File download helpers + PNG rasterization + the compiled PDF report. */

export type ExportQuality = 'draft' | 'standard' | 'high' | 'ultra';

/** Raster scale over the sheet's natural size (~55 px/m at 1×). */
export const QUALITY_SCALE: Record<ExportQuality, number> = {
  draft: 1,
  standard: 2,
  high: 3,
  ultra: 5,
};

const safe = (name: string) => name.replace(/[^\w-]+/g, '_') || 'design';

export function downloadDataURL(dataUrl: string, filename: string): void {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export function downloadText(text: string, filename: string, mime = 'image/svg+xml'): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, filename);
  URL.revokeObjectURL(url);
}

/** Rasterize an SVG string to a PNG data-URL at ~`scale`× its natural size. */
export function svgToPng(svg: string, scale = 2): Promise<string> {
  return rasterizeSVG(svg, { scale });
}

// ------------------------------------------------------------ single files

export function exportPlanSVG(doc: DesignDocument, levelId: string): void {
  downloadText(planSVG(doc, levelId), `${safe(doc.name)}_plan.svg`);
}

export async function exportPlanPNG(
  doc: DesignDocument,
  levelId: string,
  quality: ExportQuality = 'high',
): Promise<void> {
  downloadDataURL(
    await svgToPng(planSVG(doc, levelId), QUALITY_SCALE[quality]),
    `${safe(doc.name)}_plan.png`,
  );
}

export function exportElevationSVG(doc: DesignDocument, facadeId: string): void {
  downloadText(elevationSVG(doc, facadeId), `${safe(doc.name)}_elevation.svg`);
}

export async function exportElevationPNG(
  doc: DesignDocument,
  facadeId: string,
  quality: ExportQuality = 'high',
): Promise<void> {
  downloadDataURL(
    await svgToPng(elevationSVG(doc, facadeId), QUALITY_SCALE[quality]),
    `${safe(doc.name)}_elevation.png`,
  );
}

/** 3D snapshot from the live WebGL canvas (or the cached one from the last visit). */
export function capture3D(): string | null {
  const canvas = exportRegistry.glCanvas;
  if (canvas && canvas.isConnected) {
    try {
      const url = canvas.toDataURL('image/png');
      exportRegistry.last3DSnapshot = url;
      return url;
    } catch {
      /* fall through to cache */
    }
  }
  return exportRegistry.last3DSnapshot;
}

export function export3DPNG(doc: DesignDocument): boolean {
  const url = capture3D();
  if (!url) return false;
  downloadDataURL(url, `${safe(doc.name)}_3d.png`);
  return true;
}

/**
 * Export the live 3D scene as a binary glTF (.glb) — usable in Blender,
 * Windows 3D Viewer, web viewers, etc. Requires the 3D view to be open.
 */
export async function exportGLB(doc: DesignDocument): Promise<boolean> {
  const scene = exportRegistry.scene3d;
  if (!scene) return false;
  const exporter = new GLTFExporter();
  // Safety valve: a stuck encode must fail the export, never hang the app.
  const result = await Promise.race([
    exporter.parseAsync(scene, { binary: true, onlyVisible: true }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('GLB export timed out')), 45000)),
  ]);
  const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
  const url = URL.createObjectURL(blob);
  downloadDataURL(url, `${safe(doc.name)}.glb`);
  URL.revokeObjectURL(url);
  return true;
}

// ---------------------------------------------------------------- PDF report

async function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = dataUrl;
  });
}

/** Place an image centered inside a box (mm), preserving aspect ratio. */
async function placeImage(
  pdf: jsPDF,
  dataUrl: string,
  x: number,
  y: number,
  boxW: number,
  boxH: number,
): Promise<void> {
  const { w, h } = await imageSize(dataUrl);
  const s = Math.min(boxW / w, boxH / h);
  const dw = w * s;
  const dh = h * s;
  pdf.addImage(dataUrl, 'PNG', x + (boxW - dw) / 2, y + (boxH - dh) / 2, dw, dh);
}

function pageHeader(pdf: jsPDF, title: string, docName: string): void {
  pdf.setFontSize(14);
  pdf.setTextColor(40, 38, 32);
  pdf.text(title, 14, 16);
  pdf.setFontSize(9);
  pdf.setTextColor(130, 125, 112);
  pdf.text(docName, 283, 16, { align: 'right' });
  pdf.setDrawColor(180, 174, 158);
  pdf.line(14, 19, 283, 19);
}

export async function exportPDFReport(
  doc: DesignDocument,
  activeLevelId: string,
  activeFacadeId: string,
  quality: ExportQuality = 'high',
): Promise<void> {
  const sheetScale = QUALITY_SCALE[quality];
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }); // 297 × 210
  const unit = doc.unitSystem;
  const metrics = computeMetrics(doc, activeLevelId);

  // Cover
  pdf.setFillColor(20, 26, 34);
  pdf.rect(0, 0, 297, 210, 'F');
  pdf.setTextColor(230, 235, 242);
  pdf.setFontSize(30);
  pdf.text(doc.name, 24, 70);
  pdf.setFontSize(13);
  pdf.setTextColor(154, 166, 183);
  pdf.text('Design report — DreamHouse Studio', 24, 82);
  pdf.setFontSize(10);
  pdf.text(new Date().toLocaleDateString(), 24, 90);

  const rows: [string, string][] = [
    ['Plot area', formatArea(metrics.plotArea, unit)],
    ['Buildable area', metrics.buildableArea === null ? '—' : formatArea(metrics.buildableArea, unit)],
    ['Built-up area', formatArea(metrics.builtUpArea, unit)],
    ['Carpet area', formatArea(metrics.carpetArea, unit)],
    ['Total wall length', formatLength(metrics.totalWallLength, unit)],
    ['Walls / Rooms', `${metrics.wallCount} / ${metrics.roomCount}`],
    ['Floors', String(doc.levels.length)],
  ];
  let y = 112;
  pdf.setFontSize(11);
  for (const [label, value] of rows) {
    pdf.setTextColor(154, 166, 183);
    pdf.text(label, 24, y);
    pdf.setTextColor(230, 235, 242);
    pdf.text(value, 110, y);
    y += 9;
  }

  // Plan pages (every level).
  for (const level of doc.levels) {
    pdf.addPage('a4', 'landscape');
    pageHeader(pdf, `Floor Plan — ${level.name}`, doc.name);
    const png = await svgToPng(planSVG(doc, level.id), sheetScale);
    await placeImage(pdf, png, 14, 24, 269, 176);
  }

  // Elevation pages (every façade with content, else the active one).
  const facades = doc.facades.filter((f) => f.elements.length > 0);
  const list = facades.length > 0 ? facades : doc.facades.filter((f) => f.id === activeFacadeId);
  for (const facade of list) {
    pdf.addPage('a4', 'landscape');
    pageHeader(pdf, `Elevation — ${facade.name}`, doc.name);
    const png = await svgToPng(elevationSVG(doc, facade.id), sheetScale);
    await placeImage(pdf, png, 14, 24, 269, 176);
  }

  // 3D render page.
  const snapshot = capture3D();
  pdf.addPage('a4', 'landscape');
  pageHeader(pdf, '3D Render', doc.name);
  if (snapshot) {
    await placeImage(pdf, snapshot, 14, 24, 269, 176);
  } else {
    pdf.setFontSize(11);
    pdf.setTextColor(130, 125, 112);
    pdf.text('No 3D snapshot available — open the 3D view once, then re-export.', 24, 40);
  }

  pdf.save(`${safe(doc.name)}_report.pdf`);
}
