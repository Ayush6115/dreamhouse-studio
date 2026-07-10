import type {
  DesignDocument,
  Facade,
  Level,
  OpeningElement,
  Point,
  RoofElement,
  StaircaseElement,
  WallElement,
} from '../../types';
import { isFurniture, isOpening, isRoom, isWall } from '../../types';
import { dimensionChains } from '../../geometry/dimchains';
import { polygonBounds, polygonCentroid } from '../../geometry/polygon';
import { buildableRegion } from '../../geometry/setbacks';
import { add, closestPointOnSegment, dist, norm, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness, wallsUnionOutlines } from '../../geometry/walls';
import { formatArea, formatLength } from '../../geometry/units';
import { computeLevelMetrics } from '../../store/calculations';
import { catalogItemById, type Symbol2D } from '../../library/catalog';

/**
 * Monochrome working-drawing sheets (plan + elevation), generated from the
 * design document with construction-documentation conventions:
 *
 * - a pen hierarchy (heavy profile / medium object / thin detail / hairline
 *   pattern) instead of a single line weight;
 * - grey wall poché with solid-black column markers so structure reads;
 * - dimension chains with extension lines and architectural slash ticks;
 * - true opening symbols (leaf + swing arcs, passing sliding leaves,
 *   triple-line glazing with sill projections);
 * - sanitary/kitchen fixture linework, tile hatching in wet areas, a car in
 *   the porch, numbered stair run with break line;
 * - property-line linetype, graphic scale bar, north arrow, title block;
 * - elevations projected from the model itself: stacked floor outlines,
 *   parapet/roof silhouette, openings with frames/sills/chajjas, ground line
 *   with earth hatch, level datums and dimension chains.
 */

// ------------------------------------------------------------------ pens

const INK = '#141414';
const INK_MID = '#4c4c4c';
const INK_SOFT = '#8b8b8b';
const POCHE = '#45474c';
const FURN = '#63656a';
const HATCH = '#c9cac5';

const PEN = { heavy: 0.05, wall: 0.014, med: 0.026, thin: 0.014, hair: 0.009 };

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const num = (v: number) => Math.round(v * 1000) / 1000;
const pts = (poly: Point[]) => poly.map((p) => `${num(p.x)},${num(p.y)}`).join(' ');

const line = (x1: number, y1: number, x2: number, y2: number, stroke: string, w: number, extra = '') =>
  `<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(x2)}" y2="${num(y2)}" stroke="${stroke}" stroke-width="${w}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, fill: string, stroke = 'none', sw = 0, extra = '') =>
  `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" fill="${fill}"${stroke !== 'none' ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}${extra}/>`;
const circle = (cx: number, cy: number, r: number, stroke: string, sw: number, fill = 'none') =>
  `<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const text = (
  x: number,
  y: number,
  size: number,
  content: string,
  opts: { anchor?: string; fill?: string; weight?: number; rotate?: number } = {},
) => {
  const t = opts.rotate
    ? ` transform="translate(${num(x)} ${num(y)}) rotate(${opts.rotate})" x="0" y="0"`
    : ` x="${num(x)}" y="${num(y)}"`;
  return `<text${t} font-size="${num(size)}" text-anchor="${opts.anchor ?? 'middle'}" fill="${opts.fill ?? INK}" font-family="sans-serif"${opts.weight ? ` font-weight="${opts.weight}"` : ''}>${esc(content)}</text>`;
};

// ------------------------------------------------------- dimension chains

/**
 * One dimension row with extension lines crossing an architectural slash
 * tick at every station. `positive` says which side of the line the building
 * lies on (extension lines reach toward it).
 */
function chainRow(
  stations: number[],
  horizontal: boolean,
  lineCoord: number,
  unit: DesignDocument['unitSystem'],
  fontSize = 0.23,
): string {
  if (stations.length < 2) return '';
  const g: string[] = [];
  const a = stations[0];
  const b = stations[stations.length - 1];
  g.push(
    horizontal
      ? line(a, lineCoord, b, lineCoord, INK_MID, PEN.thin)
      : line(lineCoord, a, lineCoord, b, INK_MID, PEN.thin),
  );
  const t = 0.07;
  const ext = 0.14;
  for (const s of stations) {
    const x = horizontal ? s : lineCoord;
    const y = horizontal ? lineCoord : s;
    // extension line crossing the dimension line…
    g.push(
      horizontal
        ? line(x, y - ext, x, y + ext, INK_SOFT, PEN.hair)
        : line(x - ext, y, x + ext, y, INK_SOFT, PEN.hair),
    );
    // …with the 45° tick over it.
    g.push(line(x - t, y + t, x + t, y - t, INK, 0.028));
  }
  for (let i = 0; i < stations.length - 1; i++) {
    const span = stations[i + 1] - stations[i];
    if (span < 0.12) continue;
    const mid = (stations[i] + stations[i + 1]) / 2;
    const label = formatLength(span, unit);
    if (horizontal) g.push(text(mid, lineCoord - 0.07, fontSize, label));
    else g.push(text(lineCoord - 0.07, mid, fontSize, label, { rotate: -90 }));
  }
  return `<g>${g.join('')}</g>`;
}

// ------------------------------------------------------- furniture symbols

/** Thin-line fixture/furniture symbols, drawn centered in a w × d box. */
function furnitureSymbol(kind: Symbol2D | undefined, w: number, d: number): string {
  const hw = w / 2;
  const hd = d / 2;
  const th = PEN.thin;
  const body = rect(-hw, -hd, w, d, '#ffffff', FURN, th);
  const g: string[] = [];
  switch (kind) {
    case 'bed':
      g.push(body);
      g.push(rect(-hw + 0.08, -hd + 0.08, w / 2 - 0.14, 0.35, 'none', FURN, th, ' rx="0.05"'));
      if (w > 1.2) g.push(rect(0.06, -hd + 0.08, w / 2 - 0.14, 0.35, 'none', FURN, th, ' rx="0.05"'));
      g.push(line(-hw, -hd + 0.6, hw, -hd + 0.6, FURN, th));
      g.push(line(-hw, -hd + 0.6, -hw + 0.35, -hd + 0.95, FURN, PEN.hair)); // blanket fold
      break;
    case 'sofa':
      g.push(body);
      g.push(rect(-hw + 0.12, -hd + 0.12, w - 0.24, d - 0.24, 'none', FURN, th, ' rx="0.04"'));
      g.push(line(-hw + 0.12, -hd + 0.12 + (d - 0.24) * 0.35, hw - 0.12, -hd + 0.12 + (d - 0.24) * 0.35, FURN, th));
      for (let i = 1; i < 3; i++) g.push(line(-hw + 0.12 + ((w - 0.24) * i) / 3, -hd + 0.12 + (d - 0.24) * 0.35, -hw + 0.12 + ((w - 0.24) * i) / 3, hd - 0.12, FURN, PEN.hair));
      break;
    case 'sofa-l':
      g.push(
        `<polygon points="${pts([
          { x: -hw, y: -hd }, { x: hw, y: -hd }, { x: hw, y: -hd + 0.9 },
          { x: -hw + 0.9, y: -hd + 0.9 }, { x: -hw + 0.9, y: hd }, { x: -hw, y: hd },
        ])}" fill="#ffffff" stroke="${FURN}" stroke-width="${th}"/>`,
      );
      g.push(line(-hw + 0.25, -hd + 0.25, hw - 0.2, -hd + 0.25, FURN, th));
      g.push(line(-hw + 0.25, -hd + 0.25, -hw + 0.25, hd - 0.2, FURN, th));
      break;
    case 'armchair':
      g.push(body, rect(-hw + 0.1, -hd + 0.14, w - 0.2, d - 0.24, 'none', FURN, th, ' rx="0.05"'));
      break;
    case 'chair':
      g.push(body, line(-hw, -hd + 0.08, hw, -hd + 0.08, FURN, th));
      break;
    case 'table-round':
      g.push(circle(0, 0, hw, FURN, th, '#ffffff'));
      break;
    case 'wardrobe':
    case 'dresser': {
      g.push(body);
      // diagonal hatch — casework convention
      const step = 0.16;
      for (let s = -hw - d; s < hw; s += step) {
        const x1 = Math.max(-hw, s);
        const y1 = s > -hw ? -hd : -hd + (-hw - s);
        const x2 = Math.min(hw, s + d);
        const y2 = s + d < hw ? hd : hd - (s + d - hw);
        g.push(line(x1, y1, x2, y2, FURN, PEN.hair));
      }
      break;
    }
    case 'tv-unit':
      g.push(body, line(-hw + 0.12, hd - 0.08, hw - 0.12, hd - 0.08, INK, 0.03));
      break;
    case 'bookshelf':
      g.push(body, line(-hw + w * 0.33, -hd, -hw + w * 0.33, hd, FURN, th), line(-hw + w * 0.66, -hd, -hw + w * 0.66, hd, FURN, th));
      break;
    case 'counter':
    case 'island':
      g.push(body, rect(-hw + 0.05, -hd + 0.05, w - 0.1, d - 0.1, 'none', FURN, PEN.hair));
      break;
    case 'planter': {
      g.push(body, rect(-hw + 0.05, -hd + 0.05, w - 0.1, d - 0.1, 'none', FURN, PEN.hair));
      const shrubs = Math.max(1, Math.round(w / 0.45));
      for (let i = 0; i < shrubs; i++) {
        g.push(circle(-hw + (w * (i + 0.5)) / shrubs, 0, Math.min(hd, w / shrubs / 2) * 0.65, '#7b7d78', PEN.hair));
      }
      break;
    }
    case 'fridge':
      g.push(body, line(-hw, -hd + 0.18, hw, -hd + 0.18, FURN, th), text(0, 0.1, Math.min(0.22, w * 0.36), 'REF', { fill: FURN }));
      break;
    case 'stove': {
      g.push(body);
      const r = Math.min(w, d) * 0.14;
      for (const [x, y] of [[-w * 0.22, -d * 0.18], [w * 0.22, -d * 0.18], [-w * 0.22, d * 0.22], [w * 0.22, d * 0.22]]) {
        g.push(circle(x, y, r, FURN, th));
        g.push(circle(x, y, r * 0.4, FURN, PEN.hair));
      }
      break;
    }
    case 'sink':
      g.push(body, rect(-hw + 0.08, -hd + 0.08, w - 0.16, d - 0.16, 'none', FURN, th, ' rx="0.06"'), circle(0, -hd + 0.13, 0.035, FURN, th));
      break;
    case 'toilet':
      g.push(rect(-hw, -hd, w, 0.18, '#ffffff', FURN, th));
      g.push(`<ellipse cx="0" cy="${num(0.1)}" rx="${num(hw * 0.8)}" ry="${num(hd - 0.2)}" fill="#ffffff" stroke="${FURN}" stroke-width="${th}"/>`);
      g.push(`<ellipse cx="0" cy="${num(0.12)}" rx="${num(hw * 0.5)}" ry="${num((hd - 0.2) * 0.62)}" fill="none" stroke="${FURN}" stroke-width="${PEN.hair}"/>`);
      break;
    case 'washbasin':
      g.push(body, `<ellipse cx="0" cy="0.02" rx="${num(hw * 0.7)}" ry="${num(hd * 0.6)}" fill="none" stroke="${FURN}" stroke-width="${th}"/>`, circle(0, -hd + 0.12, 0.025, FURN, PEN.hair));
      break;
    case 'shower':
      g.push(body, line(-hw, -hd, hw, hd, FURN, PEN.hair), line(hw, -hd, -hw, hd, FURN, PEN.hair), circle(0, 0, 0.05, FURN, th));
      break;
    case 'bathtub':
      g.push(body, rect(-hw + 0.09, -hd + 0.09, w - 0.18, d - 0.18, 'none', FURN, th, ' rx="0.16"'), circle(-hw + 0.22, 0, 0.04, FURN, th));
      break;
    case 'washing-machine':
      g.push(body, circle(0, 0.02, Math.min(w, d) * 0.3, FURN, th), circle(0, 0.02, Math.min(w, d) * 0.18, FURN, PEN.hair));
      break;
    case 'plant': {
      g.push(circle(0, 0, hw, '#7b7d78', PEN.hair));
      for (const a of [0, 60, 120, 180, 240, 300]) {
        g.push(line(0, 0, hw * 0.85 * Math.cos((a * Math.PI) / 180), hw * 0.85 * Math.sin((a * Math.PI) / 180), '#7b7d78', PEN.hair));
      }
      break;
    }
    case 'rug':
      g.push(rect(-hw, -hd, w, d, 'none', FURN, PEN.hair, ' stroke-dasharray="0.08 0.06"'));
      break;
    case 'railing': {
      g.push(line(-hw, -hd, hw, -hd, FURN, th), line(-hw, hd, hw, hd, FURN, th));
      const posts = Math.max(2, Math.round(w / 0.6));
      for (let i = 0; i <= posts; i++) g.push(circle(-hw + (w * i) / posts, 0, 0.028, FURN, 0, FURN));
      break;
    }
    case 'slats': {
      g.push(body);
      const c = Math.max(3, Math.round(w / 0.15));
      for (let i = 0; i < c; i++) g.push(line(-hw + (w * (i + 0.5)) / c, -hd, -hw + (w * (i + 0.5)) / c, hd, FURN, PEN.hair));
      break;
    }
    case 'lamp-floor':
    case 'lamp-ceiling':
      g.push(circle(0, 0, hw, FURN, th, '#ffffff'), line(-hw, 0, hw, 0, FURN, PEN.hair), line(0, -hd, 0, hd, FURN, PEN.hair));
      break;
    case 'table-rect':
    default:
      g.push(body);
  }
  return g.join('');
}

/** Top-view car for porch/parking rooms. */
function carSymbol(): string {
  // 1.8 m × 4.4 m, nose toward -y.
  const g: string[] = [];
  const w = 1.76;
  const l = 4.35;
  g.push(rect(-w / 2, -l / 2, w, l, '#ffffff', FURN, PEN.thin, ' rx="0.32"'));
  // hood + trunk cut lines
  g.push(line(-w / 2 + 0.06, -l / 2 + 0.85, w / 2 - 0.06, -l / 2 + 0.85, FURN, PEN.hair));
  g.push(line(-w / 2 + 0.06, l / 2 - 0.7, w / 2 - 0.06, l / 2 - 0.7, FURN, PEN.hair));
  // cabin
  g.push(rect(-w / 2 + 0.14, -l / 2 + 1.05, w - 0.28, l - 2.05, 'none', FURN, PEN.thin, ' rx="0.22"'));
  // windshield / rear glass
  g.push(line(-w / 2 + 0.14, -l / 2 + 1.5, w / 2 - 0.14, -l / 2 + 1.5, FURN, PEN.hair));
  g.push(line(-w / 2 + 0.14, l / 2 - 1.35, w / 2 - 0.14, l / 2 - 1.35, FURN, PEN.hair));
  // mirrors
  g.push(rect(-w / 2 - 0.1, -l / 2 + 1.12, 0.1, 0.16, '#ffffff', FURN, PEN.hair));
  g.push(rect(w / 2, -l / 2 + 1.12, 0.1, 0.16, '#ffffff', FURN, PEN.hair));
  return g.join('');
}

// ------------------------------------------------------------- junctions

/** Wall junction points, drawn as solid column markers. */
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
      if (touches > 0) push(e, Math.max(0.3, maxTh * 1.5));
    }
  }
  return out;
}

// --------------------------------------------------------------- openings

function doorSymbol(o: OpeningElement, w: number, th: number): string {
  const s = o.swing ?? 1;
  const g: string[] = [];
  // jamb blocks
  g.push(rect(-w / 2 - 0.05, -th / 2, 0.05, th, INK));
  g.push(rect(w / 2, -th / 2, 0.05, th, INK));
  const leaf = (hingeX: number, len: number, dirSign: number) => {
    const y0 = Math.min(0, -dirSign * len);
    g.push(rect(hingeX - 0.022, y0, 0.044, len, '#ffffff', INK, PEN.thin));
  };
  if (o.style === 'sliding') {
    g.push(line(-w / 2, -0.02 - th / 6, 0.06, -0.02 - th / 6, INK, 0.045));
    g.push(line(-0.06, 0.02 + th / 6, w / 2, 0.02 + th / 6, INK, 0.045));
    g.push(line(-w / 2, 0, w / 2, 0, INK_SOFT, PEN.hair));
  } else if (o.style === 'double') {
    const h = w / 2;
    leaf(-w / 2, h, s);
    leaf(w / 2, h, s);
    g.push(`<path d="M 0 0 A ${num(h)} ${num(h)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * h)}" fill="none" stroke="${INK}" stroke-width="${PEN.hair}"/>`);
    g.push(`<path d="M 0 0 A ${num(h)} ${num(h)} 0 0 ${s === 1 ? 1 : 0} ${num(w / 2)} ${num(-s * h)}" fill="none" stroke="${INK}" stroke-width="${PEN.hair}"/>`);
  } else {
    leaf(-w / 2, w, s);
    g.push(`<path d="M ${num(w / 2)} 0 A ${num(w)} ${num(w)} 0 0 ${s === 1 ? 0 : 1} ${num(-w / 2)} ${num(-s * w)}" fill="none" stroke="${INK}" stroke-width="${PEN.hair}"/>`);
  }
  return g.join('');
}

function windowSymbol(w: number, th: number): string {
  const g: string[] = [];
  // frame + jambs
  g.push(rect(-w / 2, -th / 2, w, th, 'none', INK, PEN.thin));
  g.push(rect(-w / 2 - 0.05, -th / 2, 0.05, th, INK));
  g.push(rect(w / 2, -th / 2, 0.05, th, INK));
  // triple-line glazing
  g.push(line(-w / 2, -0.025, w / 2, -0.025, INK, PEN.hair));
  g.push(line(-w / 2, 0, w / 2, 0, INK, PEN.thin));
  g.push(line(-w / 2, 0.025, w / 2, 0.025, INK, PEN.hair));
  // sill projection
  g.push(line(-w / 2 - 0.08, th / 2 + 0.045, w / 2 + 0.08, th / 2 + 0.045, INK_SOFT, PEN.hair));
  return g.join('');
}

// -------------------------------------------------------------- hatching

/** Light grid hatch clipped to a room polygon (wet areas, paving). */
function gridHatch(clipId: string, poly: Point[], step: number): string {
  const b = polygonBounds(poly);
  const lines: string[] = [];
  for (let x = Math.ceil(b.min.x / step) * step; x < b.max.x; x += step) {
    lines.push(line(x, b.min.y, x, b.max.y, HATCH, PEN.hair));
  }
  for (let y = Math.ceil(b.min.y / step) * step; y < b.max.y; y += step) {
    lines.push(line(b.min.x, y, b.max.x, y, HATCH, PEN.hair));
  }
  return `<clipPath id="${clipId}"><polygon points="${pts(poly)}"/></clipPath><g clip-path="url(#${clipId})">${lines.join('')}</g>`;
}

// -------------------------------------------------------------- staircase

function staircaseSymbol(el: StaircaseElement): string {
  const w = el.dimensions.width;
  const d = el.dimensions.depth;
  const steps = Math.max(3, el.steps);
  const g: string[] = [];
  g.push(rect(-w / 2, -d / 2, w, d, '#ffffff', INK_MID, PEN.med));
  for (let i = 1; i < steps; i++) {
    const y = -d / 2 + (d * i) / steps;
    g.push(line(-w / 2, y, w / 2, y, INK_MID, PEN.thin));
  }
  // break line across the middle of the run
  const by = 0;
  const z = 0.1;
  g.push(
    `<polyline points="${num(-w / 2 - 0.06)},${num(by + z)} ${num(-w / 6)},${num(by + z * 0.2)} ${num(0)},${num(by + z * 1.4)} ${num(w / 6)},${num(by - z * 0.6)} ${num(w / 2 + 0.06)},${num(by - z * 0.1)}" fill="none" stroke="${INK}" stroke-width="${PEN.thin}"/>`,
  );
  // walk line: tail circle at first riser, arrow at top
  g.push(circle(0, d / 2 - 0.18, 0.05, INK, PEN.thin));
  g.push(line(0, d / 2 - 0.18, 0, -d / 2 + 0.3, INK, 0.026));
  g.push(`<path d="M -0.1 ${num(-d / 2 + 0.42)} L 0 ${num(-d / 2 + 0.2)} L 0.1 ${num(-d / 2 + 0.42)}" fill="none" stroke="${INK}" stroke-width="0.026"/>`);
  g.push(text(0.16, d / 2 - 0.32, 0.2, `UP`, { anchor: 'start', weight: 700 }));
  g.push(text(0.16, d / 2 - 0.06, 0.17, `${steps} R`, { anchor: 'start', fill: INK_MID }));
  return g.join('');
}

// ----------------------------------------------------------- sheet extras

function northArrow(cx: number, cy: number): string {
  const g: string[] = [];
  g.push(circle(cx, cy, 0.5, INK, 0.03));
  g.push(`<polygon points="${num(cx)},${num(cy - 0.4)} ${num(cx + 0.13)},${num(cy + 0.28)} ${num(cx)},${num(cy + 0.1)}" fill="${INK}"/>`);
  g.push(`<polygon points="${num(cx)},${num(cy - 0.4)} ${num(cx - 0.13)},${num(cy + 0.28)} ${num(cx)},${num(cy + 0.1)}" fill="none" stroke="${INK}" stroke-width="${PEN.thin}"/>`);
  g.push(text(cx, cy + 0.9, 0.3, 'N', { weight: 700 }));
  return g.join('');
}

function scaleBar(cx: number, y: number, unit: DesignDocument['unitSystem']): string {
  const g: string[] = [];
  const FT = 0.3048;
  const total = unit === 'imperial' ? 10 * FT : 3;
  const divs = unit === 'imperial' ? 5 : 6;
  const seg = total / divs;
  const x0 = cx - total / 2;
  const h = 0.13;
  for (let i = 0; i < divs; i++) {
    g.push(rect(x0 + i * seg, y, seg, h, i % 2 === 0 ? INK : '#ffffff', INK, PEN.hair));
  }
  const lbl = (v: number) => (unit === 'imperial' ? `${Math.round(v / FT)}'` : `${v} m`);
  g.push(text(x0, y - 0.08, 0.2, '0', { fill: INK_MID }));
  g.push(text(x0 + total / 2, y - 0.08, 0.2, lbl(total / 2), { fill: INK_MID }));
  g.push(text(x0 + total, y - 0.08, 0.2, lbl(total), { fill: INK_MID }));
  g.push(text(x0 + total + 0.35, y + h - 0.01, 0.2, 'SCALE', { anchor: 'start', fill: INK_MID }));
  return g.join('');
}

const PROPERTY_DASH = ' stroke-dasharray="0.65 0.14 0.1 0.14 0.1 0.14"';

// ================================================================== PLAN

export function planWorkingSVG(doc: DesignDocument, levelId: string): string {
  const level: Level | undefined = doc.levels.find((l) => l.id === levelId) ?? doc.levels[0];
  const unit = doc.unitSystem;
  const walls = level?.elements.filter(isWall).filter((w) => w.visible !== false) ?? [];
  const rooms = level?.elements.filter(isRoom) ?? [];
  const openings = level?.elements.filter(isOpening).filter((o) => o.visible !== false) ?? [];
  const furniture = level?.elements.filter(isFurniture).filter((f) => f.visible !== false) ?? [];

  const allPts: Point[] = [
    ...doc.plot.boundary,
    ...walls.flatMap((w) => [w.start, w.end]),
    ...rooms.flatMap((r) => r.boundary),
  ];
  if (allPts.length === 0) allPts.push({ x: 0, y: 0 }, { x: 10, y: 10 });
  const b = polygonBounds(allPts);

  const chains = dimensionChains(walls, openings);
  const maxRows = chains.reduce((mx, c) => Math.max(mx, c.rows.length), 0);
  const chainExtent = maxRows > 0 ? 0.55 + maxRows * 0.55 : 0;
  const m = Math.max(2.0, chainExtent + 1.0);
  const mBottom = m + 2.6;
  const vb = {
    x: b.min.x - m,
    y: b.min.y - m,
    w: b.max.x - b.min.x + 2 * m,
    h: b.max.y - b.min.y + m + mBottom,
  };

  const parts: string[] = [];

  // Sheet frame.
  parts.push(
    rect(vb.x + 0.15, vb.y + 0.15, vb.w - 0.3, vb.h - 0.3, 'none', INK, PEN.heavy),
    rect(vb.x + 0.26, vb.y + 0.26, vb.w - 0.52, vb.h - 0.52, 'none', INK, PEN.hair),
  );

  // Plot boundary (property-line linetype) + buildable line.
  if (doc.plot.boundary.length >= 3) {
    parts.push(
      `<polygon points="${pts(doc.plot.boundary)}" fill="none" stroke="${INK_MID}" stroke-width="0.032"${PROPERTY_DASH}/>`,
    );
    const region =
      doc.plot.buildableOverride && doc.plot.buildableOverride.length >= 3
        ? doc.plot.buildableOverride
        : buildableRegion(doc.plot.boundary, doc.plot.roadDirection, doc.plot.setbacks, doc.plot.edgeSetbacks);
    if (region) {
      parts.push(
        `<polygon points="${pts(region)}" fill="none" stroke="${INK_SOFT}" stroke-width="${PEN.hair}" stroke-dasharray="0.3 0.16"/>`,
      );
    }
  }

  // Wet-area / paving hatch (under everything else in the room).
  let clipN = 0;
  for (const r of rooms) {
    if (r.boundary.length < 3 || r.visible === false) continue;
    if (r.roomType === 'bathroom' || r.roomType === 'kitchen') {
      parts.push(gridHatch(`wd-clip-${++clipN}`, r.boundary, 0.3));
    } else if (r.roomType === 'parking' || r.roomType === 'balcony') {
      parts.push(gridHatch(`wd-clip-${++clipN}`, r.boundary, 0.6));
    }
  }

  // Furniture symbols (white-filled, masking the hatch below them).
  for (const f of furniture) {
    const t = f.transform;
    const deg = (t.rotation * 180) / Math.PI;
    const symbol = catalogItemById(f.catalogId)?.symbol;
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num(deg)})">${furnitureSymbol(symbol, f.dimensions.width, f.dimensions.depth)}</g>`,
    );
  }

  // Car in parking rooms that can hold one (scaled down a little if snug).
  for (const r of rooms) {
    if (r.roomType !== 'parking' || r.boundary.length < 3) continue;
    const rb = polygonBounds(r.boundary);
    const rw = rb.max.x - rb.min.x;
    const rd = rb.max.y - rb.min.y;
    const long = Math.max(rw, rd);
    const short = Math.min(rw, rd);
    if (long < 3.8 || short < 2.1) continue;
    const s = Math.min(1, (long - 0.5) / 4.35, (short - 0.4) / 1.76);
    const c = polygonCentroid(r.boundary);
    const rot = rd >= rw ? 0 : 90;
    parts.push(
      `<g transform="translate(${num(c.x)} ${num(c.y)}) rotate(${rot}) scale(${num(s)})">${carSymbol()}</g>`,
    );
  }

  // Staircases.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'staircase' || el.visible === false) continue;
    const deg = (el.transform.rotation * 180) / Math.PI;
    parts.push(
      `<g transform="translate(${num(el.transform.position.x)} ${num(el.transform.position.y)}) rotate(${num(deg)})">${staircaseSymbol(el)}</g>`,
    );
  }

  // Walls: grey poché with a black edge — columns stay darker.
  const rings = wallsUnionOutlines(walls);
  if (rings.length > 0) {
    const d = rings.map((ring) => `M ${ring.map((p) => `${num(p.x)} ${num(p.y)}`).join(' L ')} Z`).join(' ');
    parts.push(`<path d="${d}" fill="${POCHE}" fill-rule="evenodd" stroke="${INK}" stroke-width="${PEN.wall}"/>`);
  }

  // Column markers.
  for (const j of wallJunctions(walls)) {
    parts.push(rect(j.p.x - j.size / 2, j.p.y - j.size / 2, j.size, j.size, INK));
  }
  for (const el of level?.elements ?? []) {
    if (el.type !== 'column' || el.visible === false) continue;
    const s = el.dimensions.width;
    parts.push(
      el.profile === 'round'
        ? circle(el.transform.position.x, el.transform.position.y, s / 2, INK, 0, INK)
        : rect(el.transform.position.x - s / 2, el.transform.position.y - s / 2, s, s, INK),
    );
  }

  // Openings: white gap then the symbol.
  for (const o of openings) {
    const host = walls.find((w) => w.id === o.wallId);
    if (!host) continue;
    const dir = norm(sub(host.end, host.start));
    const c = add(host.start, vscale(dir, o.offset));
    const deg = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
    const th = wallThickness(host);
    const w = o.dimensions.width;
    const gap = rect(-w / 2, -th / 2 - 0.012, w, th + 0.024, '#ffffff');
    const sym = o.type === 'door' ? doorSymbol(o, w, th) : windowSymbol(w, th);
    parts.push(`<g transform="translate(${num(c.x)} ${num(c.y)}) rotate(${num(deg)})">${gap}${sym}</g>`);
  }

  // Roof overhangs: dashed.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'roof' || el.visible === false) continue;
    const W = el.dimensions.width + 2 * el.overhang;
    const D = el.dimensions.depth + 2 * el.overhang;
    const deg = (el.transform.rotation * 180) / Math.PI;
    parts.push(
      `<g transform="translate(${num(el.transform.position.x)} ${num(el.transform.position.y)}) rotate(${num(deg)})">${rect(-W / 2, -D / 2, W, D, 'none', INK_SOFT, PEN.hair, ' stroke-dasharray="0.3 0.18"')}</g>`,
    );
  }

  // Room labels: name + width × depth, fitted to the room.
  for (const r of rooms) {
    if (r.boundary.length < 3 || r.visible === false) continue;
    const c = polygonCentroid(r.boundary);
    const rb = polygonBounds(r.boundary);
    const size = `${formatLength(rb.max.x - rb.min.x, unit)} × ${formatLength(rb.max.y - rb.min.y, unit)}`;
    const roomW = rb.max.x - rb.min.x;
    const name = r.name.toUpperCase();
    const nameSize = Math.min(0.32, Math.max(0.15, (roomW * 0.85) / (name.length * 0.66)));
    parts.push(
      text(c.x, c.y - 0.08, nameSize, name, { weight: 700 }),
      text(c.x, c.y + 0.3, Math.min(0.25, nameSize * 0.82), size, { fill: INK_MID }),
    );
  }

  // Notes.
  for (const el of level?.elements ?? []) {
    if (el.type !== 'note' || el.visible === false) continue;
    const t = el.transform;
    const size = el.dimensions.height;
    const tspans = el.text
      .split('\n')
      .map((ln, li) => `<tspan x="0" dy="${li === 0 ? 0 : num(size * 1.3)}">${esc(ln)}</tspan>`)
      .join('');
    parts.push(
      `<g transform="translate(${num(t.position.x)} ${num(t.position.y)}) rotate(${num((t.rotation * 180) / Math.PI)})"><text x="0" y="${num(-el.dimensions.depth / 2 + size)}" font-size="${num(size)}" text-anchor="middle" fill="${INK}" font-family="sans-serif">${tspans}</text></g>`,
    );
  }

  // Dimension chains.
  if (walls.length >= 2) {
    const wb = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
    for (const chain of chains) {
      chain.rows.forEach((row, i) => {
        const off = 0.55 + i * 0.55;
        const horizontal = chain.axis === 'x';
        const lineCoord =
          chain.side === 'top' ? wb.min.y - off
          : chain.side === 'bottom' ? wb.max.y + off
          : chain.side === 'left' ? wb.min.x - off
          : wb.max.x + off;
        parts.push(chainRow(row, horizontal, lineCoord, unit));
      });
    }
  }

  // North arrow + title block + scale bar.
  parts.push(northArrow(vb.x + vb.w - 1.35, vb.y + 1.35));

  // Enclosed area excludes unenclosed rooms (porches, terraces, gardens) —
  // the working-drawing convention of stating area "after cutouts".
  const OPEN_ROOM_TYPES = new Set(['parking', 'balcony', 'garden', 'boundary-wall']);
  const enclosedLevel = level
    ? { ...level, elements: level.elements.filter((e) => !isRoom(e) || !OPEN_ROOM_TYPES.has(e.roomType)) }
    : undefined;
  const metrics = enclosedLevel ? computeLevelMetrics(enclosedLevel) : undefined;
  const hasOpenRooms = rooms.some((r) => OPEN_ROOM_TYPES.has(r.roomType));
  const cx = vb.x + vb.w / 2;
  const ty = vb.y + vb.h - 2.2;
  const title = `${(level?.name ?? 'FLOOR').toUpperCase()} PLAN`;
  parts.push(
    text(cx, ty, 0.55, title, { weight: 700 }),
    line(cx - 3.4, ty + 0.22, cx + 3.4, ty + 0.22, INK, 0.045),
    line(cx - 3.4, ty + 0.3, cx + 3.4, ty + 0.3, INK, PEN.hair),
  );
  if (metrics) {
    const suffix = hasOpenRooms ? ' (EXCL. OPEN AREAS)' : '';
    parts.push(
      text(cx, ty + 0.76, 0.3, `${(level?.name ?? '').toUpperCase()} ENCLOSED AREA = ${formatArea(metrics.builtUpArea, unit)}${suffix}`),
    );
  }
  parts.push(scaleBar(cx, ty + 1.06, unit));
  parts.push(
    text(cx, ty + 1.72, 0.24, `${doc.name} · All dimensions to structural faces · Do not scale off this drawing`, { fill: INK_MID }),
  );

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${Math.round(vb.w * 55)}" height="${Math.round(vb.h * 55)}">
  ${rect(vb.x, vb.y, vb.w, vb.h, '#ffffff')}
  ${parts.join('\n')}
</svg>`;
}

// ============================================================== ELEVATION

type ElevDir = 'S' | 'N' | 'W' | 'E';

function facadeDirection(facade: Facade): ElevDir {
  const n = facade.name.toLowerCase();
  if (n.includes('rear') || n.includes('back') || n.includes('north')) return 'N';
  if (n.includes('left') || n.includes('west')) return 'W';
  if (n.includes('right') || n.includes('east')) return 'E';
  return 'S';
}

interface ProjectedOpening {
  o: OpeningElement;
  cx: number; // elevation-space center
  z0: number; // absolute base height
}

/**
 * Working elevation projected from the model: stacked level outlines, roof
 * silhouette, openings on the facing walls, ground line, level datums and
 * dimension chains. Falls back to the facade composition when the model has
 * no walls.
 */
export function elevationWorkingSVG(doc: DesignDocument, facadeId: string): string | null {
  const facade = doc.facades.find((f) => f.id === facadeId) ?? doc.facades[0];
  if (!facade) return null;
  const dir = facadeDirection(facade);
  const unit = doc.unitSystem;
  const horizontalAxis = dir === 'S' || dir === 'N';

  const levels = [...doc.levels].sort((a, b) => a.elevation - b.elevation);
  const allWalls = levels.flatMap((l) => l.elements.filter(isWall).filter((w) => w.visible !== false));
  if (allWalls.length < 2) return null; // caller falls back to the composed facade

  const gb = polygonBounds(allWalls.flatMap((w) => [w.start, w.end]));
  const project = (p: Point) => (horizontalAxis ? p.x : p.y);
  // Mirror so the viewer's left is correct for N and E views.
  const lo = horizontalAxis ? gb.min.x : gb.min.y;
  const hi = horizontalAxis ? gb.max.x : gb.max.y;
  const mirror = dir === 'N' || dir === 'E';
  const mapX = (v: number) => (mirror ? lo + hi - v : v);

  const parts: string[] = [];
  let topZ = 0;

  interface LevelBand { x0: number; x1: number; z0: number; z1: number; level: Level }
  const bands: LevelBand[] = [];
  for (const level of levels) {
    const walls = level.elements.filter(isWall).filter((w) => w.visible !== false);
    if (walls.length === 0) continue;
    // Centerline extents — consistent with the plan sheet's chains.
    const lb = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
    const x0 = mapX(horizontalAxis ? lb.min.x : lb.min.y);
    const x1 = mapX(horizontalAxis ? lb.max.x : lb.max.y);
    const h = level.height ?? 3;
    bands.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: level.elevation, z1: level.elevation + h, level });
    topZ = Math.max(topZ, level.elevation + h);
  }
  const wallTopZ = topZ;

  // Roof silhouettes (topmost profile).
  interface RoofShape { poly: Point[]; copingZ: number }
  const roofShapes: RoofShape[] = [];
  for (const level of levels) {
    for (const el of level.elements) {
      if (el.type !== 'roof' || el.visible === false) continue;
      const roof = el as RoofElement;
      const baseZ = level.elevation + (roof.transform.position.z || level.height || 3);
      const cx = horizontalAxis ? roof.transform.position.x : roof.transform.position.y;
      const halfW = (horizontalAxis ? roof.dimensions.width : roof.dimensions.depth) / 2 + roof.overhang;
      const x0 = Math.min(mapX(cx - halfW), mapX(cx + halfW));
      const x1 = Math.max(mapX(cx - halfW), mapX(cx + halfW));
      const thick = roof.dimensions.thickness ?? 0.15;
      if (roof.roofStyle === 'flat') {
        // slab edge + parapet
        roofShapes.push({
          poly: [
            { x: x0, y: -(baseZ) }, { x: x1, y: -(baseZ) },
            { x: x1, y: -(baseZ + thick) }, { x: x0, y: -(baseZ + thick) },
          ],
          copingZ: roof.parapetHeight > 0 ? baseZ + thick + roof.parapetHeight : baseZ + thick,
        });
        if (roof.parapetHeight > 0) {
          const pz = baseZ + thick + roof.parapetHeight;
          roofShapes.push({
            poly: [
              { x: x0, y: -(baseZ + thick) }, { x: x1, y: -(baseZ + thick) },
              { x: x1, y: -pz }, { x: x0, y: -pz },
            ],
            copingZ: pz,
          });
          topZ = Math.max(topZ, pz);
        } else topZ = Math.max(topZ, baseZ + thick);
      } else {
        const depthHalf = (horizontalAxis ? roof.dimensions.depth : roof.dimensions.width) / 2 + roof.overhang;
        const rise = Math.tan((roof.pitch * Math.PI) / 180) * depthHalf;
        const inset = roof.roofStyle === 'hip' ? Math.min(depthHalf, (x1 - x0) / 2 - 0.2) : (x1 - x0) * 0.06;
        if (roof.roofStyle === 'shed') {
          roofShapes.push({
            poly: [
              { x: x0, y: -baseZ }, { x: x1, y: -baseZ }, { x: x1, y: -(baseZ + rise) },
            ],
            copingZ: baseZ + rise,
          });
        } else {
          roofShapes.push({
            poly: [
              { x: x0, y: -baseZ }, { x: x1, y: -baseZ },
              { x: x1 - inset, y: -(baseZ + rise) }, { x: x0 + inset, y: -(baseZ + rise) },
            ],
            copingZ: baseZ + rise,
          });
        }
        topZ = Math.max(topZ, baseZ + rise);
      }
    }
  }

  // Facing openings per level.
  const projected: ProjectedOpening[] = [];
  for (const band of bands) {
    const walls = band.level.elements.filter(isWall).filter((w) => w.visible !== false);
    const openings = band.level.elements.filter(isOpening).filter((o) => o.visible !== false);
    const lb = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
    const edge =
      dir === 'S' ? lb.max.y : dir === 'N' ? lb.min.y : dir === 'W' ? lb.min.x : lb.max.x;
    for (const w of walls) {
      const d = norm(sub(w.end, w.start));
      const aligned = horizontalAxis ? Math.abs(d.y) < 0.05 : Math.abs(d.x) < 0.05;
      if (!aligned) continue;
      const at = horizontalAxis ? (w.start.y + w.end.y) / 2 : (w.start.x + w.end.x) / 2;
      if (Math.abs(at - edge) > 0.6) continue;
      for (const o of openings) {
        if (o.wallId !== w.id) continue;
        const c = add(w.start, vscale(d, o.offset));
        projected.push({ o, cx: mapX(project(c)), z0: band.level.elevation + o.sillHeight });
      }
    }
  }

  // ---- compose the sheet
  const x0 = Math.min(...bands.map((b) => b.x0), ...roofShapes.flatMap((r) => r.poly.map((p) => p.x)));
  const x1 = Math.max(...bands.map((b) => b.x1), ...roofShapes.flatMap((r) => r.poly.map((p) => p.x)));
  const mLeft = 3.2;
  const mRight = 5.4; // room for the level-datum labels
  const vb = { x: x0 - mLeft, y: -(topZ + 1.8), w: x1 - x0 + mLeft + mRight, h: topZ + 1.8 + 5.6 };

  // Sheet frame.
  parts.push(
    rect(vb.x + 0.15, vb.y + 0.15, vb.w - 0.3, vb.h - 0.3, 'none', INK, PEN.heavy),
    rect(vb.x + 0.26, vb.y + 0.26, vb.w - 0.52, vb.h - 0.52, 'none', INK, PEN.hair),
  );

  // Level bands (wall faces) — heavy outline, slab lines between floors.
  for (const band of bands) {
    parts.push(rect(band.x0, -band.z1, band.x1 - band.x0, band.z1 - band.z0, '#ffffff', INK, PEN.med));
  }
  // building outer profile drawn heavier
  const profX0 = Math.min(...bands.map((b) => b.x0));
  const profX1 = Math.max(...bands.map((b) => b.x1));
  parts.push(rect(profX0, -wallTopZ, profX1 - profX0, wallTopZ, 'none', INK, PEN.heavy));

  for (const band of bands) {
    if (band.z0 > 0) {
      // slab line at the underside of this level
      parts.push(line(band.x0, -band.z0, band.x1, -band.z0, INK, PEN.med));
      parts.push(line(band.x0, -(band.z0 - 0.12), band.x1, -(band.z0 - 0.12), INK, PEN.thin));
    }
  }

  // Roof silhouette.
  for (const r of roofShapes) {
    parts.push(`<polygon points="${pts(r.poly)}" fill="#ffffff" stroke="${INK}" stroke-width="${PEN.med}"/>`);
  }
  // coping / ridge line emphasized — only the vertices that actually sit at
  // the shape's top (a hip ridge is shorter than the eave line below it).
  if (roofShapes.length > 0) {
    const top = Math.max(...roofShapes.map((r) => r.copingZ));
    const tr = roofShapes.find((r) => r.copingZ === top);
    if (tr) {
      const xs = tr.poly.filter((p) => Math.abs(p.y + top) < 0.02).map((p) => p.x);
      if (xs.length >= 2) parts.push(line(Math.min(...xs), -top, Math.max(...xs), -top, INK, PEN.heavy));
    }
  }

  // Openings.
  for (const { o, cx, z0 } of projected) {
    const w = o.dimensions.width;
    const h = o.dimensions.height;
    const yTop = -(z0 + h);
    if (o.type === 'window') {
      // chajja above
      parts.push(rect(cx - w / 2 - 0.15, yTop - 0.1, w + 0.3, 0.1, '#ffffff', INK, PEN.thin));
      // frame + inner sash
      parts.push(rect(cx - w / 2, yTop, w, h, '#ffffff', INK, PEN.med));
      parts.push(rect(cx - w / 2 + 0.05, yTop + 0.05, w - 0.1, h - 0.1, 'none', INK, PEN.thin));
      const mull = o.mullions ?? 0;
      for (let i = 1; i <= mull; i++) {
        parts.push(line(cx - w / 2 + (w * i) / (mull + 1), yTop + 0.05, cx - w / 2 + (w * i) / (mull + 1), yTop + h - 0.05, INK, PEN.thin));
      }
      parts.push(line(cx - w / 2 + 0.05, yTop + h * 0.5, cx + w / 2 - 0.05, yTop + h * 0.5, INK, PEN.thin));
      // glazing diagonals
      parts.push(line(cx - w / 2 + 0.08, yTop + 0.08, cx + w / 2 - 0.08, yTop + h - 0.08, INK_SOFT, PEN.hair));
      // sill
      parts.push(rect(cx - w / 2 - 0.08, -(z0 + 0.05), w + 0.16, 0.05, '#ffffff', INK, PEN.thin));
    } else {
      parts.push(rect(cx - w / 2 - 0.15, yTop - 0.1, w + 0.3, 0.1, '#ffffff', INK, PEN.thin));
      parts.push(rect(cx - w / 2, yTop, w, h, '#ffffff', INK, PEN.med));
      if (o.style === 'double' || o.style === 'sliding') {
        parts.push(line(cx, yTop + 0.05, cx, -z0 - 0.02, INK, PEN.thin));
        parts.push(rect(cx - w / 2 + 0.07, yTop + 0.07, w / 2 - 0.12, h - 0.14, 'none', INK, PEN.thin));
        parts.push(rect(cx + 0.05, yTop + 0.07, w / 2 - 0.12, h - 0.14, 'none', INK, PEN.thin));
      } else {
        parts.push(rect(cx - w / 2 + 0.07, yTop + 0.07, w - 0.14, h - 0.14, 'none', INK, PEN.thin));
        parts.push(rect(cx - w / 2 + 0.12, yTop + 0.14, w - 0.24, (h - 0.28) * 0.45, 'none', INK, PEN.hair));
        parts.push(rect(cx - w / 2 + 0.12, yTop + 0.2 + (h - 0.28) * 0.45, w - 0.24, (h - 0.34) * 0.5, 'none', INK, PEN.hair));
      }
      parts.push(circle(cx + (o.style === 'single' ? w / 2 - 0.16 : 0.12), yTop + h * 0.52, 0.025, INK, PEN.thin, INK));
    }
  }

  // Ground line + earth hatch.
  const gx0 = vb.x + 0.6;
  const gx1 = vb.x + vb.w - 0.6;
  parts.push(line(gx0, 0, gx1, 0, INK, PEN.heavy));
  for (let x = gx0 + 0.12; x < gx1; x += 0.26) {
    parts.push(line(x, 0.02, x - 0.16, 0.2, INK_MID, PEN.hair));
  }

  // Level datums on the right.
  const dx = profX1 + 1.15;
  const datum = (z: number, label: string) => {
    parts.push(line(profX1, -z, dx + 0.4, -z, INK_SOFT, PEN.hair, ' stroke-dasharray="0.14 0.1"'));
    parts.push(`<polygon points="${num(dx)},${num(-z)} ${num(dx - 0.09)},${num(-z - 0.14)} ${num(dx + 0.09)},${num(-z - 0.14)}" fill="none" stroke="${INK}" stroke-width="${PEN.thin}"/>`);
    const lvl = z === 0 ? `±0` : `+${formatLength(z, unit)}`;
    parts.push(text(dx + 0.5, -z - 0.18, 0.22, `${label} ${lvl}`, { anchor: 'start', weight: 600 }));
  };
  datum(0, 'GL');
  for (const band of bands) {
    if (band.z0 > 0) datum(band.z0, 'FFL');
  }
  datum(wallTopZ, 'ROOF LVL');
  if (topZ > wallTopZ + 0.05) datum(topZ, 'PARAPET');

  // Dimension chains: heights on the left, widths below.
  const heightStations = [...new Set([0, ...bands.map((b) => b.z1), topZ].map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b);
  parts.push(chainRow(heightStations.map((z) => -z).sort((a, b) => a - b), false, profX0 - 0.85, unit));
  const jambs: number[] = [profX0, profX1];
  for (const { o, cx } of projected) {
    const w = o.dimensions.width;
    for (const v of [cx - w / 2, cx + w / 2]) if (!jambs.some((s) => Math.abs(s - v) < 0.03)) jambs.push(v);
  }
  jambs.sort((a, b) => a - b);
  if (jambs.length > 2) parts.push(chainRow(jambs, true, 1.15, unit));
  parts.push(chainRow([profX0, profX1], true, jambs.length > 2 ? 1.7 : 1.15, unit));

  // Title block.
  const cx2 = vb.x + vb.w / 2;
  const ty = vb.y + vb.h - 1.6;
  parts.push(
    text(cx2, ty, 0.52, facade.name.toUpperCase(), { weight: 700 }),
    line(cx2 - 2.9, ty + 0.2, cx2 + 2.9, ty + 0.2, INK, 0.045),
    line(cx2 - 2.9, ty + 0.28, cx2 + 2.9, ty + 0.28, INK, PEN.hair),
    text(cx2, ty + 0.72, 0.24, `${doc.name} · Levels related to GL ±0 · Do not scale off this drawing`, { fill: INK_MID }),
  );
  parts.push(scaleBar(cx2, ty + 1.0, unit));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${num(vb.x)} ${num(vb.y)} ${num(vb.w)} ${num(vb.h)}" width="${Math.round(vb.w * 55)}" height="${Math.round(vb.h * 55)}">
  ${rect(vb.x, vb.y, vb.w, vb.h, '#ffffff')}
  ${parts.join('\n')}
</svg>`;
}
