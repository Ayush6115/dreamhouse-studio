import type { DesignDocument, Facade, Level, Point, WallElement } from '../../types';
import { isFurniture, isOpening, isRoom, isWall } from '../../types';
import { ensureClockwise, polygonBounds, polygonCentroid } from '../../geometry/polygon';
import { dimensionChains } from '../../geometry/dimchains';
import { roofGeometry } from '../../geometry/roof';
import { buildableRegion } from '../../geometry/setbacks';
import { add, closestPointOnSegment, dist, norm, perp, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness, wallsUnionOutlines } from '../../geometry/walls';
import { formatArea, formatLength } from '../../geometry/units';
import { polygonArea } from '../../geometry/polygon';
import { computeLevelMetrics } from '../../store/calculations';
import { ROOM_FILLS } from '../../library/roomColors';
import { catalogItemById } from '../../library/catalog';
import { facadeItemById } from '../../library/facadeCatalog';

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
      const s = o.swing ?? 1;
      inner.push(
        `<line x1="${num(-w / 2)}" y1="0" x2="${num(-w / 2)}" y2="${num(-s * w)}" stroke="#4a463d" stroke-width="0.03"/>`,
        `<path d="M ${num(w / 2)} 0 A ${num(w)} ${num(w)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * w)}" fill="none" stroke="#4a463d" stroke-width="0.02"/>`,
      );
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

/* ------------------------------------------------------------------ */
/* Working-drawing (B/W) floor plan                                     */
/* ------------------------------------------------------------------ */

const INK = '#141414';
const INK_MID = '#4c4c4c';
const INK_SOFT = '#8b8b8b';

/**
 * Structural junction points where two or more walls meet — drawn as solid
 * column squares, the way working drawings mark the column grid.
 */
function wallJunctions(walls: WallElement[]): { p: Point; size: number }[] {
  const out: { p: Point; size: number }[] = [];
  const push = (p: Point, size: number) => {
    const existing = out.find((q) => dist(q.p, p) < 0.08);
    if (existing) existing.size = Math.max(existing.size, size);
    else out.push({ p: { x: p.x, y: p.y }, size });
  };
  for (const w of walls) {
    for (const e of [w.start, w.end]) {
      let touches = 0;
      let maxTh = wallThickness(w);
      for (const o of walls) {
        if (o === w) continue;
        const { point } = closestPointOnSegment(e, o.start, o.end);
        if (dist(point, e) < wallThickness(o) / 2 + 0.03) {
          touches++;
          maxTh = Math.max(maxTh, wallThickness(o));
        }
      }
      if (touches > 0) push(e, Math.max(0.28, maxTh * 1.5));
    }
  }
  return out;
}

/**
 * One dimension row: line through sorted stations with slash ticks and a
 * length label per span. `horizontal` rows read along x at y=lineCoord;
 * vertical rows read along y at x=lineCoord (label rotated).
 */
function chainRowSVG(
  stations: number[],
  horizontal: boolean,
  lineCoord: number,
  unit: DesignDocument['unitSystem'],
): string {
  if (stations.length < 2) return '';
  const g: string[] = [];
  const first = stations[0];
  const last = stations[stations.length - 1];
  const line = horizontal
    ? `<line x1="${num(first)}" y1="${num(lineCoord)}" x2="${num(last)}" y2="${num(lineCoord)}" stroke="${INK_MID}" stroke-width="0.018"/>`
    : `<line x1="${num(lineCoord)}" y1="${num(first)}" x2="${num(lineCoord)}" y2="${num(last)}" stroke="${INK_MID}" stroke-width="0.018"/>`;
  g.push(line);
  const t = 0.09;
  for (const s of stations) {
    // 45° architectural slash tick at each station.
    const x = horizontal ? s : lineCoord;
    const y = horizontal ? lineCoord : s;
    g.push(
      `<line x1="${num(x - t)}" y1="${num(y + t)}" x2="${num(x + t)}" y2="${num(y - t)}" stroke="${INK}" stroke-width="0.03"/>`,
    );
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const span = stations[i + 1] - stations[i];
    if (span < 0.12) continue;
    const mid = (stations[i] + stations[i + 1]) / 2;
    const label = esc(formatLength(span, unit));
    if (horizontal) {
      g.push(
        `<text x="${num(mid)}" y="${num(lineCoord - 0.09)}" font-size="0.26" text-anchor="middle" fill="${INK}" font-family="sans-serif">${label}</text>`,
      );
    } else {
      g.push(
        `<text x="0" y="0" transform="translate(${num(lineCoord - 0.09)} ${num(mid)}) rotate(-90)" font-size="0.26" text-anchor="middle" fill="${INK}" font-family="sans-serif">${label}</text>`,
      );
    }
  }
  return `<g>${g.join('')}</g>`;
}

/** Monochrome working-drawing floor plan with hierarchical dimension chains. */
function planWorkingSVG(doc: DesignDocument, levelId: string): string {
  const level: Level | undefined = doc.levels.find((l) => l.id === levelId) ?? doc.levels[0];
  const unit = doc.unitSystem;
  const walls = level?.elements.filter(isWall).filter((w) => w.visible !== false) ?? [];
  const rooms = level?.elements.filter(isRoom) ?? [];
  const openings = level?.elements.filter(isOpening) ?? [];
  const furniture = level?.elements.filter(isFurniture) ?? [];

  const allPts: Point[] = [
    ...doc.plot.boundary,
    ...walls.flatMap((w) => [w.start, w.end]),
    ...rooms.flatMap((r) => r.boundary),
    ...furniture.map((f) => ({ x: f.transform.position.x, y: f.transform.position.y })),
  ];
  if (allPts.length === 0) allPts.push({ x: 0, y: 0 }, { x: 10, y: 10 });
  const b = polygonBounds(allPts);

  const chains = dimensionChains(walls, openings);
  const maxRows = chains.reduce((mx, c) => Math.max(mx, c.rows.length), 0);
  const chainExtent = maxRows > 0 ? 0.65 + maxRows * 0.62 : 0;
  const m = Math.max(2.2, chainExtent + 1.1);
  const mBottom = m + 2.2; // room for the title block
  const vb = {
    x: b.min.x - m,
    y: b.min.y - m,
    w: b.max.x - b.min.x + 2 * m,
    h: b.max.y - b.min.y + m + mBottom,
  };

  const parts: string[] = [];

  // Sheet frame.
  parts.push(
    `<rect x="${num(vb.x + 0.15)}" y="${num(vb.y + 0.15)}" width="${num(vb.w - 0.3)}" height="${num(vb.h - 0.3)}" fill="none" stroke="${INK}" stroke-width="0.05"/>`,
    `<rect x="${num(vb.x + 0.28)}" y="${num(vb.y + 0.28)}" width="${num(vb.w - 0.56)}" height="${num(vb.h - 0.56)}" fill="none" stroke="${INK}" stroke-width="0.015"/>`,
  );

  // Plot + buildable line.
  if (doc.plot.boundary.length >= 3) {
    parts.push(
      `<polygon points="${pts(doc.plot.boundary)}" fill="none" stroke="${INK_MID}" stroke-width="0.035"/>`,
    );
    const region =
      doc.plot.buildableOverride && doc.plot.buildableOverride.length >= 3
        ? doc.plot.buildableOverride
        : buildableRegion(
            doc.plot.boundary,
            doc.plot.roadDirection,
            doc.plot.setbacks,
            doc.plot.edgeSetbacks,
          );
    if (region) {
      parts.push(
        `<polygon points="${pts(region)}" fill="none" stroke="${INK_SOFT}" stroke-width="0.02" stroke-dasharray="0.28 0.16"/>`,
      );
    }
  }

  // Rooms: no fill — name + clear width × depth, like a working drawing.
  for (const r of rooms) {
    if (r.boundary.length < 3) continue;
    const c = polygonCentroid(r.boundary);
    const rb = polygonBounds(r.boundary);
    const size = `${formatLength(rb.max.x - rb.min.x, unit)} × ${formatLength(rb.max.y - rb.min.y, unit)}`;
    parts.push(
      `<text x="${num(c.x)}" y="${num(c.y - 0.1)}" font-size="0.34" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-weight="700" letter-spacing="0.03">${esc(r.name.toUpperCase())}</text>`,
      `<text x="${num(c.x)}" y="${num(c.y + 0.32)}" font-size="0.27" text-anchor="middle" fill="${INK_MID}" font-family="sans-serif">${esc(size)}</text>`,
    );
  }

  // Furniture symbols in light line-work (hatched wardrobes, framed counters).
  for (const f of furniture) {
    const t = f.transform;
    const deg = (t.rotation * 180) / Math.PI;
    const w = f.dimensions.width;
    const d = f.dimensions.depth;
    const symbol = catalogItemById(f.catalogId)?.symbol;
    const inner: string[] = [
      `<rect x="${num(-w / 2)}" y="${num(-d / 2)}" width="${num(w)}" height="${num(d)}" fill="none" stroke="${INK_SOFT}" stroke-width="0.02"/>`,
    ];
    if (symbol === 'wardrobe' || symbol === 'bookshelf') {
      // Diagonal hatch — the standard storage/casework convention.
      const step = 0.22;
      for (let s = -w / 2 - d; s < w / 2; s += step) {
        const x1 = Math.max(-w / 2, s);
        const y1 = s > -w / 2 ? -d / 2 : -d / 2 + (-w / 2 - s);
        const x2 = Math.min(w / 2, s + d);
        const y2 = s + d < w / 2 ? d / 2 : d / 2 - (s + d - w / 2);
        inner.push(
          `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${INK_SOFT}" stroke-width="0.014"/>`,
        );
      }
    } else if (symbol === 'counter' || symbol === 'island') {
      inner.push(
        `<rect x="${num(-w / 2 + 0.06)}" y="${num(-d / 2 + 0.06)}" width="${num(w - 0.12)}" height="${num(d - 0.12)}" fill="none" stroke="${INK_SOFT}" stroke-width="0.014"/>`,
      );
    } else if (symbol === 'bed') {
      inner.push(
        `<line x1="${num(-w / 2)}" y1="${num(-d / 2 + 0.55)}" x2="${num(w / 2)}" y2="${num(-d / 2 + 0.55)}" stroke="${INK_SOFT}" stroke-width="0.014"/>`,
        `<rect x="${num(-w / 2 + 0.08)}" y="${num(-d / 2 + 0.08)}" width="${num(w / 2 - 0.16)}" height="0.35" fill="none" stroke="${INK_SOFT}" stroke-width="0.014"/>`,
        `<rect x="${num(0.08)}" y="${num(-d / 2 + 0.08)}" width="${num(w / 2 - 0.16)}" height="0.35" fill="none" stroke="${INK_SOFT}" stroke-width="0.014"/>`,
      );
    }
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num(deg)})">${inner.join('')}</g>`,
    );
  }

  // Staircases: treads + UP arrow.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'staircase') continue;
    const w = el.dimensions.width;
    const d = el.dimensions.depth;
    const deg = (el.transform.rotation * 180) / Math.PI;
    const inner: string[] = [
      `<rect x="${num(-w / 2)}" y="${num(-d / 2)}" width="${num(w)}" height="${num(d)}" fill="none" stroke="${INK_MID}" stroke-width="0.025"/>`,
    ];
    const treads = Math.max(3, el.steps);
    for (let i = 1; i < treads; i++) {
      const y = -d / 2 + (d * i) / treads;
      inner.push(
        `<line x1="${num(-w / 2)}" y1="${num(y)}" x2="${num(w / 2)}" y2="${num(y)}" stroke="${INK_MID}" stroke-width="0.016"/>`,
      );
    }
    // UP arrow along the run.
    inner.push(
      `<line x1="0" y1="${num(d / 2 - 0.15)}" x2="0" y2="${num(-d / 2 + 0.3)}" stroke="${INK}" stroke-width="0.03"/>`,
      `<path d="M -0.11 ${num(-d / 2 + 0.42)} L 0 ${num(-d / 2 + 0.18)} L 0.11 ${num(-d / 2 + 0.42)}" fill="none" stroke="${INK}" stroke-width="0.03"/>`,
      `<text x="0.14" y="${num(d / 2 - 0.22)}" font-size="0.24" fill="${INK}" font-family="sans-serif" font-weight="700">UP</text>`,
    );
    parts.push(
      `<g transform="translate(${num(el.transform.position.x)} ${num(el.transform.position.y)}) rotate(${num(deg)})">${inner.join('')}</g>`,
    );
  }

  // Walls: solid black poché.
  const rings = wallsUnionOutlines(walls);
  if (rings.length > 0) {
    const d = rings
      .map((ring) => `M ${ring.map((p) => `${num(p.x)} ${num(p.y)}`).join(' L ')} Z`)
      .join(' ');
    parts.push(`<path d="${d}" fill="${INK}" fill-rule="evenodd"/>`);
  }

  // Column squares at wall junctions.
  for (const j of wallJunctions(walls)) {
    parts.push(
      `<rect x="${num(j.p.x - j.size / 2)}" y="${num(j.p.y - j.size / 2)}" width="${num(j.size)}" height="${num(j.size)}" fill="${INK}"/>`,
    );
  }
  for (const el of level?.elements ?? []) {
    if (el.type !== 'column') continue;
    const s = el.dimensions.width;
    parts.push(
      el.profile === 'round'
        ? `<circle cx="${num(el.transform.position.x)}" cy="${num(el.transform.position.y)}" r="${num(s / 2)}" fill="${INK}"/>`
        : `<rect x="${num(el.transform.position.x - s / 2)}" y="${num(el.transform.position.y - s / 2)}" width="${num(s)}" height="${num(s)}" fill="${INK}"/>`,
    );
  }

  // Openings cut white gaps, then draw B/W symbols.
  for (const o of openings) {
    const host = walls.find((w) => w.id === o.wallId);
    if (!host || o.visible === false) continue;
    const dir = norm(sub(host.end, host.start));
    const c = add(host.start, vscale(dir, o.offset));
    const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const th = wallThickness(host);
    const w = o.dimensions.width;
    const inner: string[] = [
      `<rect x="${num(-w / 2)}" y="${num(-th / 2 - 0.012)}" width="${num(w)}" height="${num(th + 0.024)}" fill="#ffffff"/>`,
      `<line x1="${num(-w / 2)}" y1="${num(-th / 2)}" x2="${num(-w / 2)}" y2="${num(th / 2)}" stroke="${INK}" stroke-width="0.025"/>`,
      `<line x1="${num(w / 2)}" y1="${num(-th / 2)}" x2="${num(w / 2)}" y2="${num(th / 2)}" stroke="${INK}" stroke-width="0.025"/>`,
    ];
    if (o.type === 'door') {
      const s = o.swing ?? 1;
      inner.push(
        `<line x1="${num(-w / 2)}" y1="0" x2="${num(-w / 2)}" y2="${num(-s * w)}" stroke="${INK}" stroke-width="0.03"/>`,
        `<path d="M ${num(w / 2)} 0 A ${num(w)} ${num(w)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * w)}" fill="none" stroke="${INK}" stroke-width="0.016"/>`,
      );
    } else {
      // Triple-line window convention.
      inner.push(
        `<rect x="${num(-w / 2)}" y="${num(-th / 2)}" width="${num(w)}" height="${num(th)}" fill="none" stroke="${INK}" stroke-width="0.02"/>`,
        `<line x1="${num(-w / 2)}" y1="0" x2="${num(w / 2)}" y2="0" stroke="${INK}" stroke-width="0.016"/>`,
      );
    }
    parts.push(
      `<g transform="translate(${num(c.x)} ${num(c.y)}) rotate(${num(deg)})">${inner.join('')}</g>`,
    );
  }

  // Roof overhangs above this level: dashed.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'roof') continue;
    const W = el.dimensions.width + 2 * el.overhang;
    const D = el.dimensions.depth + 2 * el.overhang;
    const deg = (el.transform.rotation * 180) / Math.PI;
    parts.push(
      `<g transform="translate(${num(el.transform.position.x)} ${num(el.transform.position.y)}) rotate(${num(deg)})">
        <rect x="${num(-W / 2)}" y="${num(-D / 2)}" width="${num(W)}" height="${num(D)}" fill="none" stroke="${INK_SOFT}" stroke-width="0.02" stroke-dasharray="0.3 0.18"/>
      </g>`,
    );
  }

  // Notes in plain black.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'note') continue;
    const t = el.transform;
    const size = el.dimensions.height;
    const tspans = el.text
      .split('\n')
      .map((line, li) => `<tspan x="0" dy="${li === 0 ? 0 : num(size * 1.3)}">${esc(line)}</tspan>`)
      .join('');
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num((t.rotation * 180) / Math.PI)})">
        <text x="0" y="${num(-el.dimensions.depth / 2 + size)}" font-size="${num(size)}" text-anchor="middle" fill="${INK}" font-family="sans-serif">${tspans}</text>
      </g>`,
    );
  }

  // Hierarchical dimension chains on all four sides.
  if (walls.length >= 2) {
    const wb = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
    for (const chain of chains) {
      chain.rows.forEach((row, i) => {
        const off = 0.65 + i * 0.62;
        const horizontal = chain.axis === 'x';
        const lineCoord =
          chain.side === 'top'
            ? wb.min.y - off
            : chain.side === 'bottom'
              ? wb.max.y + off
              : chain.side === 'left'
                ? wb.min.x - off
                : wb.max.x + off;
        parts.push(chainRowSVG(row, horizontal, lineCoord, unit));
      });
    }
  }

  // North arrow (top-right of the sheet).
  const nx = vb.x + vb.w - 1.35;
  const ny = vb.y + 1.35;
  parts.push(
    `<circle cx="${num(nx)}" cy="${num(ny)}" r="0.5" fill="none" stroke="${INK}" stroke-width="0.03"/>`,
    `<path d="M ${num(nx)} ${num(ny + 0.34)} L ${num(nx)} ${num(ny - 0.34)} M ${num(nx - 0.14)} ${num(ny - 0.1)} L ${num(nx)} ${num(ny - 0.34)} L ${num(nx + 0.14)} ${num(ny - 0.1)}" fill="none" stroke="${INK}" stroke-width="0.04"/>`,
    `<text x="${num(nx)}" y="${num(ny + 0.92)}" font-size="0.3" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-weight="700">N</text>`,
  );

  // Title block under the plan.
  const metrics = level ? computeLevelMetrics(level) : undefined;
  const cx = vb.x + vb.w / 2;
  const ty = vb.y + vb.h - 1.9;
  const title = `${(level?.name ?? 'FLOOR').toUpperCase()} PLAN`;
  parts.push(
    `<text x="${num(cx)}" y="${num(ty)}" font-size="0.55" text-anchor="middle" fill="${INK}" font-family="sans-serif" font-weight="700" letter-spacing="0.06">${esc(title)}</text>`,
    `<line x1="${num(cx - 3.4)}" y1="${num(ty + 0.22)}" x2="${num(cx + 3.4)}" y2="${num(ty + 0.22)}" stroke="${INK}" stroke-width="0.045"/>`,
    `<line x1="${num(cx - 3.4)}" y1="${num(ty + 0.3)}" x2="${num(cx + 3.4)}" y2="${num(ty + 0.3)}" stroke="${INK}" stroke-width="0.015"/>`,
  );
  if (metrics) {
    parts.push(
      `<text x="${num(cx)}" y="${num(ty + 0.78)}" font-size="0.32" text-anchor="middle" fill="${INK}" font-family="sans-serif">${esc(
        `${(level?.name ?? '').toUpperCase()} ENCLOSED AREA = ${formatArea(metrics.builtUpArea, unit)}`,
      )}</text>`,
    );
  }
  parts.push(
    `<text x="${num(cx)}" y="${num(ty + 1.24)}" font-size="0.26" text-anchor="middle" fill="${INK_MID}" font-family="sans-serif">${esc(doc.name)} · All dimensions to structural faces · Do not scale off this drawing</text>`,
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${Math.round(vb.w * 55)}" height="${Math.round(vb.h * 55)}">
  <rect x="${num(vb.x)}" y="${num(vb.y)}" width="${num(vb.w)}" height="${num(vb.h)}" fill="#ffffff"/>
  ${parts.join('\n')}
</svg>`;
}

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
