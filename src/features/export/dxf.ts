import polygonClipping from 'polygon-clipping';
import type { DesignDocument, Level, Point } from '../../types';
import { isFurniture, isOpening, isRoom, isWall } from '../../types';
import { dimensionChains } from '../../geometry/dimchains';
import { polygonBounds, polygonCentroid } from '../../geometry/polygon';
import { add, norm, scale as vscale, sub } from '../../geometry/vec';
import { wallThickness, wallsUnionOutlines } from '../../geometry/walls';
import { catalogItemById } from '../../library/catalog';
import { symbolBlock, type SymbolPrim } from '../../library/symbolBlocks';
import { solveStairElement } from '../../engine/stair';
import { stairPlanBlock } from '../../engine/stairPlan';
import { buildOpeningTags, formatConstructionLength } from './schedules';

/**
 * DXF (R12) floor-plan export — the drawing opens directly in AutoCAD,
 * BricsCAD, LibreCAD, QCAD, etc.
 *
 * - $INSUNITS = 4: coordinates are millimeters.
 * - Model geometry, not a screenshot: walls are boolean-cut at every
 *   opening, symbols are flattened from the same parametric blocks the
 *   canvas uses, dimensions re-derive from the dimension-chain engine.
 * - Proper layer set (WALLS / DOORS / WINDOWS / STAIR / FURNITURE / DIMS /
 *   TEXT / PLOT) with ByLayer colors, so line hierarchy survives the import.
 */

const MM = 1000;

interface DxfSink {
  lines: { a: Point; b: Point; layer: string }[];
  circles: { c: Point; r: number; layer: string }[];
  arcs: { c: Point; r: number; a0: number; a1: number; layer: string }[];
  texts: { p: Point; h: number; s: string; layer: string; center?: boolean }[];
}

const LAYERS: [name: string, color: number, ltype: string][] = [
  ['PLOT', 8, 'DASHED'],
  ['WALLS', 7, 'CONTINUOUS'],
  ['COLUMNS', 7, 'CONTINUOUS'],
  ['DOORS', 2, 'CONTINUOUS'],
  ['WINDOWS', 4, 'CONTINUOUS'],
  ['STAIR', 3, 'CONTINUOUS'],
  ['FURNITURE', 8, 'CONTINUOUS'],
  ['DIMS', 1, 'CONTINUOUS'],
  ['TEXT', 7, 'CONTINUOUS'],
];

/* ---------------------------------------------------- path flattening */

/**
 * Flatten the path grammar emitted by symbolBlocks/stairPlan (absolute
 * M/L/C/Q, relative h/v/a with circular corner arcs, Z) into polylines.
 */
export function flattenPathData(d: string): Point[][] {
  const tokens = d.match(/[MLCQZhva]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: Point[][] = [];
  let poly: Point[] = [];
  let cur: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let i = 0;
  const num = () => parseFloat(tokens[i++] as string);
  const push = (p: Point) => {
    cur = p;
    poly.push(p);
  };
  const bez = (p1: Point, p2: Point, p3: Point, quad: boolean) => {
    const p0 = cur;
    for (let t = 1; t <= 8; t++) {
      const u = t / 8;
      const v = 1 - u;
      const p = quad
        ? {
            x: v * v * p0.x + 2 * v * u * p1.x + u * u * p2.x,
            y: v * v * p0.y + 2 * v * u * p1.y + u * u * p2.y,
          }
        : {
            x: v ** 3 * p0.x + 3 * v * v * u * p1.x + 3 * v * u * u * p2.x + u ** 3 * p3.x,
            y: v ** 3 * p0.y + 3 * v * v * u * p1.y + 3 * v * u * u * p2.y + u ** 3 * p3.y,
          };
      push(p);
    }
  };
  while (i < tokens.length) {
    const t = tokens[i++];
    switch (t) {
      case 'M': {
        if (poly.length > 1) out.push(poly);
        cur = { x: num(), y: num() };
        start = cur;
        poly = [cur];
        break;
      }
      case 'L':
        push({ x: num(), y: num() });
        break;
      case 'h':
        push({ x: cur.x + num(), y: cur.y });
        break;
      case 'v':
        push({ x: cur.x, y: cur.y + num() });
        break;
      case 'C': {
        const p1 = { x: num(), y: num() };
        const p2 = { x: num(), y: num() };
        const p3 = { x: num(), y: num() };
        bez(p1, p2, p3, false);
        break;
      }
      case 'Q': {
        const p1 = { x: num(), y: num() };
        const p2 = { x: num(), y: num() };
        bez(p1, p2, p2, true);
        break;
      }
      case 'a': {
        // circular corner arc as emitted by rr(): rx == ry, flags 0 0 1
        const r = num();
        num(); // ry
        num(); // rot
        num(); // large-arc
        const sweep = num();
        const end = { x: cur.x + num(), y: cur.y + num() };
        // find the center: perpendicular from the chord at distance h
        const mx = (cur.x + end.x) / 2;
        const my = (cur.y + end.y) / 2;
        const dx = end.x - cur.x;
        const dy = end.y - cur.y;
        const q = Math.hypot(dx, dy);
        const h2 = Math.max(0, r * r - (q / 2) ** 2);
        const h = Math.sqrt(h2);
        const sgn = sweep === 1 ? 1 : -1;
        const cxc = mx - (sgn * h * dy) / q;
        const cyc = my + (sgn * h * dx) / q;
        const a0 = Math.atan2(cur.y - cyc, cur.x - cxc);
        let a1 = Math.atan2(end.y - cyc, end.x - cxc);
        if (sweep === 1 && a1 < a0) a1 += Math.PI * 2;
        if (sweep === 0 && a1 > a0) a1 -= Math.PI * 2;
        for (let s = 1; s <= 4; s++) {
          const a = a0 + ((a1 - a0) * s) / 4;
          push({ x: cxc + r * Math.cos(a), y: cyc + r * Math.sin(a) });
        }
        break;
      }
      case 'Z':
      case 'z':
        push(start);
        break;
      default:
        break; // stray number — malformed, skip
    }
  }
  if (poly.length > 1) out.push(poly);
  return out;
}

/* ------------------------------------------------------- emit helpers */

function xform(p: Point, at: Point, rot: number): Point {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return { x: at.x + p.x * c - p.y * s, y: at.y + p.x * s + p.y * c };
}

function emitPolyline(sink: DxfSink, pts: Point[], layer: string): void {
  for (let i = 0; i < pts.length - 1; i++) sink.lines.push({ a: pts[i], b: pts[i + 1], layer });
}

function emitPrims(sink: DxfSink, prims: SymbolPrim[], at: Point, rot: number, layer: string): void {
  for (const p of prims) {
    if (p.k === 'circle') {
      sink.circles.push({ c: xform({ x: p.x, y: p.y }, at, rot), r: p.r, layer });
    } else if (p.k === 'ellipse') {
      const pts: Point[] = [];
      for (let s = 0; s <= 16; s++) {
        const a = (s / 16) * Math.PI * 2;
        pts.push(xform({ x: p.x + p.rx * Math.cos(a), y: p.y + p.ry * Math.sin(a) }, at, rot));
      }
      emitPolyline(sink, pts, layer);
    } else {
      for (const line of flattenPathData(p.d)) {
        emitPolyline(sink, line.map((q) => xform(q, at, rot)), layer);
      }
    }
  }
}

/* -------------------------------------------------------------- build */

function buildSink(doc: DesignDocument, level: Level): DxfSink {
  const sink: DxfSink = { lines: [], circles: [], arcs: [], texts: [] };
  const unit = doc.unitSystem;
  const walls = level.elements.filter(isWall).filter((w) => w.visible !== false);
  const openings = level.elements.filter(isOpening).filter((o) => o.visible !== false);
  const rooms = level.elements.filter(isRoom).filter((r) => r.visible !== false);
  const tags = buildOpeningTags(doc).byId;

  // plot
  if (doc.plot.boundary.length >= 3) {
    emitPolyline(sink, [...doc.plot.boundary, doc.plot.boundary[0]], 'PLOT');
  }

  // walls, boolean-cut at every opening
  const rings = wallsUnionOutlines(walls);
  if (rings.length > 0) {
    let solid: polygonClipping.MultiPolygon = rings.map((r) => [r.map((p) => [p.x, p.y] as [number, number])]);
    for (const o of openings) {
      const host = walls.find((w) => w.id === o.wallId);
      if (!host) continue;
      const dir = norm(sub(host.end, host.start));
      const c = add(host.start, vscale(dir, o.offset));
      const th = wallThickness(host) / 2 + 0.02;
      const hw = o.dimensions.width / 2;
      const perp = { x: -dir.y, y: dir.x };
      const quad: [number, number][] = [
        [c.x - dir.x * hw - perp.x * th, c.y - dir.y * hw - perp.y * th],
        [c.x + dir.x * hw - perp.x * th, c.y + dir.y * hw - perp.y * th],
        [c.x + dir.x * hw + perp.x * th, c.y + dir.y * hw + perp.y * th],
        [c.x - dir.x * hw + perp.x * th, c.y - dir.y * hw + perp.y * th],
      ];
      solid = polygonClipping.difference(solid, [[quad]]);
    }
    for (const poly of solid) {
      for (const ring of poly) {
        const pts = ring.map(([x, y]) => ({ x, y }));
        if (pts.length >= 2) emitPolyline(sink, [...pts, pts[0]], 'WALLS');
      }
    }
  }

  // openings: jambs + symbols + mark text
  const centroid = walls.length ? polygonCentroid(walls.flatMap((w) => [w.start, w.end])) : { x: 0, y: 0 };
  for (const o of openings) {
    const host = walls.find((w) => w.id === o.wallId);
    if (!host) continue;
    const dir = norm(sub(host.end, host.start));
    const rot = Math.atan2(dir.y, dir.x);
    const c = add(host.start, vscale(dir, o.offset));
    const th = wallThickness(host);
    const w = o.dimensions.width;
    const layer = o.type === 'door' ? 'DOORS' : 'WINDOWS';
    const L = (x1: number, y1: number, x2: number, y2: number) =>
      sink.lines.push({ a: xform({ x: x1, y: y1 }, c, rot), b: xform({ x: x2, y: y2 }, c, rot), layer });
    // jambs
    L(-w / 2, -th / 2, -w / 2, th / 2);
    L(w / 2, -th / 2, w / 2, th / 2);
    if (o.type === 'window') {
      L(-w / 2, -0.025, w / 2, -0.025);
      L(-w / 2, 0, w / 2, 0);
      L(-w / 2, 0.025, w / 2, 0.025);
    } else if (o.style === 'sliding') {
      L(-w / 2, -th / 6, 0.06, -th / 6);
      L(-0.06, th / 6, w / 2, th / 6);
    } else if (o.style === 'folding') {
      const s = o.swing ?? 1;
      const q = w / 4;
      const rise = -s * w * 0.2;
      L(-w / 2, 0, -q, rise);
      L(-q, rise, 0, 0);
      L(0, 0, q, rise);
      L(q, rise, w / 2, 0);
    } else if (o.style === 'double') {
      const s = o.swing ?? 1;
      const h = w / 2;
      L(-w / 2, 0, -w / 2, -s * h);
      L(w / 2, 0, w / 2, -s * h);
      fixArc(sink, -w / 2, 0, h, s, rot, c, false);
      fixArc(sink, w / 2, 0, h, s, rot, c, true);
    } else {
      const s = o.swing ?? 1;
      L(-w / 2, 0, -w / 2, -s * w);
      fixArc(sink, -w / 2, 0, w, s, rot, c, false);
    }
    const tag = tags.get(o.id);
    if (tag) {
      const perp = { x: -dir.y, y: dir.x };
      const side = perp.x * (c.x - centroid.x) + perp.y * (c.y - centroid.y) >= 0 ? -1 : 1;
      const bp = { x: c.x + perp.x * side * (th / 2 + 0.34), y: c.y + perp.y * side * (th / 2 + 0.34) };
      sink.circles.push({ c: bp, r: 0.19, layer: 'TEXT' });
      sink.texts.push({ p: { x: bp.x, y: bp.y - 0.07 }, h: 0.15, s: tag, layer: 'TEXT', center: true });
    }
  }

  // stairs from the shared plan block
  for (const el of level.elements) {
    if (el.type !== 'staircase' || el.visible === false) continue;
    const sol = solveStairElement(el, level.height ?? el.dimensions.height);
    emitPrims(
      sink,
      stairPlanBlock(el.dimensions.width, el.dimensions.depth, sol),
      { x: el.transform.position.x, y: el.transform.position.y },
      el.transform.rotation,
      'STAIR',
    );
  }

  // columns
  for (const el of level.elements) {
    if (el.type !== 'column' || el.visible === false) continue;
    const s = el.dimensions.width / 2;
    const at = { x: el.transform.position.x, y: el.transform.position.y };
    if (el.profile === 'round') sink.circles.push({ c: at, r: s, layer: 'COLUMNS' });
    else {
      emitPolyline(
        sink,
        [
          { x: at.x - s, y: at.y - s },
          { x: at.x + s, y: at.y - s },
          { x: at.x + s, y: at.y + s },
          { x: at.x - s, y: at.y + s },
          { x: at.x - s, y: at.y - s },
        ],
        'COLUMNS',
      );
    }
  }

  // furniture blocks
  for (const f of level.elements.filter(isFurniture)) {
    if (f.visible === false) continue;
    emitPrims(
      sink,
      symbolBlock(catalogItemById(f.catalogId)?.symbol, f.dimensions.width, f.dimensions.depth),
      { x: f.transform.position.x, y: f.transform.position.y },
      f.transform.rotation,
      'FURNITURE',
    );
  }

  // room labels
  for (const r of rooms) {
    if (r.boundary.length < 3) continue;
    const c = polygonCentroid(r.boundary);
    const b = polygonBounds(r.boundary);
    sink.texts.push({ p: { x: c.x, y: c.y - 0.06 }, h: 0.25, s: r.name.toUpperCase(), layer: 'TEXT', center: true });
    sink.texts.push({
      p: { x: c.x, y: c.y + 0.3 },
      h: 0.18,
      s: `${formatConstructionLength(b.max.x - b.min.x, unit)} x ${formatConstructionLength(b.max.y - b.min.y, unit)}`,
      layer: 'TEXT',
      center: true,
    });
  }

  // dimension chains
  if (walls.length >= 2) {
    const wb = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
    for (const chain of dimensionChains(walls, openings)) {
      chain.rows.forEach((row, i) => {
        const off = 0.55 + i * 0.55;
        const horizontal = chain.axis === 'x';
        const lc =
          chain.side === 'top' ? wb.min.y - off
          : chain.side === 'bottom' ? wb.max.y + off
          : chain.side === 'left' ? wb.min.x - off
          : wb.max.x + off;
        const pt = (v: number): Point => (horizontal ? { x: v, y: lc } : { x: lc, y: v });
        sink.lines.push({ a: pt(row[0]), b: pt(row[row.length - 1]), layer: 'DIMS' });
        for (const s of row) {
          const p = pt(s);
          sink.lines.push({ a: { x: p.x - 0.07, y: p.y + 0.07 }, b: { x: p.x + 0.07, y: p.y - 0.07 }, layer: 'DIMS' });
        }
        for (let k = 0; k < row.length - 1; k++) {
          const span = row[k + 1] - row[k];
          if (span < 0.12) continue;
          const mid = (row[k] + row[k + 1]) / 2;
          const p = pt(mid);
          sink.texts.push({
            p: horizontal ? { x: p.x, y: p.y - 0.09 } : { x: p.x - 0.09, y: p.y },
            h: 0.2,
            s: formatConstructionLength(span, unit),
            layer: 'DIMS',
            center: true,
          });
        }
      });
    }
  }

  return sink;
}

/** Swing arc for hinged leaves (quarter circle from the leaf to the jamb). */
function fixArc(
  sink: DxfSink,
  hx: number,
  hy: number,
  r: number,
  s: number,
  rot: number,
  at: Point,
  mirrored: boolean,
): void {
  const c = xform({ x: hx, y: hy }, at, rot);
  // local angles: closed leaf points toward the opposite jamb (0° for the
  // left hinge, 180° for the right); open leaf points across the wall.
  const closed = mirrored ? Math.PI : 0;
  const open = s === 1 ? -Math.PI / 2 : Math.PI / 2;
  let a0 = closed + rot;
  let a1 = open + rot;
  if (s === 1 !== mirrored) [a0, a1] = [a1, a0];
  const deg = (v: number) => ((v * 180) / Math.PI) * -1; // plan-y down → DXF y up
  sink.arcs.push({ c, r, a0: deg(a1), a1: deg(a0), layer: 'DOORS' });
}

/* ------------------------------------------------------------ serialize */

function dxfString(sink: DxfSink): string {
  const o: string[] = [];
  const g = (code: number, value: string | number) => o.push(String(code), String(value));

  g(0, 'SECTION');
  g(2, 'HEADER');
  g(9, '$INSUNITS');
  g(70, 4); // millimeters
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'TABLES');
  g(0, 'TABLE');
  g(2, 'LTYPE');
  g(70, 2);
  g(0, 'LTYPE');
  g(2, 'CONTINUOUS');
  g(70, 64);
  g(3, 'Solid line');
  g(72, 65);
  g(73, 0);
  g(40, 0);
  g(0, 'LTYPE');
  g(2, 'DASHED');
  g(70, 64);
  g(3, 'Dashed line');
  g(72, 65);
  g(73, 2);
  g(40, 250);
  g(49, 125);
  g(49, -125);
  g(0, 'ENDTAB');
  g(0, 'TABLE');
  g(2, 'LAYER');
  g(70, LAYERS.length);
  for (const [name, color, ltype] of LAYERS) {
    g(0, 'LAYER');
    g(2, name);
    g(70, 0);
    g(62, color);
    g(6, ltype);
  }
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');

  g(0, 'SECTION');
  g(2, 'ENTITIES');
  const mm = (v: number) => Math.round(v * MM * 100) / 100;
  const Y = (v: number) => -v; // plan y-down → DXF y-up
  for (const l of sink.lines) {
    g(0, 'LINE');
    g(8, l.layer);
    g(10, mm(l.a.x));
    g(20, mm(Y(l.a.y)));
    g(11, mm(l.b.x));
    g(21, mm(Y(l.b.y)));
  }
  for (const c of sink.circles) {
    g(0, 'CIRCLE');
    g(8, c.layer);
    g(10, mm(c.c.x));
    g(20, mm(Y(c.c.y)));
    g(40, mm(c.r));
  }
  for (const a of sink.arcs) {
    g(0, 'ARC');
    g(8, a.layer);
    g(10, mm(a.c.x));
    g(20, mm(Y(a.c.y)));
    g(40, mm(a.r));
    g(50, a.a0);
    g(51, a.a1);
  }
  for (const t of sink.texts) {
    g(0, 'TEXT');
    g(8, t.layer);
    g(10, mm(t.p.x));
    g(20, mm(Y(t.p.y)));
    g(40, mm(t.h));
    g(1, t.s);
    if (t.center) {
      g(72, 1);
      g(11, mm(t.p.x));
      g(21, mm(Y(t.p.y)));
    }
  }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return o.join('\r\n');
}

/** DXF of one level's floor plan. */
export function planDXF(doc: DesignDocument, levelId: string): string {
  const level = doc.levels.find((l) => l.id === levelId) ?? doc.levels[0];
  if (!level) return dxfString({ lines: [], circles: [], arcs: [], texts: [] });
  return dxfString(buildSink(doc, level));
}
