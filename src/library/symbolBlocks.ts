import type { Symbol2D } from './catalog';

/**
 * CAD-style 2D furniture blocks, defined ONCE as vector primitives and
 * rendered by both the plan canvas (Konva) and the SVG exports — so what you
 * place is exactly what prints.
 *
 * Local space: centered at the origin in a w × d meter box, +y toward the
 * item's front. All values are meters; strokes are resolved by the renderer
 * ('thick' ≈ object line, default ≈ detail line).
 */

export type SymbolFill = 'body' | 'ink' | null;

export type SymbolPrim =
  | { k: 'path'; d: string; thick?: boolean; fill?: SymbolFill; dash?: boolean }
  | { k: 'circle'; x: number; y: number; r: number; thick?: boolean; fill?: SymbolFill }
  | { k: 'ellipse'; x: number; y: number; rx: number; ry: number; thick?: boolean; fill?: SymbolFill };

const n = (v: number) => Math.round(v * 1000) / 1000;

/** Rounded-rectangle path (x,y = top-left). */
function rr(x: number, y: number, w: number, h: number, r = 0): string {
  if (r <= 0.001) return `M ${n(x)} ${n(y)} h ${n(w)} v ${n(h)} h ${n(-w)} Z`;
  const rx = Math.min(r, w / 2, h / 2);
  return (
    `M ${n(x + rx)} ${n(y)} h ${n(w - 2 * rx)} a ${n(rx)} ${n(rx)} 0 0 1 ${n(rx)} ${n(rx)}` +
    ` v ${n(h - 2 * rx)} a ${n(rx)} ${n(rx)} 0 0 1 ${n(-rx)} ${n(rx)} h ${n(-(w - 2 * rx))}` +
    ` a ${n(rx)} ${n(rx)} 0 0 1 ${n(-rx)} ${n(-rx)} v ${n(-(h - 2 * rx))}` +
    ` a ${n(rx)} ${n(rx)} 0 0 1 ${n(rx)} ${n(-rx)} Z`
  );
}

const ln = (...pts: number[]): string => {
  let d = `M ${n(pts[0])} ${n(pts[1])}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L ${n(pts[i])} ${n(pts[i + 1])}`;
  return d;
};

const path = (d: string, o: Partial<Extract<SymbolPrim, { k: 'path' }>> = {}): SymbolPrim => ({ k: 'path', d, ...o });
const circ = (x: number, y: number, r: number, o: Partial<Extract<SymbolPrim, { k: 'circle' }>> = {}): SymbolPrim => ({ k: 'circle', x, y, r, ...o });
const ell = (x: number, y: number, rx: number, ry: number, o: Partial<Extract<SymbolPrim, { k: 'ellipse' }>> = {}): SymbolPrim => ({ k: 'ellipse', x, y, rx, ry, ...o });

/* ------------------------------------------------------------------ */

function bed(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [];
  p.push(path(rr(-hw, -hd, w, d, 0.05), { thick: true, fill: 'body' }));
  // headboard
  p.push(path(rr(-hw + 0.015, -hd + 0.015, w - 0.03, 0.09, 0.02)));
  // pillows (slightly angled inner corners via rounded rects)
  const pw = w > 1.25 ? w * 0.4 : w * 0.72;
  p.push(path(rr(-hw + (w > 1.25 ? w * 0.055 : (w - pw) / 2), -hd + 0.14, pw, 0.34, 0.1)));
  if (w > 1.25) p.push(path(rr(hw - w * 0.055 - pw, -hd + 0.14, pw, 0.34, 0.1)));
  // duvet with a turned-back corner
  const dy = -hd + 0.58;
  const fold = Math.min(0.5, w * 0.32);
  p.push(
    path(
      `M ${n(-hw + 0.03)} ${n(dy)} L ${n(hw - fold)} ${n(dy)} L ${n(hw - 0.03)} ${n(dy + fold)}` +
        ` L ${n(hw - 0.03)} ${n(hd - 0.06)} Q ${n(hw - 0.03)} ${n(hd - 0.03)} ${n(hw - 0.09)} ${n(hd - 0.03)}` +
        ` L ${n(-hw + 0.09)} ${n(hd - 0.03)} Q ${n(-hw + 0.03)} ${n(hd - 0.03)} ${n(-hw + 0.03)} ${n(hd - 0.09)} Z`,
    ),
  );
  p.push(path(`M ${n(hw - fold)} ${n(dy)} Q ${n(hw - fold * 0.25)} ${n(dy + fold * 0.28)} ${n(hw - 0.03)} ${n(dy + fold)}`));
  return p;
}

function chair(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    // backrest crescent
    path(
      `M ${n(-hw + 0.02)} ${n(-hd + d * 0.3)} Q ${n(-hw)} ${n(-hd + 0.015)} ${n(-hw * 0.55)} ${n(-hd + 0.01)}` +
        ` L ${n(hw * 0.55)} ${n(-hd + 0.01)} Q ${n(hw)} ${n(-hd + 0.015)} ${n(hw - 0.02)} ${n(-hd + d * 0.3)}` +
        ` L ${n(hw - 0.06)} ${n(-hd + d * 0.3)} Q ${n(hw - 0.05)} ${n(-hd + 0.06)} ${n(hw * 0.5)} ${n(-hd + 0.055)}` +
        ` L ${n(-hw * 0.5)} ${n(-hd + 0.055)} Q ${n(-hw + 0.05)} ${n(-hd + 0.06)} ${n(-hw + 0.06)} ${n(-hd + d * 0.3)} Z`,
      { thick: true, fill: 'body' },
    ),
    path(rr(-hw + 0.03, -hd + d * 0.22, w - 0.06, d * 0.74, 0.08), { fill: 'body' }),
  ];
}

function sofa(w: number, d: number, seats: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const arm = Math.min(0.17, w * 0.12);
  const back = 0.17;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d, 0.07), { thick: true, fill: 'body' })];
  // back band + arms
  p.push(path(rr(-hw + 0.02, -hd + 0.02, w - 0.04, back, 0.06)));
  p.push(path(rr(-hw + 0.02, -hd + 0.05, arm, d - 0.09, 0.07)));
  p.push(path(rr(hw - 0.02 - arm, -hd + 0.05, arm, d - 0.09, 0.07)));
  // seat cushions
  const cx0 = -hw + arm + 0.04;
  const cw = (w - 2 * arm - 0.08 - (seats - 1) * 0.02) / seats;
  for (let i = 0; i < seats; i++) {
    p.push(path(rr(cx0 + i * (cw + 0.02), -hd + back + 0.04, cw, d - back - 0.1, 0.06)));
  }
  return p;
}

function armchair(w: number, d: number): SymbolPrim[] {
  return sofa(w, d, 1);
}

function sofaL(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const run = 0.9;
  const p: SymbolPrim[] = [
    path(
      ln(-hw, -hd, hw, -hd, hw, -hd + run, -hw + run, -hd + run, -hw + run, hd, -hw, hd) + ' Z',
      { thick: true, fill: 'body' },
    ),
    // back bands along both outer edges
    path(rr(-hw + 0.02, -hd + 0.02, w - 0.04, 0.15, 0.05)),
    path(rr(-hw + 0.02, -hd + 0.17, 0.15, d - 0.19, 0.05)),
  ];
  // cushions along the top run and the left leg
  const nTop = Math.max(2, Math.round((w - run) / 0.65));
  const cw = (w - 0.2 - 0.17 - (nTop - 1) * 0.02) / nTop;
  for (let i = 0; i < nTop; i++) {
    p.push(path(rr(-hw + 0.19 + i * (cw + 0.02), -hd + 0.19, cw, run - 0.25, 0.05)));
  }
  const nLeft = Math.max(1, Math.round((d - run) / 0.65));
  const ch = (d - run - 0.08 - (nLeft - 1) * 0.02) / nLeft;
  for (let i = 0; i < nLeft; i++) {
    p.push(path(rr(-hw + 0.19, -hd + run + 0.02 + i * (ch + 0.02), run - 0.25, ch, 0.05)));
  }
  return p;
}

function tableRect(w: number, d: number): SymbolPrim[] {
  return [
    path(rr(-w / 2, -d / 2, w, d, 0.04), { thick: true, fill: 'body' }),
    path(rr(-w / 2 + 0.045, -d / 2 + 0.045, w - 0.09, d - 0.09, 0.02)),
  ];
}

function tableRound(w: number): SymbolPrim[] {
  return [
    circ(0, 0, w / 2, { thick: true, fill: 'body' }),
    circ(0, 0, w / 2 - 0.05),
  ];
}

function wardrobe(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [
    path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' }),
    // hanging rail with hangers — the pro convention
    path(ln(-hw + 0.06, 0, hw - 0.06, 0)),
  ];
  const hangers = Math.max(3, Math.floor(w / 0.14));
  for (let i = 0; i < hangers; i++) {
    const x = -hw + 0.12 + ((w - 0.24) * i) / (hangers - 1);
    p.push(path(ln(x, -hd * 0.62, x, hd * 0.62)));
  }
  return p;
}

function dresser(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' }),
    path(ln(-hw + 0.03, hd - 0.1, hw - 0.03, hd - 0.1)),
    circ(-w * 0.18, hd - 0.05, 0.012, { fill: 'ink' }),
    circ(w * 0.18, hd - 0.05, 0.012, { fill: 'ink' }),
  ];
}

function tvUnit(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, 0.02), { thick: true, fill: 'body' }),
    // screen — a heavy bar with a stand tick
    path(rr(-hw + 0.12, hd - 0.075, w - 0.24, 0.045), { fill: 'ink' }),
    path(ln(0, hd - 0.075, 0, hd - 0.13)),
  ];
}

function bookshelf(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' })];
  const bays = Math.max(2, Math.round(w / 0.42));
  for (let i = 1; i < bays; i++) p.push(path(ln(-hw + (w * i) / bays, -hd, -hw + (w * i) / bays, hd)));
  // book spines
  for (let i = 0; i < bays; i++) {
    const x0 = -hw + (w * i) / bays;
    for (let s = 1; s <= 3; s++) {
      p.push(path(ln(x0 + (w / bays) * (s / 4), -hd + 0.03, x0 + (w / bays) * (s / 4) + 0.02, hd - 0.03)));
    }
  }
  return p;
}

function counter(w: number, d: number): SymbolPrim[] {
  return [
    path(rr(-w / 2, -d / 2, w, d), { thick: true, fill: 'body' }),
    path(ln(-w / 2 + 0.03, -d / 2 + 0.05, w / 2 - 0.03, -d / 2 + 0.05)),
  ];
}

function sink(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const bw = (w - 0.16) / 2;
  return [
    path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' }),
    path(rr(-hw + 0.05, -hd + 0.1, bw, d - 0.2, 0.05)),
    path(rr(0.03, -hd + 0.1, bw, d - 0.2, 0.05)),
    circ(-hw + 0.05 + bw / 2, 0, 0.02),
    circ(0.03 + bw / 2, 0, 0.02),
    // tap
    circ(0, -hd + 0.055, 0.025),
    path(ln(0, -hd + 0.08, 0, -hd + 0.16)),
  ];
}

function stove(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.15;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' })];
  for (const [bx, by, br] of [
    [-w * 0.22, -d * 0.16, r],
    [w * 0.22, -d * 0.16, r * 0.78],
    [-w * 0.22, d * 0.24, r * 0.78],
    [w * 0.22, d * 0.24, r],
  ] as const) {
    p.push(circ(bx, by, br));
    p.push(circ(bx, by, br * 0.45));
    for (const a of [45, 135, 225, 315]) {
      const c = Math.cos((a * Math.PI) / 180);
      const s = Math.sin((a * Math.PI) / 180);
      p.push(path(ln(bx + c * br * 0.5, by + s * br * 0.5, bx + c * br * 0.92, by + s * br * 0.92)));
    }
  }
  p.push(path(ln(-hw + 0.04, hd - 0.055, hw - 0.04, hd - 0.055)));
  return p;
}

function fridge(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, 0.03), { thick: true, fill: 'body' }),
    // door face + swing tick
    path(ln(-hw, hd - 0.06, hw, hd - 0.06)),
    path(ln(hw - 0.06, hd - 0.06, hw - 0.06, hd)),
    // compressor corner
    path(ln(-hw + 0.05, -hd + 0.12, hw - 0.05, -hd + 0.12), { dash: true }),
  ];
}

function washingMachine(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const r = Math.min(w, d) * 0.31;
  return [
    path(rr(-hw, -hd, w, d, 0.02), { thick: true, fill: 'body' }),
    circ(0, 0.03, r),
    circ(0, 0.03, r * 0.62),
    circ(-hw + 0.08, -hd + 0.07, 0.02),
    circ(-hw + 0.16, -hd + 0.07, 0.02),
    path(ln(hw - 0.2, -hd + 0.04, hw - 0.06, -hd + 0.04)),
  ];
}

function toilet(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const bowlTop = -hd + 0.24;
  return [
    // cistern
    path(rr(-hw, -hd, w, 0.2, 0.025), { thick: true, fill: 'body' }),
    path(rr(-hw * 0.45, -hd + 0.055, w * 0.45, 0.09, 0.02)),
    // bowl — egg profile
    path(
      `M ${n(-hw * 0.78)} ${n(bowlTop)}` +
        ` C ${n(-hw * 1.02)} ${n(hd * 0.28)} ${n(-hw * 0.62)} ${n(hd - 0.02)} 0 ${n(hd - 0.02)}` +
        ` C ${n(hw * 0.62)} ${n(hd - 0.02)} ${n(hw * 1.02)} ${n(hd * 0.28)} ${n(hw * 0.78)} ${n(bowlTop)} Z`,
      { thick: true, fill: 'body' },
    ),
    // seat
    path(
      `M ${n(-hw * 0.52)} ${n(bowlTop + 0.08)}` +
        ` C ${n(-hw * 0.72)} ${n(hd * 0.3)} ${n(-hw * 0.45)} ${n(hd - 0.11)} 0 ${n(hd - 0.11)}` +
        ` C ${n(hw * 0.45)} ${n(hd - 0.11)} ${n(hw * 0.72)} ${n(hd * 0.3)} ${n(hw * 0.52)} ${n(bowlTop + 0.08)} Z`,
    ),
    // hinges
    circ(-hw * 0.4, bowlTop + 0.035, 0.018),
    circ(hw * 0.4, bowlTop + 0.035, 0.018),
  ];
}

function washbasin(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, 0.09), { thick: true, fill: 'body' }),
    ell(0, 0.025, hw * 0.68, hd * 0.58),
    circ(0, hd * 0.32, 0.016),
    // tap + handles
    path(rr(-0.022, -hd + 0.015, 0.044, 0.085, 0.02)),
    path(ln(0, -hd + 0.1, 0, -hd + 0.17)),
    circ(-0.075, -hd + 0.055, 0.02),
    circ(0.075, -hd + 0.055, 0.02),
  ];
}

function shower(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' }),
    path(rr(-hw + 0.05, -hd + 0.05, w - 0.1, d - 0.1, 0.04)),
    // floor fall lines to the drain
    path(ln(-hw + 0.05, -hd + 0.05, hw - 0.05, hd - 0.05)),
    path(ln(hw - 0.05, -hd + 0.05, -hw + 0.05, hd - 0.05)),
    circ(0, 0, 0.035),
    // shower head in the corner
    circ(-hw + 0.14, -hd + 0.14, 0.05),
    path(ln(-hw + 0.05, -hd + 0.05, -hw + 0.11, -hd + 0.11)),
  ];
}

function bathtub(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, 0.08), { thick: true, fill: 'body' }),
    // inner tub, rounded wide at the foot, narrower at the head (left)
    path(
      `M ${n(-hw + 0.3)} ${n(-hd + 0.09)}` +
        ` L ${n(hw - 0.16)} ${n(-hd + 0.09)} C ${n(hw - 0.05)} ${n(-hd + 0.09)} ${n(hw - 0.05)} ${n(hd - 0.09)} ${n(hw - 0.16)} ${n(hd - 0.09)}` +
        ` L ${n(-hw + 0.3)} ${n(hd - 0.09)} C ${n(-hw + 0.08)} ${n(hd - 0.14)} ${n(-hw + 0.08)} ${n(-hd + 0.14)} ${n(-hw + 0.3)} ${n(-hd + 0.09)} Z`,
    ),
    circ(-hw + 0.2, 0, 0.028),
    path(ln(-hw + 0.06, -0.05, -hw + 0.06, 0.05)),
  ];
}

function plant(w: number, d: number): SymbolPrim[] {
  const r = Math.min(w, d) / 2;
  const p: SymbolPrim[] = [circ(0, 0, r * 0.42)];
  // leaf lobes
  const lobes = 7;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const tx = Math.cos(a) * r * 0.95;
    const ty = Math.sin(a) * r * 0.95;
    const px = Math.cos(a + 0.5) * r * 0.45;
    const py = Math.sin(a + 0.5) * r * 0.45;
    const qx = Math.cos(a - 0.5) * r * 0.45;
    const qy = Math.sin(a - 0.5) * r * 0.45;
    p.push(path(`M ${n(px)} ${n(py)} Q ${n(tx * 1.12)} ${n(ty * 1.12)} ${n(qx)} ${n(qy)}`));
    p.push(path(ln(0, 0, tx * 0.85, ty * 0.85)));
  }
  return p;
}

function rug(w: number, d: number): SymbolPrim[] {
  return [
    path(rr(-w / 2, -d / 2, w, d, 0.03), { dash: true }),
    path(rr(-w / 2 + 0.07, -d / 2 + 0.07, w - 0.14, d - 0.14, 0.02), { dash: true }),
  ];
}

function lamp(w: number, d: number): SymbolPrim[] {
  const r = Math.min(w, d) / 2;
  const p: SymbolPrim[] = [circ(0, 0, r, { fill: 'body' }), circ(0, 0, r * 0.4)];
  for (const a of [45, 135, 225, 315]) {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    p.push(path(ln(c * r * 0.55, s * r * 0.55, c * r * 0.95, s * r * 0.95)));
  }
  return p;
}

function railing(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = Math.max(d / 2, 0.03);
  const p: SymbolPrim[] = [path(ln(-hw, -hd, hw, -hd), { thick: true }), path(ln(-hw, hd, hw, hd), { thick: true })];
  const posts = Math.max(2, Math.round(w / 0.6));
  for (let i = 0; i <= posts; i++) p.push(circ(-hw + (w * i) / posts, 0, 0.025, { fill: 'ink' }));
  return p;
}

function slats(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' })];
  const c = Math.max(3, Math.round(w / 0.15));
  for (let i = 0; i < c; i++) p.push(path(ln(-hw + (w * (i + 0.5)) / c, -hd, -hw + (w * (i + 0.5)) / c, hd)));
  return p;
}

function stripLight(w: number, d: number): SymbolPrim[] {
  return [
    path(rr(-w / 2, -d / 2, w, d), { thick: true, fill: 'body' }),
    path(ln(-w / 2 + 0.03, 0, w / 2 - 0.03, 0), { dash: true }),
  ];
}

function planter(w: number, d: number): SymbolPrim[] {
  const p: SymbolPrim[] = [
    path(rr(-w / 2, -d / 2, w, d), { thick: true, fill: 'body' }),
    path(rr(-w / 2 + 0.045, -d / 2 + 0.045, w - 0.09, d - 0.09, 0.02)),
  ];
  const shrubs = Math.max(1, Math.round(w / 0.45));
  for (let i = 0; i < shrubs; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / shrubs;
    const r = Math.min(d / 2 - 0.06, w / shrubs / 2 - 0.03);
    p.push(circ(x, 0, r));
    p.push(circ(x, 0, r * 0.45));
  }
  return p;
}

function wallCab(w: number, d: number): SymbolPrim[] {
  // overhead unit — dashed outline convention
  return [
    path(rr(-w / 2, -d / 2, w, d), { dash: true }),
    path(ln(-w / 2, d / 2, w / 2, -d / 2), { dash: true }),
  ];
}

function appliance(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d), { thick: true, fill: 'body' }),
    path(rr(-hw + 0.04, -hd + 0.04, w - 0.08, d - 0.08)),
    path(ln(-hw + 0.06, hd - 0.09, hw - 0.06, hd - 0.09)),
    circ(hw - 0.12, -hd + 0.1, 0.022),
  ];
}

function hood(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d), { dash: true })];
  // vent slats
  for (let i = 1; i <= 3; i++) p.push(path(ln(-hw + 0.06, -hd + (d * i) / 4, hw - 0.06, -hd + (d * i) / 4)));
  return p;
}

function vanity(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, 0.03), { thick: true, fill: 'body' }),
    ell(0, 0.02, Math.min(hw * 0.5, 0.24), Math.min(hd * 0.55, 0.19)),
    circ(0, hd * 0.4, 0.014),
    path(rr(-0.02, -hd + 0.02, 0.04, 0.08, 0.015)),
    path(ln(-hw + 0.05, hd - 0.07, hw - 0.05, hd - 0.07)),
  ];
}

function bunk(w: number, d: number): SymbolPrim[] {
  const p = bed(w, d);
  // diagonal cut mark: two beds stacked
  p.push(path(ln(-w / 2, d / 2, w / 2, -d / 2)));
  return p;
}

function officeChair(w: number, d: number): SymbolPrim[] {
  const r = Math.min(w, d) * 0.36;
  const p: SymbolPrim[] = [
    circ(0, 0.03, r, { thick: true, fill: 'body' }),
    // backrest crescent
    path(
      `M ${n(-r * 0.95)} ${n(-d / 2 + 0.16)} Q 0 ${n(-d / 2 - 0.02)} ${n(r * 0.95)} ${n(-d / 2 + 0.16)}` +
        ` L ${n(r * 0.8)} ${n(-d / 2 + 0.22)} Q 0 ${n(-d / 2 + 0.08)} ${n(-r * 0.8)} ${n(-d / 2 + 0.22)} Z`,
      { fill: 'body' },
    ),
  ];
  // five-star base
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
    p.push(path(ln(0, 0.03, Math.cos(a) * (r + 0.09), 0.03 + Math.sin(a) * (r + 0.09))));
  }
  return p;
}

function tvFlat(w: number, d: number): SymbolPrim[] {
  return [
    path(rr(-w / 2, -d / 2, w, d), { thick: true, fill: 'ink' }),
    path(ln(-w * 0.12, d / 2, w * 0.12, d / 2)),
  ];
}

function car(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  return [
    path(rr(-hw, -hd, w, d, Math.min(0.32, w * 0.18)), { thick: true, fill: 'body' }),
    path(ln(-hw + 0.06, -hd + d * 0.2, hw - 0.06, -hd + d * 0.2)),
    path(rr(-hw + 0.14, -hd + d * 0.24, w - 0.28, d * 0.52, 0.18)),
    path(ln(-hw + 0.14, -hd + d * 0.34, hw - 0.14, -hd + d * 0.34)),
    path(ln(-hw + 0.14, hd - d * 0.3, hw - 0.14, hd - d * 0.3)),
    path(rr(-hw - 0.09, -hd + d * 0.25, 0.09, 0.14)),
    path(rr(hw, -hd + d * 0.25, 0.09, 0.14)),
  ];
}

function bike(w: number, d: number): SymbolPrim[] {
  const hd = d / 2;
  const r = Math.min(w * 0.45, d * 0.22);
  return [
    ell(0, -hd + r, w * 0.16, r),
    ell(0, hd - r, w * 0.16, r),
    path(ln(0, -hd + r, 0, hd - r), { thick: true }),
    path(ln(-w / 2, -hd + r, w / 2, -hd + r), { thick: true }), // handlebar
    path(ln(-w * 0.22, hd - r * 1.15, w * 0.22, hd - r * 1.15)), // saddle
  ];
}

function pergola(w: number, d: number): SymbolPrim[] {
  const hw = w / 2;
  const hd = d / 2;
  const p: SymbolPrim[] = [path(rr(-hw, -hd, w, d), { dash: true })];
  const c = Math.max(4, Math.round(w / 0.35));
  for (let i = 0; i < c; i++) p.push(path(ln(-hw + (w * (i + 0.5)) / c, -hd, -hw + (w * (i + 0.5)) / c, hd)));
  for (const [px, py] of [[-hw + 0.08, -hd + 0.08], [hw - 0.08, -hd + 0.08], [-hw + 0.08, hd - 0.08], [hw - 0.08, hd - 0.08]]) {
    p.push(path(rr(px - 0.06, py - 0.06, 0.12, 0.12), { fill: 'ink' }));
  }
  return p;
}

function box(w: number, d: number): SymbolPrim[] {
  return [path(rr(-w / 2, -d / 2, w, d, 0.02), { thick: true, fill: 'body' })];
}

/** The block for a catalog symbol at a given footprint. */
export function symbolBlock(kind: Symbol2D | undefined, w: number, d: number): SymbolPrim[] {
  switch (kind) {
    case 'bed': return bed(w, d);
    case 'chair': return chair(w, d);
    case 'sofa': return sofa(w, d, w > 1.9 ? 3 : 2);
    case 'sofa-l': return sofaL(w, d);
    case 'armchair': return armchair(w, d);
    case 'table-rect': return tableRect(w, d);
    case 'table-round': return tableRound(w);
    case 'wardrobe': return wardrobe(w, d);
    case 'dresser': return dresser(w, d);
    case 'tv-unit': return tvUnit(w, d);
    case 'bookshelf': return bookshelf(w, d);
    case 'counter': case 'island': return counter(w, d);
    case 'sink': return sink(w, d);
    case 'stove': return stove(w, d);
    case 'fridge': return fridge(w, d);
    case 'washing-machine': return washingMachine(w, d);
    case 'toilet': return toilet(w, d);
    case 'washbasin': return washbasin(w, d);
    case 'shower': return shower(w, d);
    case 'bathtub': return bathtub(w, d);
    case 'plant': return plant(w, d);
    case 'rug': case 'floor-patch': return rug(w, d);
    case 'lamp-floor': case 'lamp-ceiling': return lamp(w, d);
    case 'railing': return railing(w, d);
    case 'slats': return slats(w, d);
    case 'strip-light': return stripLight(w, d);
    case 'planter': return planter(w, d);
    case 'wall-cab': return wallCab(w, d);
    case 'appliance': return appliance(w, d);
    case 'hood': return hood(w, d);
    case 'vanity': return vanity(w, d);
    case 'bunk': return bunk(w, d);
    case 'office-chair': return officeChair(w, d);
    case 'tv-flat': return tvFlat(w, d);
    case 'car': return car(w, d);
    case 'bike': return bike(w, d);
    case 'pergola': return pergola(w, d);
    case 'ceiling-panel': return [path(rr(-w / 2, -d / 2, w, d), { dash: true })];
    default: return box(w, d);
  }
}

export interface PrimSVGOptions {
  stroke: string;
  thin: number;
  thick: number;
  body: string;
}

/** Serialize primitives to SVG markup (shared by all export sheets). */
export function primsToSVG(prims: SymbolPrim[], opts: PrimSVGOptions): string {
  const sw = (p: SymbolPrim) => ('thick' in p && p.thick ? opts.thick : opts.thin);
  const fill = (f: SymbolFill | undefined) =>
    f === 'body' ? opts.body : f === 'ink' ? opts.stroke : 'none';
  return prims
    .map((p) => {
      const dash = 'dash' in p && p.dash ? ' stroke-dasharray="0.07 0.05"' : '';
      if (p.k === 'circle') {
        return `<circle cx="${n(p.x)}" cy="${n(p.y)}" r="${n(p.r)}" fill="${fill(p.fill)}" stroke="${opts.stroke}" stroke-width="${sw(p)}"${dash}/>`;
      }
      if (p.k === 'ellipse') {
        return `<ellipse cx="${n(p.x)}" cy="${n(p.y)}" rx="${n(p.rx)}" ry="${n(p.ry)}" fill="${fill(p.fill)}" stroke="${opts.stroke}" stroke-width="${sw(p)}"${dash}/>`;
      }
      return `<path d="${p.d}" fill="${fill(p.fill)}" stroke="${opts.stroke}" stroke-width="${sw(p)}" stroke-linejoin="round"${dash}/>`;
    })
    .join('');
}

/** Serialize a catalog block to SVG markup. */
export function symbolBlockSVG(
  kind: Symbol2D | undefined,
  w: number,
  d: number,
  opts: PrimSVGOptions,
): string {
  return primsToSVG(symbolBlock(kind, w, d), opts);
}
