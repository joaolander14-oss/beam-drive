// ============================================================
//  Beam Drive — dados reais: motores, câmbios, pneus, carros
// ============================================================
export const G = 9.81;
export const RHO = 1.2;
export const HP = 745.7;

export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const sstep = (a, b, x) => smooth((x - a) / (b - a));

// interpolação monotônica (PCHIP)
export function pchip(xs, ys) {
  const n = xs.length, h = [], d = [], m = new Array(n);
  for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
  if (n === 2) { m[0] = m[1] = d[0]; }
  else {
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
  }
  return x => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (i < n - 2 && x > xs[i + 1]) i++;
    const t = (x - xs[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
}

// ------------------------------------------------------------
//  MOTORES  (hp e Nm reais; a curva é gerada para bater com eles)
// ------------------------------------------------------------
//  tq:[rpm,Nm] pico de torque   tq2: rpm onde acaba o platô de torque
//  pw:[rpm,hp] pico de potência  boost: bar de pressão e rpm de resposta do turbo
export const ENGINES = {
  'i4-1.0':   { name: '1.0 8V I4 aspirado', kind: 'na', cyl: 4, disp: 1.0, tq: [3500, 98], pw: [6250, 76], idle: 850, red: 6800, mass: 72, J: 0.10, fric: 0.10 },
  'i4-1.6':   { name: '1.6 16V I4 aspirado', kind: 'na', cyl: 4, disp: 1.6, tq: [4200, 155], pw: [6000, 120], idle: 850, red: 6700, mass: 95, J: 0.12, fric: 0.10 },
  'i4-2.0n':  { name: '2.0 16V I4 aspirado', kind: 'na', cyl: 4, disp: 2.0, tq: [4400, 190], pw: [6200, 150], idle: 850, red: 6800, mass: 108, J: 0.13, fric: 0.10 },
  'i4-2.0vt': { name: '2.0 VTEC I4 alta rotação', kind: 'na', cyl: 4, disp: 2.0, tq: [6100, 196], pw: [7800, 200], idle: 950, red: 8400, mass: 112, J: 0.12, fric: 0.11, vtec: true },
  'i4-2.0t':  { name: '2.0 TSI I4 turbo', kind: 'turbo', cyl: 4, disp: 2.0, tq: [2800, 370], tq2: 4600, pw: [5500, 245], idle: 800, red: 6800, mass: 138, J: 0.14, fric: 0.10, boost: { bar: 0.9, lo: 1300, hi: 2300 } },
  'f4-2.5t':  { name: '2.5 Boxer turbo', kind: 'turbo', cyl: 4, disp: 2.5, tq: [4000, 407], tq2: 5200, pw: [6000, 300], idle: 800, red: 6800, mass: 148, J: 0.15, fric: 0.11, boost: { bar: 1.0, lo: 2200, hi: 3600 }, boxer: true },
  'i6-3.0t':  { name: '3.0 I6 biturbo (2JZ)', kind: 'turbo', cyl: 6, disp: 3.0, tq: [4000, 440], tq2: 5200, pw: [5600, 320], idle: 800, red: 7200, mass: 235, J: 0.20, fric: 0.10, boost: { bar: 0.8, lo: 1800, hi: 3200 } },
  'v6-3.5':   { name: '3.5 V6 aspirado', kind: 'na', cyl: 6, disp: 3.5, tq: [4800, 370], pw: [6400, 300], idle: 700, red: 7000, mass: 165, J: 0.17, fric: 0.10 },
  'v8-5.0':   { name: '5.0 V8 aspirado', kind: 'na', cyl: 8, disp: 5.0, tq: [4600, 570], pw: [7000, 460], idle: 750, red: 7500, mass: 205, J: 0.22, fric: 0.10 },
  'v8-6.2sc': { name: '6.2 V8 supercharged', kind: 'sc', cyl: 8, disp: 6.2, tq: [3600, 880], tq2: 5200, pw: [6400, 650], idle: 700, red: 6700, mass: 255, J: 0.25, fric: 0.11, boost: { bar: 0.75, lo: 500, hi: 1200 } },
  'v10-5.2':  { name: '5.2 V10 aspirado', kind: 'na', cyl: 10, disp: 5.2, tq: [6500, 560], pw: [8000, 610], idle: 900, red: 8700, mass: 220, J: 0.18, fric: 0.12 },
  'v12-6.5':  { name: '6.5 V12 aspirado', kind: 'na', cyl: 12, disp: 6.5, tq: [6750, 720], pw: [8500, 770], idle: 900, red: 9000, mass: 270, J: 0.24, fric: 0.12 },
  'rot-13b':  { name: '13B rotativo biturbo', kind: 'turbo', cyl: 4, disp: 1.3, tq: [5000, 314], tq2: 5800, pw: [6500, 280], idle: 850, red: 7600, mass: 125, J: 0.10, fric: 0.12, boost: { bar: 0.75, lo: 2800, hi: 4200 }, rotary: true },
  'd-2.8':    { name: '2.8 I4 turbodiesel', kind: 'diesel', cyl: 4, disp: 2.8, tq: [1600, 500], tq2: 2800, pw: [3400, 204], idle: 720, red: 4300, mass: 245, J: 0.30, fric: 0.12, boost: { bar: 1.0, lo: 1000, hi: 1800 } },
  'd-3.0':    { name: '3.0 I6 turbodiesel', kind: 'diesel', cyl: 6, disp: 3.0, tq: [1750, 620], tq2: 2900, pw: [4000, 265], idle: 720, red: 4800, mass: 215, J: 0.30, fric: 0.12, boost: { bar: 1.0, lo: 1000, hi: 1700 } },
  'd-6.7':    { name: '6.7 V8 turbodiesel pesado', kind: 'diesel', cyl: 8, disp: 6.7, tq: [1600, 1020], tq2: 2300, pw: [2800, 450], idle: 650, red: 3600, mass: 470, J: 0.70, fric: 0.12, boost: { bar: 1.2, lo: 900, hi: 1500 } },
  'vw-1.6':   { name: '1.6 Boxer refrigerado a ar', kind: 'na', cyl: 4, disp: 1.6, tq: [2600, 104], pw: [4000, 50], idle: 800, red: 5000, mass: 92, J: 0.11, fric: 0.12, boxer: true },
  'ev-1':     { name: 'Motor elétrico 150 kW', kind: 'ev', cyl: 0, disp: 0, Tmax: 320, Pmax: 150, idle: 0, red: 14000, mass: 95, battery: 260, J: 0.04, regen: 0.30 },
  'ev-2':     { name: 'Dual motor elétrico 340 kW', kind: 'ev', cyl: 0, disp: 0, Tmax: 650, Pmax: 340, idle: 0, red: 16000, mass: 165, battery: 420, J: 0.07, regen: 0.35 },
  'ev-3':     { name: 'Tri motor elétrico 750 kW', kind: 'ev', cyl: 0, disp: 0, Tmax: 1150, Pmax: 750, idle: 0, red: 18000, mass: 240, battery: 520, J: 0.10, regen: 0.40 },
};

// gera a curva de torque (Nm) a cada 50 rpm
export function buildCurve(e) {
  const step = 50, top = e.red + 600, n = Math.floor(top / step) + 1, T = new Float32Array(n);
  if (e.kind === 'ev') {
    const P = e.Pmax * 1000;
    for (let i = 0; i < n; i++) { const w = Math.max(i * step, 1) * Math.PI / 30; T[i] = Math.min(e.Tmax, P / w); if (i * step > e.red) T[i] *= Math.max(0, 1 - (i * step - e.red) / 600); }
    e.peakTq = e.Tmax; e.peakKw = e.Pmax; e.peakHp = e.Pmax * 1000 / HP; e.rpmP = Math.round(P / e.Tmax * 30 / Math.PI);
    return (e.curve = T, e.step = step, e);
  }
  const [rt, Tpk0] = e.tq, [rp, hp] = e.pw;
  const Tp = hp * HP / (rp * Math.PI / 30);
  const Tpk = Math.max(Tpk0, Tp * 1.005);
  const idle = e.idle, red = e.red;
  const xs = [], ys = [];
  const add = (x, y) => { if (!xs.length || x > xs[xs.length - 1] + 40) { xs.push(x); ys.push(y); } };
  const lowF = e.kind === 'na' ? 0.60 : e.kind === 'sc' ? 0.62 : e.kind === 'diesel' ? 0.55 : 0.50;
  add(idle, lowF * Tpk);
  if (e.tq2) {
    add(lerp(idle, rt, 0.5), lerp(lowF, 1, 0.65) * Tpk);
    add(rt, Tpk);
    add(e.tq2, Tpk * 0.985);
    add(lerp(e.tq2, rp, 0.5), lerp(Tpk * 0.985, Tp, 0.5) * 1.01);
  } else {
    add(lerp(idle, rt, 0.5), lerp(lowF, 1, 0.7) * Tpk);
    add(rt, Tpk);
    if (rp > rt * 1.15) add(lerp(rt, rp, 0.5), lerp(Tpk, Tp, 0.35));
  }
  add(rp, Tp);
  add(red, Tp * (e.kind === 'diesel' ? 0.80 : 0.86));
  add(top, Tp * 0.60);
  const f = pchip(xs, ys);
  let pk = 0, pkW = 0, rpmPk = 0, rpmT = 0;
  for (let i = 0; i < n; i++) {
    const r = i * step; let v = f(r);
    if (r < idle) v *= Math.max(0.2, r / idle);
    T[i] = v;
    if (r <= red) { if (v > pk) { pk = v; rpmT = r; } const w = v * r * Math.PI / 30; if (w > pkW) { pkW = w; rpmPk = r; } }
  }
  // reescala para que a potência de pico bata exatamente com o hp declarado
  if (pkW > 0) { const k = clamp(hp * HP / pkW, 0.8, 1.2); for (let i = 0; i < n; i++) T[i] *= k; pk *= k; pkW *= k; }
  e.curve = T; e.step = step; e.peakTq = pk; e.peakKw = pkW / 1000; e.peakHp = pkW / HP; e.rpmP = rpmPk; e.rpmT = rpmT;
  return e;
}
for (const k in ENGINES) { ENGINES[k].id = k; buildCurve(ENGINES[k]); }

// ------------------------------------------------------------
//  CÂMBIOS
// ------------------------------------------------------------
export const GEARBOXES = {
  '4mt':      { name: '4 marchas manual (clássico)', type: 'manual', r: [3.80, 2.06, 1.26, 0.93], rev: 3.61, fin: 4.375, mass: 30, shift: 0.32 },
  '5mt-eco':  { name: '5 marchas manual econômico', type: 'manual', r: [3.45, 1.87, 1.19, 0.88, 0.72], rev: 3.30, fin: 4.10, mass: 35, shift: 0.28 },
  '5mt':      { name: '5 marchas manual', type: 'manual', r: [3.62, 2.05, 1.36, 1.03, 0.82], rev: 3.50, fin: 3.90, mass: 38, shift: 0.26 },
  '6mt':      { name: '6 marchas manual esportivo', type: 'manual', r: [3.58, 2.19, 1.52, 1.13, 0.91, 0.74], rev: 3.40, fin: 3.94, mass: 44, shift: 0.22 },
  '6mt-jdm':  { name: '6 marchas manual (Getrag)', type: 'manual', r: [3.83, 2.36, 1.69, 1.31, 1.00, 0.79], rev: 3.82, fin: 3.27, mass: 62, shift: 0.22 },
  '6mt-sti':  { name: '6 marchas manual rali', type: 'manual', r: [3.64, 2.38, 1.72, 1.34, 1.00, 0.76], rev: 3.46, fin: 3.90, mass: 56, shift: 0.20 },
  '6mt-muscle': { name: '6 marchas manual (Tremec)', type: 'manual', r: [2.97, 2.07, 1.43, 1.00, 0.84, 0.57], rev: 3.28, fin: 3.73, mass: 70, shift: 0.24 },
  '6mt-truck':  { name: '6 marchas manual reforçado', type: 'manual', r: [4.70, 2.80, 1.70, 1.00, 0.78, 0.65], rev: 4.20, fin: 3.90, mass: 85, shift: 0.30 },
  '6mt-close': { name: '6 marchas relação fechada (competição)', type: 'manual', r: [2.92, 2.05, 1.55, 1.24, 1.02, 0.84], rev: 3.20, fin: 4.10, mass: 40, shift: 0.14 },
  '6at':      { name: '6 marchas automático', type: 'auto', r: [4.17, 2.34, 1.52, 1.14, 0.87, 0.69], rev: 3.40, fin: 3.50, mass: 78, shift: 0.38 },
  '8at':      { name: '8 marchas automático', type: 'auto', r: [4.71, 3.14, 2.10, 1.67, 1.29, 1.00, 0.84, 0.67], rev: 3.30, fin: 3.15, mass: 88, shift: 0.26 },
  '7dct':     { name: '7 marchas dupla embreagem', type: 'dct', r: [3.77, 2.34, 1.55, 1.19, 0.97, 0.82, 0.69], rev: 3.50, fin: 3.90, mass: 80, shift: 0.10 },
  '6seq':     { name: '6 marchas sequencial de corrida', type: 'seq', r: [2.55, 1.88, 1.50, 1.24, 1.05, 0.90], rev: 2.70, fin: 4.20, mass: 36, shift: 0.06 },
  '3at-drag': { name: '3 marchas drag (Powerglide)', type: 'auto', r: [1.76, 1.00, 0.70], rev: 1.76, fin: 4.56, mass: 60, shift: 0.20 },
  'cvt':      { name: 'CVT variação contínua', type: 'cvt', r: [2.55, 0.42], rev: 2.55, fin: 4.20, mass: 70, shift: 0.0 },
  'ev-1':     { name: 'Redução única (elétrico)', type: 'ev', r: [9.0], rev: 9.0, fin: 1.0, mass: 20, shift: 0.0 },
  'ev-2':     { name: '2 velocidades (elétrico esportivo)', type: 'ev2', r: [15.5, 8.2], rev: 15.5, fin: 1.0, mass: 34, shift: 0.18 },
};

export const DIFFS = {
  open:   { name: 'Aberto', preload: 0, pw: 0, co: 0 },
  lsd1:   { name: 'LSD 1 via (autoblocante)', preload: 60, pw: 0.45, co: 0.05 },
  lsd2:   { name: 'LSD 2 vias (competição)', preload: 90, pw: 0.65, co: 0.45 },
  locked: { name: 'Bloqueado (spool)', preload: 1e6, pw: 1, co: 1 },
};
export const CENTER_DIFFS = {
  open:   { name: 'Aberto', cap: 0 },
  visc:   { name: 'Viscoso (acoplamento)', cap: 600 },
  active: { name: 'Ativo (embreagem eletrônica)', cap: 1500 },
  locked: { name: 'Travado 50/50 (off-road)', cap: 1e6 },
};

// ------------------------------------------------------------
//  PNEUS  (compostos)  — mu: aderência no asfalto; loose: multiplicador em piso solto
// ------------------------------------------------------------
export const COMPOUNDS = {
  eco:      { name: 'Econômico (baixa resistência)', mu: 0.88, kp: 0.15, ap: 0.16, C: 1.32, crr: 0.0075, loose: 0.80, ls: 0.14, hard: 1.0 },
  street:   { name: 'Rua / Todas as estações', mu: 1.00, kp: 0.14, ap: 0.15, C: 1.36, crr: 0.0095, loose: 0.88, ls: 0.13, hard: 1.0 },
  sport:    { name: 'Esportivo (Ultra High Perf.)', mu: 1.14, kp: 0.13, ap: 0.14, C: 1.40, crr: 0.0110, loose: 0.80, ls: 0.12, hard: 1.1 },
  semislick:{ name: 'Semi-slick (track day)', mu: 1.30, kp: 0.12, ap: 0.12, C: 1.46, crr: 0.0135, loose: 0.65, ls: 0.11, hard: 1.2 },
  slick:    { name: 'Slick de competição', mu: 1.52, kp: 0.11, ap: 0.105, C: 1.55, crr: 0.0165, loose: 0.55, ls: 0.10, hard: 1.3 },
  drift:    { name: 'Drift (composto duro)', mu: 0.84, kp: 0.17, ap: 0.20, C: 1.25, crr: 0.0100, loose: 0.85, ls: 0.14, hard: 1.0 },
  rally:    { name: 'Rali / Cascalho', mu: 0.96, kp: 0.15, ap: 0.17, C: 1.30, crr: 0.0130, loose: 1.18, ls: 0.13, hard: 1.0 },
  at:       { name: 'Off-road misto (A/T)', mu: 0.92, kp: 0.15, ap: 0.17, C: 1.30, crr: 0.0165, loose: 1.15, ls: 0.14, hard: 1.0 },
  mud:      { name: 'Lama (M/T)', mu: 0.84, kp: 0.17, ap: 0.19, C: 1.28, crr: 0.0230, loose: 1.38, ls: 0.15, hard: 1.0 },
  drag:     { name: 'Drag slick traseiro', mu: 1.60, kp: 0.09, ap: 0.20, C: 1.45, crr: 0.0200, loose: 0.50, ls: 0.09, hard: 1.2 },
};

export const BRAKES = {
  drum:   { name: 'Tambor (econômico)', k: 0.85, mass: -6, fade: 1.6 },
  stock:  { name: 'Disco padrão', k: 1.20, mass: 0, fade: 1.0 },
  sport:  { name: 'Disco ventilado esportivo', k: 1.45, mass: 5, fade: 0.8 },
  big:    { name: 'Kit big brake (6 pistões)', k: 1.75, mass: 12, fade: 0.6 },
  carbon: { name: 'Carbono-cerâmico', k: 2.00, mass: -14, fade: 0.4 },
};

export const SUSP_PRESETS = {
  comfort: { name: 'Conforto',   kF: 20, kR: 17, bF: 6,  bR: 3,  zb: 0.28, zr: 0.50, rh: 0 },
  sport:   { name: 'Esportiva',  kF: 34, kR: 30, bF: 22, bR: 14, zb: 0.32, zr: 0.62, rh: -20 },
  coil:    { name: 'Coilover baixo', kF: 55, kR: 48, bF: 34, bR: 22, zb: 0.38, zr: 0.72, rh: -45 },
  race:    { name: 'Corrida rígida', kF: 90, kR: 80, bF: 50, bR: 34, zb: 0.45, zr: 0.80, rh: -70 },
  rally:   { name: 'Rali (alta, longo curso)', kF: 28, kR: 26, bF: 14, bR: 8, zb: 0.30, zr: 0.70, rh: 35 },
  lift:    { name: 'Lift kit off-road', kF: 30, kR: 30, bF: 10, bR: 6, zb: 0.28, zr: 0.55, rh: 90 },
  drift:   { name: 'Drift (traseira solta)', kF: 42, kR: 30, bF: 10, bR: 30, zb: 0.35, zr: 0.65, rh: -35 },
};

export const WHEEL_STYLES = {
  five:  { name: '5 raios', spokes: 5, w: 0.16, dish: 0.03, kind: 'spoke' },
  six:   { name: '6 raios duplos', spokes: 6, w: 0.12, dish: 0.045, kind: 'spoke', twin: true },
  ten:   { name: '10 raios finos', spokes: 10, w: 0.07, dish: 0.025, kind: 'spoke' },
  mesh:  { name: 'Malha (BBS)', spokes: 20, w: 0.04, dish: 0.02, kind: 'mesh' },
  turbo: { name: 'Turbina aero', spokes: 12, w: 0.09, dish: 0.0, kind: 'fan' },
  deep:  { name: 'Deep dish', spokes: 8, w: 0.10, dish: 0.07, kind: 'spoke' },
  steel: { name: 'Aço estampado', spokes: 0, w: 0, dish: 0.01, kind: 'steel' },
  beadlock: { name: 'Beadlock off-road', spokes: 8, w: 0.13, dish: 0.0, kind: 'steel', bolts: true },
};

export const SURF = [
  { id: 0, name: 'Asfalto',  mu: 1.00, crr: 0.000, hard: true,  col: [0.20, 0.20, 0.21] },
  { id: 1, name: 'Concreto', mu: 0.95, crr: 0.000, hard: true,  col: [0.52, 0.52, 0.50] },
  { id: 2, name: 'Terra',    mu: 0.70, crr: 0.020, hard: false, col: [0.50, 0.38, 0.24] },
  { id: 3, name: 'Grama',    mu: 0.58, crr: 0.040, hard: false, col: [0.22, 0.36, 0.14] },
  { id: 4, name: 'Areia',    mu: 0.50, crr: 0.075, hard: false, col: [0.80, 0.68, 0.45] },
  { id: 5, name: 'Cascalho', mu: 0.62, crr: 0.035, hard: false, col: [0.55, 0.52, 0.47] },
  { id: 6, name: 'Lama',     mu: 0.40, crr: 0.120, hard: false, col: [0.27, 0.19, 0.12] },
  { id: 7, name: 'Rocha',    mu: 0.88, crr: 0.015, hard: true,  col: [0.45, 0.42, 0.40] },
  { id: 8, name: 'Zebra',    mu: 0.92, crr: 0.000, hard: true,  col: [0.75, 0.2, 0.2] },
  { id: 9, name: 'Água rasa', mu: 0.30, crr: 0.200, hard: false, col: [0.12, 0.30, 0.45] },
];

// ------------------------------------------------------------
//  CARROS  (dimensões e números inspirados em modelos reais)
// ------------------------------------------------------------
//  shape: silhueta usada para modelar a carroceria 3D
//   nt/nb = topo/base do nariz; hf = altura do capô em x=10%; xc = fração do cowl;
//   belt = [altura da linha da cintura frente, traseira]; xrf/xrr = início/fim do teto;
//   xt = fração onde acaba o vidro traseiro; tail = altura do topo da traseira; tb = base da traseira
export const CARS = {
  compacto: {
    name: 'Compacto 1.0', sub: 'Hatch popular brasileiro (tipo VW Gol)', cls: 'Hatch compacto',
    L: 3.89, W: 1.66, H: 1.46, WB: 2.47, fo: 0.80, tF: 1.43, tR: 1.42, cgH: 0.50, mass: 960, distF: 0.60, engX: -0.10, drvX: 0.85,
    drive: 'fwd', eng: 'i4-1.0', gb: '5mt-eco', fin: 4.10,
    tf: [175, 70, 14], tr: [175, 70, 14], comp: 'eco', spr: [19, 16], arb: [7, 0], damp: [0.28, 0.55], trav: [0.10, 0.13],
    brk: { k: 1.0, bias: 0.68 }, cd: 0.34, A: 1.95, dfF: -0.02, dfR: -0.02, steer: 0.62, ack: 0.9, camber: [-0.3, -0.5], toe: [0.05, 0.1],
    wheel: 'steel', color: '#d8d8d8', rimColor: '#c8c8c8', spoiler: 'none',
    shape: { nt: 0.62, nb: 0.34, hf: 0.70, xc: 0.33, belt: [0.88, 0.92], xrf: 0.55, xrr: 0.76, xt: 0.965, tail: 0.88, tb: 0.38, roofW: 0.70, door: 2, fn: 0.84, fr: 0.9, rnd: 1.0 },
  },
  hatchgt: {
    name: 'Hot Hatch GT', sub: 'Hatch esportivo europeu (tipo Golf GTI)', cls: 'Hot hatch',
    L: 4.26, W: 1.80, H: 1.45, WB: 2.63, fo: 0.90, tF: 1.54, tR: 1.52, cgH: 0.52, mass: 1380, distF: 0.61, engX: -0.05, drvX: 0.95,
    drive: 'fwd', eng: 'i4-2.0t', gb: '6mt', fin: 3.94,
    tf: [225, 45, 17], tr: [225, 45, 17], comp: 'sport', spr: [26, 22], arb: [18, 12], damp: [0.30, 0.58], trav: [0.10, 0.13],
    brk: { k: 1.2, bias: 0.68 }, cd: 0.31, A: 2.20, dfF: -0.03, dfR: -0.02, steer: 0.60, ack: 0.9, camber: [-0.8, -1.3], toe: [0.05, 0.12],
    wheel: 'five', color: '#a01e24', rimColor: '#3a3d42', spoiler: 'lip',
    shape: { nt: 0.66, nb: 0.34, hf: 0.78, xc: 0.34, belt: [0.97, 1.00], xrf: 0.53, xrr: 0.78, xt: 0.975, tail: 0.97, tb: 0.38, roofW: 0.68, door: 4, fn: 0.86, fr: 0.9, rnd: 1.0 },
  },
  sedan: {
    name: 'Sedã Médio', sub: 'Sedã médio japonês (tipo Corolla/Civic)', cls: 'Sedã',
    L: 4.65, W: 1.78, H: 1.43, WB: 2.70, fo: 0.96, tF: 1.54, tR: 1.54, cgH: 0.53, mass: 1300, distF: 0.60, engX: -0.05, drvX: 1.0,
    drive: 'fwd', eng: 'i4-2.0n', gb: 'cvt', fin: 4.20,
    tf: [205, 55, 16], tr: [205, 55, 16], comp: 'street', spr: [22, 19], arb: [14, 8], damp: [0.28, 0.55], trav: [0.10, 0.13],
    brk: { k: 1.1, bias: 0.68 }, cd: 0.29, A: 2.15, dfF: -0.03, dfR: -0.03, steer: 0.60, ack: 0.9, camber: [-0.5, -1.0], toe: [0.05, 0.1],
    wheel: 'ten', color: '#26364f', rimColor: '#a8adb4', spoiler: 'none',
    shape: { nt: 0.62, nb: 0.33, hf: 0.76, xc: 0.335, belt: [0.95, 0.99], xrf: 0.5, xrr: 0.66, xt: 0.77, tail: 0.94, tb: 0.38, roofW: 0.68, door: 4, fn: 0.86, fr: 0.9, rnd: 1.0 },
  },
  muscle: {
    name: 'Muscle V8', sub: 'Muscle car americano (tipo Mustang GT)', cls: 'Muscle car',
    L: 4.78, W: 1.92, H: 1.39, WB: 2.72, fo: 0.92, tF: 1.60, tR: 1.62, cgH: 0.54, mass: 1720, distF: 0.54, engX: 0.05, drvX: 1.1,
    drive: 'rwd', eng: 'v8-5.0', gb: '6mt-muscle', fin: 3.73, dir: 'lsd1',
    tf: [255, 40, 19], tr: [275, 40, 19], comp: 'sport', spr: [32, 27], arb: [24, 14], damp: [0.30, 0.60], trav: [0.10, 0.13],
    brk: { k: 1.35, bias: 0.64 }, cd: 0.35, A: 2.25, dfF: -0.04, dfR: -0.03, steer: 0.58, ack: 0.9, camber: [-0.9, -1.2], toe: [0.04, 0.12],
    wheel: 'six', color: '#e0a000', rimColor: '#202226', spoiler: 'none',
    shape: { nt: 0.62, nb: 0.30, hf: 0.84, xc: 0.39, belt: [1.04, 1.10], xrf: 0.54, xrr: 0.66, xt: 0.82, tail: 1.05, tb: 0.36, roofW: 0.70, door: 2, fn: 0.84, fr: 0.9, rnd: 1.0, scoop: true },
  },
  supercar: {
    name: 'Supercarro V10', sub: 'Supercarro italiano de motor central (tipo Huracán)', cls: 'Supercarro',
    L: 4.52, W: 1.93, H: 1.17, WB: 2.62, fo: 0.94, tF: 1.67, tR: 1.62, cgH: 0.45, mass: 1560, distF: 0.43, engX: 1.35, drvX: 0.95,
    drive: 'awd', eng: 'v10-5.2', gb: '7dct', fin: 3.50, cf: 0.30, dir: 'lsd1', dc: 'active',
    tf: [245, 30, 20], tr: [305, 30, 20], comp: 'sport', spr: [42, 48], arb: [32, 24], damp: [0.34, 0.66], trav: [0.08, 0.10],
    brk: { k: 1.9, bias: 0.60 }, cd: 0.36, A: 2.0, dfF: 0.20, dfR: 0.35, steer: 0.56, ack: 0.9, camber: [-1.6, -1.8], toe: [0.03, 0.15],
    wheel: 'turbo', color: '#f0c000', rimColor: '#15161a', spoiler: 'none',
    shape: { nt: 0.50, nb: 0.20, hf: 0.58, xc: 0.33, belt: [0.82, 0.95], xrf: 0.46, xrr: 0.62, xt: 0.86, tail: 0.90, tb: 0.28, roofW: 0.66, door: 2, fn: 0.80, fr: 0.88, rnd: 1.0, wedge: true },
  },
  jdm: {
    name: 'Esportivo JDM', sub: 'Coupé japonês turbo dos anos 90 (tipo Supra)', cls: 'Esportivo',
    L: 4.51, W: 1.81, H: 1.27, WB: 2.55, fo: 0.94, tF: 1.52, tR: 1.54, cgH: 0.48, mass: 1510, distF: 0.53, engX: 0.05, drvX: 1.0,
    drive: 'rwd', eng: 'i6-3.0t', gb: '6mt-jdm', fin: 3.27, dir: 'lsd2',
    tf: [235, 45, 17], tr: [255, 40, 17], comp: 'sport', spr: [30, 26], arb: [22, 14], damp: [0.32, 0.62], trav: [0.09, 0.12],
    brk: { k: 1.5, bias: 0.62 }, cd: 0.32, A: 2.0, dfF: 0.0, dfR: 0.05, steer: 0.58, ack: 0.9, camber: [-1.0, -1.5], toe: [0.04, 0.15],
    wheel: 'mesh', color: '#d9d9de', rimColor: '#c0a060', spoiler: 'gt',
    shape: { nt: 0.58, nb: 0.28, hf: 0.72, xc: 0.35, belt: [0.88, 0.97], xrf: 0.5, xrr: 0.66, xt: 0.86, tail: 0.98, tb: 0.34, roofW: 0.66, door: 2, fn: 0.84, fr: 0.9, rnd: 1.0 },
  },
  rally: {
    name: 'Rali AWD', sub: 'Sedã de rali de tração integral (tipo WRX STI)', cls: 'Rali',
    L: 4.60, W: 1.80, H: 1.47, WB: 2.65, fo: 0.88, tF: 1.53, tR: 1.54, cgH: 0.55, mass: 1500, distF: 0.60, engX: -0.10, drvX: 0.95,
    drive: 'awd', eng: 'f4-2.5t', gb: '6mt-sti', fin: 3.90, cf: 0.41, dir: 'lsd1', dif: 'open', dc: 'active',
    tf: [245, 40, 18], tr: [245, 40, 18], comp: 'rally', spr: [28, 25], arb: [20, 12], damp: [0.30, 0.62], trav: [0.12, 0.16],
    brk: { k: 1.4, bias: 0.64 }, cd: 0.33, A: 2.2, dfF: 0.0, dfR: 0.05, steer: 0.60, ack: 0.9, camber: [-1.0, -1.2], toe: [0.04, 0.12],
    wheel: 'mesh', color: '#1f4fa8', rimColor: '#d8b030', spoiler: 'gt',
    shape: { nt: 0.64, nb: 0.33, hf: 0.78, xc: 0.335, belt: [0.97, 1.00], xrf: 0.5, xrr: 0.66, xt: 0.78, tail: 0.98, tb: 0.38, roofW: 0.68, door: 4, fn: 0.86, fr: 0.9, rnd: 1.0, scoop: true },
  },
  pickup: {
    name: 'Picape 4x4 Diesel', sub: 'Picape cabine dupla (tipo Hilux)', cls: 'Picape',
    L: 5.30, W: 1.86, H: 1.82, WB: 3.09, fo: 0.97, tF: 1.54, tR: 1.55, cgH: 0.72, mass: 2150, distF: 0.55, engX: -0.05, drvX: 1.3,
    drive: 'awd', eng: 'd-2.8', gb: '6at', fin: 3.70, cf: 0.0, dir: 'open', dc: 'locked', lowRange: true,
    tf: [265, 65, 17], tr: [265, 65, 17], comp: 'at', spr: [32, 36], arb: [14, 0], damp: [0.26, 0.55], trav: [0.15, 0.20],
    brk: { k: 1.2, bias: 0.65 }, cd: 0.42, A: 3.0, dfF: -0.05, dfR: -0.05, steer: 0.60, ack: 0.9, camber: [-0.3, 0], toe: [0.08, 0.1],
    wheel: 'ten', color: '#d6d6d4', rimColor: '#2a2b2e', spoiler: 'none',
    shape: { nt: 1.00, nb: 0.46, hf: 1.08, xc: 0.31, belt: [1.22, 1.20], xrf: 0.4, xrr: 0.53, xt: 0.555, tail: 1.18, tb: 0.46, roofW: 0.72, door: 4, fn: 0.90, fr: 0.95, rnd: 1.0, bed: [0.56, 1.14] },
  },
  jeep: {
    name: 'Jipe Off-road', sub: 'Jipe 4x4 de chassi separado (tipo Wrangler)', cls: 'Off-road',
    L: 4.33, W: 1.88, H: 1.85, WB: 2.46, fo: 0.78, tF: 1.60, tR: 1.60, cgH: 0.74, mass: 2050, distF: 0.54, engX: -0.10, drvX: 0.9,
    drive: 'awd', eng: 'v6-3.5', gb: '8at', fin: 3.45, cf: 0.0, dir: 'locked', dif: 'open', dc: 'locked', lowRange: true,
    tf: [255, 75, 17], tr: [255, 75, 17], comp: 'at', spr: [30, 32], arb: [10, 0], damp: [0.24, 0.50], trav: [0.16, 0.22],
    brk: { k: 1.2, bias: 0.64 }, cd: 0.50, A: 3.1, dfF: -0.08, dfR: -0.08, steer: 0.62, ack: 0.9, camber: [0, 0], toe: [0.1, 0.1],
    wheel: 'beadlock', color: '#4a6a30', rimColor: '#1b1c1e', spoiler: 'none',
    shape: { nt: 1.02, nb: 0.46, hf: 1.04, xc: 0.31, belt: [1.04, 1.06], xrf: 0.37, xrr: 0.955, xt: 0.992, tail: 1.06, tb: 0.46, roofW: 0.92, door: 4, fn: 0.94, fr: 0.97, rnd: 1.5, boxy: true },
  },
  ev: {
    name: 'Elétrico Performance', sub: 'Sedã elétrico fastback de dois motores (tipo Model 3)', cls: 'Elétrico',
    L: 4.69, W: 1.85, H: 1.44, WB: 2.88, fo: 0.87, tF: 1.58, tR: 1.58, cgH: 0.47, mass: 1840, distF: 0.47, engX: 1.4, drvX: 1.05,
    drive: 'awd', eng: 'ev-2', gb: 'ev-1', fin: 1.0, cf: 0.5, dir: 'open', dc: 'open',
    tf: [235, 40, 19], tr: [235, 40, 19], comp: 'sport', spr: [30, 28], arb: [20, 12], damp: [0.32, 0.62], trav: [0.10, 0.13],
    brk: { k: 1.3, bias: 0.60 }, cd: 0.23, A: 2.22, dfF: -0.02, dfR: 0.02, steer: 0.58, ack: 0.9, camber: [-0.9, -1.2], toe: [0.04, 0.1],
    wheel: 'turbo', color: '#c8c8cc', rimColor: '#1a1b1e', spoiler: 'lip',
    shape: { nt: 0.60, nb: 0.28, hf: 0.68, xc: 0.345, belt: [0.92, 0.98], xrf: 0.5, xrr: 0.7, xt: 0.9, tail: 0.96, tb: 0.34, roofW: 0.68, door: 4, fn: 0.86, fr: 0.9, rnd: 1.15 },
  },
  fusca: {
    name: 'Clássico Boxer Traseiro', sub: 'Clássico dos anos 60 com motor traseiro refrigerado a ar (tipo Fusca)', cls: 'Clássico',
    L: 4.06, W: 1.54, H: 1.50, WB: 2.40, fo: 0.72, tF: 1.31, tR: 1.35, cgH: 0.50, mass: 830, distF: 0.42, engX: 2.65, drvX: 0.85,
    drive: 'rwd', eng: 'vw-1.6', gb: '4mt', fin: 4.375, dir: 'open',
    tf: [165, 80, 15], tr: [165, 80, 15], comp: 'eco', spr: [15, 17], arb: [0, 0], damp: [0.22, 0.45], trav: [0.12, 0.15],
    brk: { k: 0.85, bias: 0.62 }, cd: 0.48, A: 1.95, dfF: -0.03, dfR: -0.04, steer: 0.64, ack: 1.0, camber: [0.2, -1.5], toe: [0.1, 0.1],
    wheel: 'steel', color: '#2b6a4a', rimColor: '#d9d9d0', spoiler: 'none',
    shape: { nt: 0.70, nb: 0.38, hf: 0.80, xc: 0.27, belt: [0.88, 0.90], xrf: 0.4, xrr: 0.6, xt: 0.8, tail: 0.74, tb: 0.38, roofW: 0.80, door: 2, fn: 0.80, fr: 0.80, rnd: 2.2, beetle: true },
  },
};

export const MAPS = {
  campo:  { name: 'Campo de Provas', desc: 'Pista plana, arrancada de 400 m, skidpad, slalom, rampas, muros de colisão e trecho off-road' },
  serra:  { name: 'Serra do Rio', desc: 'Estrada de montanha sinuosa de ~5 km com curvas fechadas, guard-rails e desfiladeiros' },
  deserto:{ name: 'Deserto & Rochas', desc: 'Dunas de areia, estradas de terra, leito de rio seco, lama e área de rock-crawling' },
  real:   { name: 'Mundo Real (OpenStreetMap)', desc: 'Desenhe uma área em qualquer lugar do mundo e dirija nela: ruas, prédios, água, parques e relevo reais (dados gratuitos do OpenStreetMap)' },
  autodromo: { name: 'Autódromo', desc: 'Circuito de corrida com zebras, áreas de escape de brita e cronômetro de volta' },
};

export const TIMES = {
  dia:    { name: 'Dia claro', sky: [0x3a78c8, 0xbcd8f0], sun: [1.0, 0.96, 0.88], sunI: 3.0, amb: 0.55, dir: [0.5, 0.75, 0.35], fog: 0xbcd0e6, exp: 0.95, night: false },
  tarde:  { name: 'Pôr do sol', sky: [0x2c4a86, 0xf2a460], sun: [1.0, 0.62, 0.34], sunI: 2.4, amb: 0.40, dir: [0.9, 0.22, 0.30], fog: 0xe0a070, exp: 0.9, night: false },
  nublado:{ name: 'Nublado', sky: [0x70808f, 0xb4bcc4], sun: [0.8, 0.82, 0.86], sunI: 1.2, amb: 0.85, dir: [0.3, 0.8, 0.2], fog: 0xaab2ba, exp: 0.95, night: false },
  noite:  { name: 'Noite', sky: [0x02040a, 0x0a1426], sun: [0.45, 0.55, 0.85], sunI: 0.55, amb: 0.30, dir: [-0.4, 0.6, 0.5], fog: 0x070d18, exp: 1.45, night: true },
};

// pneu: dimensões em metros
export function tireDims(w, a, r) {
  const side = w * a / 100 / 1000;
  const R = r * 0.0254 / 2 + side;
  return { w: w / 1000, R, rim: r * 0.0254 / 2, side };
}
