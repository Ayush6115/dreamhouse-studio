import type { DesignDocument, Facade, Level, OpeningElement, Point } from '../../types';
import { isFurniture, isOpening, isRoom, isWall } from '../../types';
import { ensureClockwise, polygonBounds, polygonCentroid } from '../../geometry/polygon';
import { roofGeometry } from '../../geometry/roof';
import { buildableRegion } from '../../geometry/setbacks';
import { add, dist, norm, perp, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness, wallsUnionOutlines } from '../../geometry/walls';
import { formatArea, formatLength } from '../../geometry/units';
import { polygonArea } from '../../geometry/polygon';
import { ROOM_FILLS } from '../../library/roomColors';
import { facadeItemById } from '../../library/facadeCatalog';
import { elevationWorkingSVG, planWorkingSVG } from './workingDrawing';

/** Export drawing style: colored presentation sheet or B/W working drawing. */
export type DrawingStyle = 'presentation' | 'working';

/**
 * TRUE-VECTOR exports generated straight from the design document (not a
 * canvas screenshot) — so they work from any view and scale losslessly.
 * Units inside the SVG are meters (viewBox), strokes are hairline-scaled.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (v: number) => Math.round(v * 1000) / 1000;
const pts = (poly: Point[]) => poly.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');

function dimLine(a: Point, b: Point, offsetM: number, unit: DesignDocument['unitSystem'], color = '#8a8272'): string {
  const d = dist(a, b);
  if (d < 0.05) return '';
  const dir = norm(sub(b, a));
  const n = perp(dir);
  const a2 = add(a, vscale(n, offsetM));
  const b2 = add(b, vscale(n, offsetM));
  const mid = { x: (a2.x + b2.x) / 2, y: (a2.y + b2.y) / 2 };
  let ang = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  if (ang > 90 || ang <= -90) ang += 180;
  const t = 0.08;
  const tick = (p: Point) =>
    `<line x1="${num(p.x - n.x * t)}" y1="${num(p.y - n.y * t)}" x2="${num(p.x + n.x * t)}" y2="${num(p.y + n.y * t)}" stroke="${color}" stroke-width="0.02"/>`;
  return `
  <g>
    <line x1="${num(a2.x)}" y1="${num(a2.y)}" x2="${num(b2.x)}" y2="${num(b2.y)}" stroke="${color}" stroke-width="0.02"/>
    ${tick(a2)}${tick(b2)}
    <text x="0" y="0" transform="translate(${num(mid.x)} ${num(mid.y)}) rotate(${num(ang)}) translate(0 -0.09)"
      font-size="0.24" text-anchor="middle" fill="${color}" font-family="sans-serif">${esc(formatLength(d, unit))}</text>
  </g>`;
}

/**
 * Door leaf + swing symbol in wall-local space (the white gap is drawn by the
 * caller). Handles single, double, and sliding leaves.
 */
function doorSymbolSVG(o: OpeningElement, w: number, color: string): string {
  const s = o.swing ?? 1;
  if (o.style === 'sliding') {
    // Two offset leaves passing each other.
    return (
      `<line x1="${num(-w / 2)}" y1="-0.045" x2="0.05" y2="-0.045" stroke="${color}" stroke-width="0.04"/>` +
      `<line x1="-0.05" y1="0.045" x2="${num(w / 2)}" y2="0.045" stroke="${color}" stroke-width="0.04"/>`
    );
  }
  if (o.style === 'double') {
    const h = w / 2;
    return (
      `<line x1="${num(-w / 2)}" y1="0" x2="${num(-w / 2)}" y2="${num(-s * h)}" stroke="${color}" stroke-width="0.03"/>` +
      `<path d="M 0 0 A ${num(h)} ${num(h)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * h)}" fill="none" stroke="${color}" stroke-width="0.016"/>` +
      `<line x1="${num(w / 2)}" y1="0" x2="${num(w / 2)}" y2="${num(-s * h)}" stroke="${color}" stroke-width="0.03"/>` +
      `<path d="M 0 0 A ${num(h)} ${num(h)} 0 0 ${s === 1 ? 1 : 0} ${num(w / 2)} ${num(-s * h)}" fill="none" stroke="${color}" stroke-width="0.016"/>`
    );
  }
  return (
    `<line x1="${num(-w / 2)}" y1="0" x2="${num(-w / 2)}" y2="${num(-s * w)}" stroke="${color}" stroke-width="0.03"/>` +
    `<path d="M ${num(w / 2)} 0 A ${num(w)} ${num(w)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * w)}" fill="none" stroke="${color}" stroke-width="0.016"/>`
  );
}

/** Floor-plan drawing of one level. */
export function planSVG(
  doc: DesignDocument,
  levelId: string,
  style: DrawingStyle = 'presentation',
): string {
  if (style === 'working') return planWorkingSVG(doc, levelId);
  return planPresentationSVG(doc, levelId);
}

function planPresentationSVG(doc: DesignDocument, levelId: string): string {
  const level: Level | undefined = doc.levels.find((l) => l.id === levelId) ?? doc.levels[0];
  const unit = doc.unitSystem;
  const walls = level?.elements.filter(isWall) ?? [];
  const rooms = level?.elements.filter(isRoom) ?? [];
  const openings = level?.elements.filter(isOpening) ?? [];
  const furniture = level?.elements.filter(isFurniture) ?? [];

  // Content bounds.
  const allPts: Point[] = [
    ...doc.plot.boundary,
    ...walls.flatMap((w) => [w.start, w.end]),
    ...rooms.flatMap((r) => r.boundary),
    ...furniture.map((f) => ({ x: f.transform.position.x, y: f.transform.position.y })),
  ];
  if (allPts.length === 0) allPts.push({ x: 0, y: 0 }, { x: 10, y: 10 });
  const b = polygonBounds(allPts);
  const m = 2.2; // margin, meters
  const vb = { x: b.min.x - m, y: b.min.y - m, w: b.max.x - b.min.x + 2 * m, h: b.max.y - b.min.y + 2 * m };

  const parts: string[] = [];

  // Plot + setbacks.
  if (doc.plot.boundary.length >= 3) {
    parts.push(
      `<polygon points="${pts(doc.plot.boundary)}" fill="#eef0e2" stroke="#6b6353" stroke-width="0.05"/>`,
    );
    const region = buildableRegion(
      doc.plot.boundary,
      doc.plot.roadDirection,
      doc.plot.setbacks,
      doc.plot.edgeSetbacks,
    );
    if (region) {
      parts.push(
        `<polygon points="${pts(region)}" fill="none" stroke="#7ba05b" stroke-width="0.03" stroke-dasharray="0.25 0.15"${doc.plot.buildableOverride ? ' opacity="0.45"' : ''}/>`,
      );
    }
    if (doc.plot.buildableOverride && doc.plot.buildableOverride.length >= 3) {
      parts.push(
        `<polygon points="${pts(doc.plot.buildableOverride)}" fill="rgba(123,160,91,0.08)" stroke="#5d8a3f" stroke-width="0.045"/>`,
      );
    }
    const cw = ensureClockwise(doc.plot.boundary);
    for (let i = 0; i < cw.length; i++) {
      parts.push(dimLine(cw[i], cw[(i + 1) % cw.length], -0.55, unit, '#7a6f4f'));
    }
  }

  // Rooms.
  for (const r of rooms) {
    if (r.boundary.length < 3) continue;
    const c = polygonCentroid(r.boundary);
    parts.push(
      `<polygon points="${pts(r.boundary)}" fill="${ROOM_FILLS[r.roomType]}" stroke="#c9c2b4" stroke-width="0.02"/>`,
      `<text x="${num(c.x)}" y="${num(c.y - 0.08)}" font-size="0.32" text-anchor="middle" fill="#57503f" font-family="sans-serif" font-weight="600">${esc(r.name)}</text>`,
      `<text x="${num(c.x)}" y="${num(c.y + 0.28)}" font-size="0.24" text-anchor="middle" fill="#8a8272" font-family="sans-serif">${esc(formatArea(polygonArea(r.boundary), unit))}</text>`,
    );
  }

  // Furniture outlines.
  for (const f of furniture) {
    const t = f.transform;
    const deg = (t.rotation * 180) / Math.PI;
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num(deg)})">
        <rect x="${num(-f.dimensions.width / 2)}" y="${num(-f.dimensions.depth / 2)}" width="${num(f.dimensions.width)}" height="${num(f.dimensions.depth)}"
          fill="rgba(255,255,255,0.5)" stroke="#7d786c" stroke-width="0.02"/>
      </g>`,
    );
  }

  // Walls as one even-odd path (correct corners + junctions).
  const rings = wallsUnionOutlines(walls);
  if (rings.length > 0) {
    const d = rings
      .map((ring) => `M ${ring.map((p) => `${num(p.x)} ${num(p.y)}`).join(' L ')} Z`)
      .join(' ');
    parts.push(`<path d="${d}" fill="#4a443a" fill-rule="evenodd" stroke="#332f28" stroke-width="0.01"/>`);
  }

  // Openings: white gap + symbol.
  for (const o of openings) {
    const host = walls.find((w) => w.id === o.wallId);
    if (!host) continue;
    const dir = norm(sub(host.end, host.start));
    const c = add(host.start, vscale(dir, o.offset));
    const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const th = wallThickness(host);
    const w = o.dimensions.width;
    const inner: string[] = [
      `<rect x="${num(-w / 2)}" y="${num(-th / 2 - 0.01)}" width="${num(w)}" height="${num(th + 0.02)}" fill="#f4f2ec"/>`,
      `<line x1="${num(-w / 2)}" y1="${num(-th / 2)}" x2="${num(-w / 2)}" y2="${num(th / 2)}" stroke="#4a463d" stroke-width="0.025"/>`,
      `<line x1="${num(w / 2)}" y1="${num(-th / 2)}" x2="${num(w / 2)}" y2="${num(th / 2)}" stroke="#4a463d" stroke-width="0.025"/>`,
    ];
    if (o.type === 'door') {
      inner.push(doorSymbolSVG(o, w, '#4a463d'));
    } else {
      inner.push(
        `<rect x="${num(-w / 2)}" y="${num(-th / 2)}" width="${num(w)}" height="${num(th)}" fill="none" stroke="#4a463d" stroke-width="0.02"/>`,
        `<line x1="${num(-w / 2)}" y1="0" x2="${num(w / 2)}" y2="0" stroke="#4a463d" stroke-width="0.02"/>`,
      );
    }
    parts.push(`<g transform="translate(${num(c.x)} ${num(c.y)}) rotate(${num(deg)})">${inner.join('')}</g>`);
  }

  // Roofs (dashed eave outline + ridge).
  for (const el of level?.elements ?? []) {
    if (el.type !== 'roof') continue;
    const W = el.dimensions.width + 2 * el.overhang;
    const D = el.dimensions.depth + 2 * el.overhang;
    const geo = roofGeometry(el.roofStyle, W, D, el.pitch, el.dimensions.thickness ?? 0.15);
    const deg = (el.transform.rotation * 180) / Math.PI;
    const ridge = geo.ridge
      ? `<line x1="${num(geo.ridge[0].x)}" y1="${num(geo.ridge[0].y)}" x2="${num(geo.ridge[1].x)}" y2="${num(geo.ridge[1].y)}" stroke="#8a6845" stroke-width="0.04"/>`
      : '';
    parts.push(
      `<g transform="translate(${num(el.transform.position.x)} ${num(el.transform.position.y)}) rotate(${num(deg)})">
        <rect x="${num(-W / 2)}" y="${num(-D / 2)}" width="${num(W)}" height="${num(D)}" fill="none" stroke="#8a6845" stroke-width="0.03" stroke-dasharray="0.3 0.18"/>
        ${ridge}
      </g>`,
    );
  }

  // Text notes.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'note') continue;
    const t = el.transform;
    const size = el.dimensions.height;
    const lines = el.text.split('\n');
    const tspans = lines
      .map(
        (line, li) =>
          `<tspan x="0" dy="${li === 0 ? 0 : num(size * 1.3)}">${esc(line)}</tspan>`,
      )
      .join('');
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num((t.rotation * 180) / Math.PI)})">
        <text x="0" y="${num(-el.dimensions.depth / 2 + size)}" font-size="${num(size)}" text-anchor="middle"
          fill="${el.material.color}" font-family="sans-serif">${tspans}</text>
      </g>`,
    );
  }

  // Wall dimensions.
  for (const w of walls) {
    parts.push(dimLine(w.start, w.end, -(wallThickness(w) / 2 + 0.28), unit));
  }

  // Title block.
  parts.push(
    `<text x="${num(vb.x + 0.3)}" y="${num(vb.y + 0.65)}" font-size="0.42" fill="#57503f" font-family="sans-serif" font-weight="700">${esc(doc.name)} — ${esc(level?.name ?? '')}</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${Math.round(vb.w * 55)}" height="${Math.round(vb.h * 55)}">
  <rect x="${num(vb.x)}" y="${num(vb.y)}" width="${num(vb.w)}" height="${num(vb.h)}" fill="#f4f2ec"/>
  ${parts.join('\n')}
</svg>`;
}

// Ink palette shared with the composed-facade elevation fallback below.
const INK = '#141414';
const INK_MID = '#4c4c4c';
const INK_SOFT = '#8b8b8b';

/**
 * Elevation drawing. Components are rendered as simplified vector blocks
 * (colored, labeled) — the on-canvas symbols are richer; this is a clean
 * drawing-sheet representation.
 */
export function elevationSVG(
  doc: DesignDocument,
  facadeId: string,
  style: DrawingStyle = 'presentation',
): string {
  const facade: Facade | undefined = doc.facades.find((f) => f.id === facadeId) ?? doc.facades[0];
  if (!facade) return '<svg xmlns="http://www.w3.org/2000/svg"/>';
  if (style === 'working') {
    // Prefer the model-projected elevation; fall back to the composed facade
    // (drawn monochrome below) when the document has no walls to project.
    const projected = elevationWorkingSVG(doc, facadeId);
    if (projected) return projected;
  }
  const working = style === 'working';
  const unit = doc.unitSystem;
  const m = 1.6;
  const mBottom = working ? 3.2 : m;
  const vb = {
    x: -m,
    y: -facade.height - m,
    w: facade.width + 2 * m,
    h: facade.height + m + mBottom,
  };
  const line = working ? INK : '#4a463d';

  const parts: string[] = [
    `<rect x="0" y="${num(-facade.height)}" width="${num(facade.width)}" height="${num(facade.height)}" fill="${working ? 'none' : facade.backdropColor}" stroke="${working ? INK : '#6b6353'}" stroke-width="0.04"/>`,
  ];

  const sorted = [...facade.elements].sort(
    (a, b) =>
      (a.layer ?? 0) - (b.layer ?? 0) ||
      b.dimensions.width * b.dimensions.height - a.dimensions.width * a.dimensions.height,
  );
  for (const el of sorted) {
    const def = facadeItemById(el.catalogId);
    const w = el.dimensions.width;
    const h = el.dimensions.height;
    const x = el.transform.position.x;
    const y = -el.transform.position.z;
    const isGlass = def?.symbol.startsWith('window');
    const fill = working ? '#ffffff' : isGlass ? '#bcd7e8' : el.material.color;
    parts.push(
      `<g transform="translate(${num(x)} ${num(y)}) rotate(${num((el.transform.rotation * 180) / Math.PI)})">
        <rect x="${num(-w / 2)}" y="${num(-h / 2)}" width="${num(w)}" height="${num(h)}"
          fill="${fill}" stroke="${line}" stroke-width="0.02"/>
        ${isGlass ? `<line x1="0" y1="${num(-h / 2)}" x2="0" y2="${num(h / 2)}" stroke="${line}" stroke-width="0.015"/><line x1="${num(-w / 2)}" y1="0" x2="${num(w / 2)}" y2="0" stroke="${line}" stroke-width="0.015"/>` : ''}
        ${
          working && isGlass
            ? `<line x1="${num(-w / 2)}" y1="${num(-h / 2)}" x2="${num(w / 2)}" y2="${num(h / 2)}" stroke="${INK_SOFT}" stroke-width="0.012"/>`
            : ''
        }
      </g>`,
    );
  }

  // Ground line + dims.
  parts.push(
    `<line x1="${num(-m)}" y1="0" x2="${num(facade.width + m)}" y2="0" stroke="${working ? INK : '#6b6353'}" stroke-width="${working ? 0.07 : 0.05}"/>`,
    dimLine({ x: 0, y: 0.45 }, { x: facade.width, y: 0.45 }, 0, unit, working ? INK_MID : '#7a6f4f'),
    dimLine({ x: -0.45, y: 0 }, { x: -0.45, y: -facade.height }, 0, unit, working ? INK_MID : '#7a6f4f'),
  );

  if (working) {
    const cx = facade.width / 2;
    const ty = facade.height * 0 + 1.7; // below the ground line
    parts.push(
      `<text x="${num(cx)}" y="${num(ty)}" font-size="0.52" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-weight="700" letter-spacing="0.06">${esc(facade.name.toUpperCase())}</text>`,
      `<line x1="${num(cx - 2.8)}" y1="${num(ty + 0.2)}" x2="${num(cx + 2.8)}" y2="${num(ty + 0.2)}" stroke="${INK}" stroke-width="0.045"/>`,
      `<line x1="${num(cx - 2.8)}" y1="${num(ty + 0.28)}" x2="${num(cx + 2.8)}" y2="${num(ty + 0.28)}" stroke="${INK}" stroke-width="0.015"/>`,
      `<text x="${num(cx)}" y="${num(ty + 0.72)}" font-size="0.26" text-anchor="middle" fill="${INK_MID}" font-family="sans-serif">${esc(doc.name)}</text>`,
    );
  } else {
    parts.push(
      `<text x="0" y="${num(-facade.height - 0.4)}" font-size="0.4" fill="#57503f" font-family="sans-serif" font-weight="700">${esc(doc.name)} — ${esc(facade.name)}</text>`,
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${Math.round(vb.w * 55)}" height="${Math.round(vb.h * 55)}">
  <rect x="${num(vb.x)}" y="${num(vb.y)}" width="${num(vb.w)}" height="${num(vb.h)}" fill="${working ? '#ffffff' : '#f4f2ec'}"/>
  ${parts.join('\n')}
</svg>`;
}
