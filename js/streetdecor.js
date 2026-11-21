// Detalhes de rua do Mundo Real (visuais, sem colisão — exceto lombadas, que são físicas):
// faixas, linhas de retenção, faixas de pedestre, calçadas com meio-fio, postes, semáforos reais por
// aproximação (com braço sobre a pista), placas (PARE, preferência, velocidade, advertência...), pontos de
// ônibus, radares, lombadas, placas de nome de rua e árvores. Tudo vem dos dados reais do local.
import * as THREE from 'three';
import { Paint, rnd } from './world.js';
import { catTex, isCatalog, isWide, signFromTags } from './signs.js';

const TREE_ROADS = new Set(['residential', 'tertiary', 'unclassified', 'living_street', 'secondary']);
const LAMP_ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk', 'living_street']);
const SIDEWALK = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'trunk']);
export const LIMIT = { motorway: 80, trunk: 80, primary: 70, secondary: 60, tertiary: 50, unclassified: 40, residential: 30, living_street: 20, service: 20 };
const RANK = { motorway: 9, trunk: 8, primary: 7, secondary: 6, tertiary: 5, unclassified: 4, residential: 3, living_street: 2, service: 1 };

export function offsetPts(p, off) {
  const out = [];
  for (let i = 0; i < p.length; i++) {
    const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
    let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
    out.push([p[i][0] - tz * off, p[i][1] + tx * off]);
  }
  return out;
}
export const hasSidewalk = r => !r.off && SIDEWALK.has(r.type) && r.w >= 3.5;

export function along(pts, step, fn) {
  let acc = step * 0.5, k = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const tx = (bx - ax) / L, tz = (bz - az) / L;
    let d = 0;
    while (acc + (L - d) >= step) { d += step - acc; acc = 0; fn(ax + tx * d, az + tz * d, tx, tz, k++); }
    acc += L - d;
  }
}

// ---------- texturas ----------
function signTex(kind, text) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.translate(64, 64); g.textAlign = 'center'; g.textBaseline = 'middle';
  if (kind === 'stop') {
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); } g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(Math.cos(a) * 54, Math.sin(a) * 54); } g.closePath(); g.fillStyle = '#c4161c'; g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 34px Arial'; g.fillText('PARE', 0, 2);
  } else if (kind === 'yield') {
    g.beginPath(); g.moveTo(-60, -44); g.lineTo(60, -44); g.lineTo(0, 62); g.closePath(); g.fillStyle = '#c4161c'; g.fill();
    g.beginPath(); g.moveTo(-42, -32); g.lineTo(42, -32); g.lineTo(0, 40); g.closePath(); g.fillStyle = '#fff'; g.fill();
  } else if (kind === 'warn') {
    g.beginPath(); g.moveTo(0, -62); g.lineTo(62, 0); g.lineTo(0, 62); g.lineTo(-62, 0); g.closePath(); g.fillStyle = '#111'; g.fill();
    g.beginPath(); g.moveTo(0, -55); g.lineTo(55, 0); g.lineTo(0, 55); g.lineTo(-55, 0); g.closePath(); g.fillStyle = '#f7c80a'; g.fill();
    g.fillStyle = '#111'; g.font = 'bold 46px Arial'; g.fillText(text || '!', 0, 4);
  } else if (kind === 'noentry') {
    g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fillStyle = '#c4161c'; g.fill(); g.fillStyle = '#fff'; g.fillRect(-38, -9, 76, 18);
  } else if (kind === 'nopark') {
    g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fillStyle = '#c4161c'; g.fill(); g.beginPath(); g.arc(0, 0, 49, 0, 7); g.fillStyle = '#1b4fa8'; g.fill();
    g.strokeStyle = '#c4161c'; g.lineWidth = 11; g.beginPath(); g.moveTo(-34, -34); g.lineTo(34, 34); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 40px Arial'; g.fillText('E', 0, 3);
  } else if (kind === 'bus') {
    g.fillStyle = '#fff'; g.fillRect(-60, -60, 120, 120); g.fillStyle = '#1b4fa8'; g.fillRect(-54, -54, 108, 108); g.fillStyle = '#fff'; g.font = 'bold 22px Arial'; g.fillText('ÔNIBUS', 0, 30); g.font = 'bold 48px Arial'; g.fillText('🚌', 0, -14);
  } else {
    g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fillStyle = '#c4161c'; g.fill(); g.beginPath(); g.arc(0, 0, 45, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#111'; g.font = 'bold 50px Arial'; g.fillText(text, 0, 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function boardTex(lines, bg) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96; const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 96); g.fillStyle = bg; g.fillRect(5, 5, 246, 86);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const n = Math.min(2, lines.length);
  lines.slice(0, 2).forEach((t, i) => { let sz = 34; g.font = `bold ${sz}px Arial`; while (g.measureText(t).width > 228 && sz > 14) { sz -= 2; g.font = `bold ${sz}px Arial`; } g.fillText(t.toUpperCase(), 128, n === 1 ? 48 : 28 + i * 40); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function lightAtlas() {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 192; const g = cv.getContext('2d');
  const cols = ['#ff2a2a', '#ffc21a', '#2aff6a'];
  for (let s = 0; s < 3; s++) {
    g.fillStyle = '#0d0f11'; g.fillRect(s * 64 + 2, 2, 60, 188);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(s * 64 + 32, 34 + k * 62, 22, 0, 7); g.fillStyle = k === s ? cols[k] : '#202225'; g.fill(); if (k === s) { g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3; g.stroke(); } }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 3, 1); return t;
}

const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
function mat(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) { _e.set(0, ry, 0); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
function inst(w, geo, material, mats, colors) {
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, material, mats.length);
  mats.forEach((m, i) => { im.setMatrixAt(i, m); if (colors) im.setColorAt(i, colors[i]); });
  im.castShadow = true; im.receiveShadow = true; im.computeBoundingSphere(); w.group.add(im); return im;
}

export function addStreetDetails(w, D, roads, bmask) {
  const drive = roads.filter(r => !r.off && r.pts.length > 1);
  const R = rnd(17), P = new Paint(w), H = (x, z) => w.heightAt(x, z);
  const nodes = (D.nodes || []).slice();
  w.traffic = { rules: [], grid: new Map(), cell: 30, sig: (g, t) => { const k = (t + (g ? 0 : 10)) % 20; return k < 10 ? 2 : k < 12 ? 1 : 0; } };
  const addRule = (rec) => { rec.id = w.traffic.rules.length; w.traffic.rules.push(rec); const key = Math.floor(rec.x / 30) * 20011 + Math.floor(rec.z / 30); (w.traffic.grid.get(key) || w.traffic.grid.set(key, []).get(key)).push(rec); };
  const ruleAt = (a, type, grp) => addRule({ type, grp, x: a.x - a.tx * (a.w / 2 + 3.2), z: a.z - a.tz * (a.w / 2 + 3.2), tx: a.tx, tz: a.tz, w: a.w });

  // ---- marcações longitudinais ----
  for (const r of drive) {
    const p = r.pts, hw = r.w / 2;
    if (r.w >= 5.5) for (const sg of [-1, 1]) { const o = offsetPts(p, sg * (hw - 0.4)); for (let i = 0; i < o.length - 1; i++) P.line('#ececec', o[i][0], o[i][1], o[i + 1][0], o[i + 1][1], 0.15, 0.07); }
    if (r.w >= 9) for (const sg of [-1, 1]) { const o = offsetPts(p, sg * hw / 2); for (let i = 0; i < o.length - 1; i++) P.dashed('#ececec', o[i][0], o[i][1], o[i + 1][0], o[i + 1][1], 0.13, 3, 6, 0.07); }
    if (r.w >= 5 && !r.oneway) for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1]; if (Math.hypot(bx - ax, bz - az) > 2) P.dashed('#f2d24a', ax, az, bx, bz, 0.15, 3.5, 5.5, 0.07); }
  }
  // ---- topologia real: de cada nó, as vias (com sentido) que chegam nele ----
  const nodeWay = new Map();
  for (const r of drive) if (r.ids) r.ids.forEach((id, i) => { if (i < r.pts.length) (nodeWay.get(id) || nodeWay.set(id, []).get(id)).push({ r, i }); });
  const segs = [];
  for (const r of drive) for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L > 1) segs.push([ax, az, bx, bz, (bx - ax) / L, (bz - az) / L, r.w, L, r]); }
  const nearest = (x, z, maxD) => {
    let best = null, bd = maxD * maxD;
    for (const s of segs) { const dx = x - s[0], dz = z - s[1], t = Math.max(0, Math.min(s[7], dx * s[4] + dz * s[5])), px = s[0] + s[4] * t, pz = s[1] + s[5] * t, d = (x - px) ** 2 + (z - pz) ** 2; if (d < bd) { bd = d; best = { x: px, z: pz, tx: s[4], tz: s[5], w: s[6], r: s[8] }; } }
    return best;
  };
  // aproximações (sentidos de chegada) ao nó
  const approaches = (n) => {
    const out = [], list = nodeWay.get(n.id);
    if (list) for (const { r, i } of list) {
      const p = r.pts;
      if (i > 0) { const a = p[i - 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ x: b[0], z: b[1], tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L, w: r.w, r, i, fwd: true }); }
      if (i < p.length - 1 && !r.oneway) { const a = p[i + 1], b = p[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; out.push({ x: b[0], z: b[1], tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L, w: r.w, r, i, fwd: false }); }
    }
    if (!out.length) { const c = nearest(n.x, n.z, 16); if (c) { out.push({ x: c.x, z: c.z, tx: c.tx, tz: c.tz, w: c.w, r: c.r, fwd: true }, { x: c.x, z: c.z, tx: -c.tx, tz: -c.tz, w: c.w, r: c.r, fwd: false }); } }
    const dir = n.tags && (n.tags.direction || n.tags['traffic_signals:direction']);
    if (dir === 'forward') return out.filter(a => a.fwd);
    if (dir === 'backward') return out.filter(a => !a.fwd);
    return out;
  };
  // ---- sinalização genérica nos cruzamentos sem dados (opção): semáforo entre vias principais, PARE/preferência nas demais ----
  if (D.opts && D.opts.genericSigns) {
    const real = nodes.filter(n => n.k === 'traffic_signals' || n.k === 'stop' || n.k === 'give_way' || (n.tags && /stop|yield|give/i.test(n.tags.traffic_sign || '')));
    const gen = [];
    for (const [id, list] of nodeWay) {
      const p0 = list[0].r.pts[list[0].i], legs = list.reduce((s, e) => s + (e.i > 0 ? 1 : 0) + (e.i < e.r.pts.length - 1 ? 1 : 0), 0);
      if (legs < 3 || real.some(n => Math.hypot(n.x - p0[0], n.z - p0[1]) < 22) || gen.some(g => Math.hypot(g.x - p0[0], g.z - p0[1]) < 22)) continue;
      const ranks = list.map(e => RANK[e.r.type] || 0), mx = Math.max(...ranks), major = list.filter(e => (RANK[e.r.type] || 0) >= 6).length;
      const lower = ranks.some(r => r < mx), stems = list.some(e => e.i === 0 || e.i === e.r.pts.length - 1);
      const k = (mx >= 6 && major >= 2 && legs >= 4) ? 'traffic_signals' : (lower || stems) ? 'stop' : 'give_way';
      gen.push({ id, k, x: p0[0], z: p0[1], tags: {}, generic: true });
    }
    for (const g of gen) nodes.push(g);
  }
  const stopLine = (a) => { // linha de retenção na pista da direita antes do cruzamento
    const nx = -a.tz, nz = a.tx, hw = a.w / 2, bx = a.x - a.tx * (hw + 3.2), bz = a.z - a.tz * (hw + 3.2), half = a.r.oneway ? hw : hw * 0.5;
    P.quad('#f4f4f4', [[bx + nx * 0.1, bz + nz * 0.1], [bx + nx * half * 0.96, bz + nz * half * 0.96], [bx + nx * half * 0.96 + a.tx * 0.45, bz + nz * half * 0.96 + a.tz * 0.45], [bx + a.tx * 0.45 + nx * 0.1, bz + a.tz * 0.45 + nz * 0.1]], 0.075);
  };
  const zebra = (c) => {
    const nx = -c.tz, nz = c.tx, hw = c.w / 2;
    for (let k = -3; k <= 3; k++) { const ox = c.x + c.tx * k * 0.95, oz = c.z + c.tz * k * 0.95, a = 0.25;
      P.quad('#f4f4f4', [[ox - c.tx * a + nx * hw, oz - c.tz * a + nz * hw], [ox + c.tx * a + nx * hw, oz + c.tz * a + nz * hw], [ox + c.tx * a - nx * hw, oz + c.tz * a - nz * hw], [ox - c.tx * a - nx * hw, oz - c.tz * a - nz * hw]], 0.075); }
  };

  // ---- faixas de pedestre e linhas de retenção ----
  const placedZ = [];
  for (const n of nodes) if (n.k === 'crossing' || n.k === 'traffic_signals') {
    const apps = approaches(n); if (!apps.length) continue; const c = apps[0];
    if (!placedZ.some(q => Math.hypot(q[0] - c.x, q[1] - c.z) < 11)) { zebra(c); placedZ.push([c.x, c.z]); }
    if (n.k === 'traffic_signals') for (const a of apps) stopLine(a);
  }
  P.build(w.group);

  // ---- calçadas com meio-fio: interrompidas onde outra via cruza (esquinas limpas) ----
  { const pos = [], idx = [], col = [], cT = new THREE.Color(0.62, 0.62, 0.6), cC = new THREE.Color(0.42, 0.42, 0.41), SH = 0.13, CL = 20;
    const sgrid = new Map();
    for (const q of segs) { const m = q[6] / 2 + 1.2, x0 = Math.floor((Math.min(q[0], q[2]) - m) / CL), x1 = Math.floor((Math.max(q[0], q[2]) + m) / CL), z0 = Math.floor((Math.min(q[1], q[3]) - m) / CL), z1 = Math.floor((Math.max(q[1], q[3]) + m) / CL);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const k = i * 20011 + j; (sgrid.get(k) || sgrid.set(k, []).get(k)).push(q); } }
    const blocked = (x, z, self) => { const l = sgrid.get(Math.floor(x / CL) * 20011 + Math.floor(z / CL)); if (!l) return false;
      for (const q of l) { if (q[8] === self) continue; const dx = x - q[0], dz = z - q[1], t = Math.max(0, Math.min(q[7], dx * q[4] + dz * q[5])), px = q[0] + q[4] * t, pz = q[1] + q[5] * t; if ((x - px) ** 2 + (z - pz) ** 2 < (q[6] / 2 + 0.9) ** 2) return true; } return false; };
    const emit = (run) => {
      if (run.length < 2) return; const base = pos.length / 3;
      for (let i = 0; i < run.length; i++) { const [ax, az, bx, bz] = run[i], ya = H(ax, az), yb = H(bx, bz);
        pos.push(ax, ya + SH, az, bx, yb + SH, bz, ax, ya + 0.04, az); col.push(cT.r, cT.g, cT.b, cT.r, cT.g, cT.b, cC.r, cC.g, cC.b);
        if (i < run.length - 1) { const k = base + i * 3; idx.push(k, k + 3, k + 1, k + 1, k + 3, k + 4); idx.push(k + 2, k + 5, k, k, k + 5, k + 3); } }
      // tampa da ponta (meio-fio fechado onde a calçada termina)
      for (const [e, flip] of [[0, false], [run.length - 1, true]]) { const k = base + e * 3; if (flip) idx.push(k, k + 1, k + 2); else idx.push(k, k + 2, k + 1); }
    };
    for (const r of drive) if (hasSidewalk(r)) for (const sg of [-1, 1]) {
      const hw = r.w / 2; let run = [];
      const dense = [r.pts[0]]; // pontos densos (2 m) com tangente
      const samples = []; { const first = r.pts[0], nx = r.pts[1]; let L = Math.hypot(nx[0] - first[0], nx[1] - first[1]) || 1; samples.push([first[0], first[1], (nx[0] - first[0]) / L, (nx[1] - first[1]) / L]); }
      along(r.pts, 2, (x, z, tx, tz) => samples.push([x, z, tx, tz]));
      { const e = r.pts[r.pts.length - 1], pv = r.pts[r.pts.length - 2], L = Math.hypot(e[0] - pv[0], e[1] - pv[1]) || 1; samples.push([e[0], e[1], (e[0] - pv[0]) / L, (e[1] - pv[1]) / L]); }
      for (const [x, z, tx, tz] of samples) {
        const o1 = sg * (hw + 0.3), o2 = sg * (hw + 2.3), ax = x - tz * o1, az = z + tx * o1, bx = x - tz * o2, bz = z + tx * o2;
        if (blocked(ax, az, r) || blocked(bx, bz, r)) { emit(run); run = []; } else run.push([ax, az, bx, bz]);
      }
      emit(run);
    }
    if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.95, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; m.frustumCulled = false; w.group.add(m); } }

  // ---- postes de luz ----
  const lampSpots = [];
  for (const n of nodes) if (n.k === 'street_lamp') { const c = nearest(n.x, n.z, 25); if (c) lampSpots.push([n.x, n.z, c.x - n.x, c.z - n.z]); }
  for (const r of drive) if (LAMP_ROADS.has(r.type) && r.w >= 4.5) { let side = 1; along(r.pts, 46, (x, z, tx, tz) => { side = -side; const nx = -tz * side, nz = tx * side, o = r.w / 2 + 1.3; if (lampSpots.length < 1100) lampSpots.push([x + nx * o, z + nz * o, -nx, -nz]); }); }
  { const pole = new THREE.CylinderGeometry(0.06, 0.09, 7.6, 8); pole.translate(0, 3.8, 0);
    const arm = new THREE.BoxGeometry(1.7, 0.07, 0.07); arm.translate(0.85, 0, 0); const head = new THREE.BoxGeometry(0.75, 0.1, 0.3); head.translate(1.55, -0.08, 0);
    const pm = [], am = [];
    for (const [x, z, dx, dz] of lampSpots) { if (bmask && bmask[Math.floor((z - w.z0) / w.sc) * w.NS + Math.floor((x - w.x0) / w.sc)]) continue; const y = H(x, z), ry = -Math.atan2(dz, dx); pm.push(mat(x, y, z)); am.push(mat(x, y + 7.5, z, ry)); }
    const metal = new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.6, metalness: 0.6 });
    inst(w, pole, metal, pm); inst(w, arm, metal, am);
    inst(w, head, new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 1.6 }), am); }

  // ---- semáforos reais: um conjunto por sentido de chegada, braço sobre a pista nas vias largas ----
  { const atlasA = lightAtlas(), atlasB = lightAtlas();
    const pole = new THREE.CylinderGeometry(0.055, 0.075, 6, 8); pole.translate(0, 3, 0);
    const arm = new THREE.BoxGeometry(1, 0.1, 0.1); arm.translate(0.5, 0, 0);
    const box = new THREE.BoxGeometry(0.36, 1.0, 0.3); const back = new THREE.BoxGeometry(0.62, 1.28, 0.04); back.translate(0, 0, -0.16);
    const visor = new THREE.BoxGeometry(0.3, 0.05, 0.16); visor.translate(0, 0.5, 0.18);
    const pl = new THREE.PlaneGeometry(0.31, 0.93); pl.translate(0, 0, 0.152);
    const poles = [], arms = [], heads = [], A = [], Bm = [], boards = [];
    let ns = 0;
    nodes.filter(n => n.k === 'traffic_signals').forEach(n => {
      const apps = approaches(n); let first = true;
      for (const a of apps) {
        const hw = a.w / 2, rx = -a.tz, rz = a.tx, mast = a.w >= 7;
        const px = a.x - a.tx * 2.2 + rx * (hw + 0.9), pz = a.z - a.tz * 2.2 + rz * (hw + 0.9), py = H(px, pz);
        const face = Math.atan2(-a.tx, -a.tz);
        const ang = Math.abs(Math.atan2(a.tz, a.tx)) % Math.PI, grp = ang < Math.PI / 4 || ang > 3 * Math.PI / 4;
        const addHead = (x, y, z) => { const m = mat(x, y, z, face); heads.push(m); (grp ? A : Bm).push(m); };
        ruleAt(a, 'signal', grp);
        poles.push(mat(px, py, pz));
        addHead(px - rx * 0.05, py + 3.3, pz - rz * 0.05);
        if (mast) { const L = hw * 0.85, ry = -Math.atan2(-rz, -rx); arms.push(mat(px, py + 5.6, pz, ry, L, 1, 1)); addHead(px - rx * L, py + 5.1, pz - rz * L); addHead(px - rx * L * 0.45, py + 5.1, pz - rz * L * 0.45); }
        else addHead(px, py + 5.0, pz);
        if (first && ns < 60) { const names = [...new Set(apps.map(q => q.r.name).filter(Boolean))].slice(0, 2); if (names.length) { boards.push({ x: px, y: py + 6.2, z: pz, ry: face, names }); ns++; } first = false; }
      }
    });
    const dk = new THREE.MeshStandardMaterial({ color: 0x111316, roughness: 0.6 });
    const pm = new THREE.MeshStandardMaterial({ color: 0x43474d, roughness: 0.6, metalness: 0.5 });
    inst(w, pole, pm, poles); inst(w, arm, pm, arms);
    inst(w, box, dk, heads); inst(w, back, dk, heads); inst(w, visor, dk, heads);
    inst(w, pl, new THREE.MeshBasicMaterial({ map: atlasA }), A); inst(w, pl, new THREE.MeshBasicMaterial({ map: atlasB }), Bm);
    const state = (t, ph) => { const k = (t + ph) % 20; return k < 10 ? 2 : k < 12 ? 1 : 0; };
    w.anim = (t) => { atlasA.offset.x = state(t, 0) / 3; atlasB.offset.x = state(t, 10) / 3; };
    const bg = new THREE.PlaneGeometry(1.5, 0.56);
    for (const b of boards) { const m = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ map: boardTex(b.names, '#0b5a34'), side: THREE.DoubleSide })); m.position.set(b.x, b.y, b.z); m.rotation.y = b.ry + Math.PI / 2; w.group.add(m); } }

  // ---- placas (reais do OSM + genéricas): instanciadas, uma textura por tipo de placa (mais de 100 tipos) ----
  { const poleG = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), poleM = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.5, metalness: 0.6 });
    const sqG = new THREE.PlaneGeometry(0.78, 0.78), wideG = new THREE.PlaneGeometry(1.5, 0.82), groups = new Map(), poleMats = [];
    let count = 0;
    const norm = (kind, txt) => { if (kind === 'speed') return 'v' + txt; if (kind === 'warn') return ({ '🏫': 'school', '🚶': 'pedCross' })[txt] || 'hazard'; return kind; };
    const put = (x, z, fx, fz, kind, txt = '', h = 2.15) => {
      if (count++ > 3500) return; let id = norm(kind, txt); if (!isCatalog(id)) id = 'hazard';
      const y = H(x, z), wide = isWide(id); poleMats.push(mat(x, y + 1.2, z));
      const key = id + '|' + (wide ? txt : ''); let gr = groups.get(key); if (!gr) groups.set(key, gr = { id, txt: wide ? txt : '', wide, mats: [] });
      gr.mats.push(mat(x + fx * 0.06, y + (wide ? 2.45 : h), z + fz * 0.06, Math.atan2(fx, fz)));
    };
    const place = (a, kind, txt, back = 3, hwx = 0.85) => { const hw = a.w / 2 + hwx; put(a.x - a.tx * back - a.tz * hw, a.z - a.tz * back + a.tx * hw, -a.tx, -a.tz, kind, txt); };
    const speedOf = t => { const m = String(t.maxspeed || t.traffic_sign || '').match(/(\d{2,3})/); const v = m ? +m[1] : 0; return v >= 20 && v <= 120 && v % 10 === 0 ? v : 0; };
    for (const n of nodes) {
      const t = n.tags || {}, ts = String(t.traffic_sign || '');
      const apps = approaches(n), rank = Math.max(0, ...apps.map(a => RANK[a.r.type] || 0));
      const stem = a => (a.fwd ? a.i === a.r.pts.length - 1 : a.i === 0);
      const allEq = apps.every(q => (RANK[q.r.type] || 0) === rank);
      const pick = t.direction || apps.length < 2 ? apps : allEq ? (apps.some(stem) && !apps.every(stem) ? apps.filter(stem) : apps) : apps.filter(a => (RANK[a.r.type] || 0) < rank);
      if (n.k === 'stop' || /stop|R-1\b/i.test(ts)) for (const a of pick) { place(a, 'stop'); stopLine(a); ruleAt(a, 'stop'); }
      else if (n.k === 'give_way' || /give_way|yield|R-2\b/i.test(ts)) for (const a of pick) { place(a, 'yield'); stopLine(a); ruleAt(a, 'yield'); }
      else if (/maxspeed|R-19/i.test(ts) || (t.maxspeed && n.k === 'sign')) { const v = speedOf(t); if (v) for (const a of apps.slice(0, 2)) place(a, 'speed', String(v)); }
      else if (n.k === 'bus_stop') {
        const a = apps[0]; if (!a) continue; const hw = a.w / 2 + 2.2, x = a.x - a.tz * hw, z = a.z + a.tx * hw, y = H(x, z); put(x, z, -a.tx, -a.tz, 'bus', '', 2.3);
        if (t.shelter === 'yes' || t.covered === 'yes') { const rf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.1, 1.5), new THREE.MeshStandardMaterial({ color: 0x2a6fb0, roughness: 0.5 })); rf.position.set(x + a.tx * 1.5, y + 2.5, z + a.tz * 1.5); rf.rotation.y = -Math.atan2(a.tz, a.tx); w.group.add(rf);
          for (const s of [-1, 1]) { const pst = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), poleM); pst.position.set(x + a.tx * (1.5 + s * 1.4), y + 1.25, z + a.tz * (1.5 + s * 1.4)); w.group.add(pst); } }
      } else if (n.k === 'speed_camera') {
        const a = apps[0]; if (!a) continue; const hw = a.w / 2 + 1.2, x = a.x - a.tz * hw, z = a.z + a.tx * hw, y = H(x, z);
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 4.5, 8), poleM); p.position.set(x, y + 2.25, z); w.group.add(p);
        const bx = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 0.9), new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.5 })); bx.position.set(x, y + 4.5, z); bx.rotation.y = Math.atan2(-a.tx, -a.tz); w.group.add(bx);
      } else {
        let sid = signFromTags(t);
        if (!sid && n.k === 'railway') sid = 'railGate';
        if (!sid && n.k === 'crossing' && /zebra|marked|uncontrolled/i.test(String(t.crossing || t.crossing_ref || ''))) sid = 'crosswalk';
        if (!sid && n.k === 'amenity') sid = ({ hospital: 'hospital', fuel: 'fuel', parking: 'park', taxi: 'taxi', charging_station: 'charge', police: 'police' })[t.amenity];
        if (!sid && (n.k === 'sign' || n.k === 'hazard')) sid = 'hazard';
        const a = apps[0]; if (sid && a) place(a, sid);
      }
    }
    // limites de velocidade das vias (início e a cada ~300 m); sinalização genérica usa o limite padrão do tipo de via
    for (const r of drive) { const ms = r.ms || ((D.opts && D.opts.genericSigns && r.w >= 3.5) ? LIMIT[r.type] : 0); if (!(ms >= 20 && ms <= 120)) continue;
      const v10 = Math.round(ms / 10) * 10;
      let dist = 0, nextAt = 0; for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az) || 1; if (dist >= nextAt) { place({ x: ax, z: az, tx: (bx - ax) / L, tz: (bz - az) / L, w: r.w }, 'speed', String(v10), -3, 0.9); nextAt = dist + 300; } dist += L; } }

    // ---- placas genéricas (opção): advertências de curva/cruzamento/semáforo, regulamentação e indicação por tipo de via ----
    if (D.opts && D.opts.genericSigns) {
      const rg = rnd(91);
      const POOL = {
        low: ['children', 'school', 'bumps', 'nostop', 'crosswalk', 'cyclists', 'park', 'twoway', 'narrow', 'pedCross', 'nohorn', 'novehicles', 'nobus', 'notruck', 'bikepath', 'camp', 'food', 'hotel', 'phone', 'info'],
        mid: ['pedCross', 'crosswalk', 'cyclists', 'nostop', 'busonly', 'park', 'hospital', 'fuel', 'taxi', 'noovertake', 'curves', 'uneven', 'roadworks', 'nouturn', 'noleft', 'noright', 'maxheight', 'maxweight', 'police', 'firstaid', 'tram', 'charge', 'nomoto', 'noped', 'notractor', 'noanimals'],
        high: ['noovertake', 'notruck', 'minspeed', 'priority', 'g_center', 'g_airport', 'g_highway', 'g_exit', 'g_city', 'g_port', 'g_univ', 'g_stadium', 'slippery', 'merge', 'wind', 'fog', 'descent', 'ascent', 'tunnel', 'queue', 'fuel', 'hospital', 'charge', 'highway', 'airportInfo', 'planes', 'rocks', 'gravel', 'ice', 'floods', 'ferry', 'nohazmat', 'endprio', 'cattle', 'deer', 'railNoGate', 'maxwidth', 'chains', 'horn'],
      };
      const tier = r => { const k = RANK[r.type] || 0; return k >= 7 ? 'high' : k >= 5 ? 'mid' : 'low'; };
      const curveSigns = (pts, w0) => {
        let last = -1e9, dist = 0;
        for (let i = 1; i < pts.length - 1; i++) {
          dist += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
          const ix = pts[i][0] - pts[i - 1][0], iz = pts[i][1] - pts[i - 1][1], ox = pts[i + 1][0] - pts[i][0], oz = pts[i + 1][1] - pts[i][1];
          const ang = Math.atan2(iz * ox - ix * oz, ix * ox + iz * oz);
          if (Math.abs(ang) < 0.55 || dist - last < 90) continue;
          // recua ~30 m ao longo da via
          let rem = 30, k = i, px = pts[i][0], pz = pts[i][1];
          while (k > 0 && rem > 0) { const L = Math.hypot(px - pts[k - 1][0], pz - pts[k - 1][1]); if (L >= rem) { const t = rem / L; px += (pts[k - 1][0] - px) * t; pz += (pts[k - 1][1] - pz) * t; rem = 0; } else { rem -= L; px = pts[k - 1][0]; pz = pts[k - 1][1]; k--; } }
          if (rem > 0) continue;
          const dx = pts[i][0] - px, dz = pts[i][1] - pz, L = Math.hypot(dx, dz) || 1;
          place({ x: px, z: pz, tx: dx / L, tz: dz / L, w: w0 }, ang > 0 ? 'curveL' : 'curveR', '', 0, 0.9); last = dist;
        }
      };
      for (const r of drive) {
        if (r.w < 3.2 || r.pts.length < 2) continue;
        curveSigns(r.pts, r.w); if (!r.oneway) curveSigns(r.pts.slice().reverse(), r.w);
        const T = POOL[tier(r)], every = tier(r) === 'high' ? 320 : tier(r) === 'mid' ? 240 : 170;
        along(r.pts, every, (x, z, tx, tz) => { if (rg() < 0.75) place({ x, z, tx, tz, w: r.w }, T[(rg() * T.length) | 0], '', 0, 0.9); });
        if (r.oneway) { const a = r.pts[0], b = r.pts[1], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; place({ x: a[0], z: a[1], tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L, w: r.w }, 'oneway', '', -2, 0.9); }
        // beco sem saída: o último ponto não liga a nenhuma outra via
        if (r.ids && r.ids.length > 2) { const e = r.pts.length - 1, ls = nodeWay.get(r.ids[e]); if (ls && ls.length === 1 && RANK[r.type] <= 3) { const a = r.pts[e - 1], b = r.pts[e], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; place({ x: b[0], z: b[1], tx: (b[0] - a[0]) / L, tz: (b[1] - a[1]) / L, w: r.w }, 'deadend', '', 12, 0.9); } }
      }
      // semáforo à frente (45 m antes de cada semáforo) e cruzamento à frente nas vias principais
      let nsa = 0;
      for (const n of nodes) {
        if (n.k === 'traffic_signals') { for (const a of approaches(n)) if (nsa++ < 260) place(a, 'signalsAhead', '', 45, 0.9); }
        else if (n.generic) { for (const a of approaches(n)) if ((RANK[a.r.type] || 0) >= 5 && nsa++ < 260) place(a, n.k === 'stop' || n.k === 'give_way' ? 'sideroad' : 'cross', '', 40, 0.9); }
      }
    }
    // instâncias
    inst(w, poleG, poleM, poleMats);
    for (const gr of groups.values()) inst(w, gr.wide ? wideG : sqG, new THREE.MeshStandardMaterial({ map: catTex(gr.id, gr.txt), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }), gr.mats);
    w.signKinds = groups.size;
  }

  // ---- lombadas (reais do OSM + genéricas): o perfil depende da velocidade permitida na via ----
  //  velocidade baixa => lombada curta e alta (arco estreito, bem dura); velocidade alta => arco longo e suave (mesa de velocidade)
  const bumpSpec = (kmh, kind) => {
    const v = kmh <= 25 ? 20 : kmh <= 35 ? 30 : kmh <= 45 ? 40 : kmh <= 55 ? 50 : kmh <= 65 ? 60 : 70;
    const P = { 20: { h: 0.12, L: 1.3, tab: 0 }, 30: { h: 0.10, L: 2.2, tab: 0 }, 40: { h: 0.09, L: 3.4, tab: 0 }, 50: { h: 0.085, L: 4.8, tab: 0 }, 60: { h: 0.09, L: 8, tab: 3 }, 70: { h: 0.08, L: 12, tab: 4.5 } }[v];
    if (kind === 'table' && !P.tab) return { h: Math.min(P.h, 0.10), L: Math.max(P.L, 6), tab: 1.6, v };
    return { ...P, v };
  };
  let nBump = 0;
  const addBump = (cx, cz, tx, tz, wRoad, kmh, kind) => {
    if (nBump >= 160) return; nBump++;
    const { h: hh, L: len, tab } = bumpSpec(kmh, kind), hw = wRoad / 2, nx = -tz, nz = tx, ext = len / 2 + hw + 3, half = kind === 'cushion' ? Math.min(hw, 0.95) : hw + 0.3;
    const prof = t => { const at = Math.abs(t); if (at > len / 2) return 0; if (tab) return hh * Math.min(1, (len / 2 - at) / tab); const u = at / (len / 2); return hh * Math.cos(u * Math.PI / 2) ** 1.25; };
    const fn = (x, z) => { const t = (x - cx) * tx + (z - cz) * tz, s = (x - cx) * nx + (z - cz) * nz; if (Math.abs(s) > half || Math.abs(t) > len / 2) return 0; const edge = Math.min(1, (half - Math.abs(s)) / 0.25); return prof(t) * edge; };
    w.feat.push({ x0: cx - ext, x1: cx + ext, z0: cz - ext, z1: cz + ext, fn: (px, pz, h) => h + fn(px, pz) });
    // pintura: faixas amarelas/pretas (mais faixas nas lombadas longas); mesas ganham triângulos de aviso nas rampas
    const pos = [], col = [], idx = [], NT = Math.max(6, Math.round(len / 0.45) | 0), NS2 = 6, yl = new THREE.Color(0.95, 0.78, 0.05), bk = new THREE.Color(0.06, 0.06, 0.07), wh = new THREE.Color(0.93, 0.93, 0.93);
    for (let i = 0; i <= NT; i++) for (let j = 0; j <= NS2; j++) { const t = (i / NT - 0.5) * len, s = (j / NS2 - 0.5) * (half * 2 - 0.2), x = cx + tx * t + nx * s, z = cz + tz * t + nz * s; pos.push(x, H(x, z) + 0.035, z); const onFlat = tab && Math.abs(t) < len / 2 - tab; const c = onFlat ? (j % 2 ? wh : bk) : ((i % 2) ? yl : bk); col.push(c.r, c.g, c.b); }
    for (let i = 0; i < NT; i++) for (let j = 0; j < NS2; j++) { const q = i * (NS2 + 1) + j; idx.push(q, q + NS2 + 1, q + 1, q + 1, q + NS2 + 1, q + NS2 + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); m.receiveShadow = true; w.group.add(m);
  };
  const roadKmh = r => r.ms || LIMIT[r.type] || 40;
  for (const n of nodes) {
    if (n.k !== 'calming') continue;
    const kind = n.tags.traffic_calming; if (!['bump', 'hump', 'table', 'cushion'].includes(kind)) continue;
    const a = approaches(n)[0]; if (!a) continue;
    addBump(n.x, n.z, a.tx, a.tz, a.w, roadKmh(a.r), kind);
  }
  if (D.opts && D.opts.genericSigns) {
    const rb = rnd(53), near = (x, z, R2) => nodes.some(n => (n.x - x) ** 2 + (n.z - z) ** 2 < R2);
    for (const r of drive) {
      const k = roadKmh(r); if (r.w < 3.2 || k > 50 || (RANK[r.type] || 0) > 4) continue;     // só ruas locais
      along(r.pts, k <= 30 ? 150 : 260, (x, z, tx, tz) => { if (rb() < 0.55 && !near(x, z, 20 * 20)) addBump(x, z, tx, tz, r.w, k, 'bump'); });
    }
    // vias coletoras/arteriais de 50-70 km/h: mesas longas e suaves nos cruzamentos de pedestre
    for (const r of drive) { const k = roadKmh(r); if (k < 50 || k > 70 || r.w < 3.5) continue; along(r.pts, 420, (x, z, tx, tz) => { if (rb() < 0.3 && !near(x, z, 25 * 25)) addBump(x, z, tx, tz, r.w, k, 'table'); }); }
  }

  w.bumpCount = nBump;

  // ---- árvores de calçada ----
  { const trunk = new THREE.CylinderGeometry(0.12, 0.18, 2.6, 6); trunk.translate(0, 1.3, 0);
    const crown = new THREE.IcosahedronGeometry(1.9, 1); crown.scale(1, 0.85, 1); crown.translate(0, 3.7, 0);
    const tm = [], cm = [], cc = [];
    for (const r of drive) if (TREE_ROADS.has(r.type) && r.w >= 3.5) { let side = 1; along(r.pts, 21, (x, z, tx, tz) => { side = -side; if (tm.length > 1400) return; const o = r.w / 2 + 3.0 + R() * 0.6, px = x - tz * side * o, pz = z + tx * side * o; if (bmask && bmask[Math.floor((pz - w.z0) / w.sc) * w.NS + Math.floor((px - w.x0) / w.sc)]) return; if (w.surfAt(px, pz) === 9) return; const y = H(px, pz), s = 0.8 + R() * 0.7; tm.push(mat(px, y, pz, R() * 6, s, s, s)); cm.push(mat(px, y, pz, R() * 6, s, s, s)); cc.push(new THREE.Color().setHSL(0.27 + R() * 0.08, 0.5, 0.22 + R() * 0.1)); }); }
    inst(w, trunk, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), tm);
    inst(w, crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), cm, cc); }
}
