// Detalhes de rua do Mundo Real (só visuais, sem colisão): faixas, calçadas, faixas de pedestre,
// postes, semáforos, placas de PARE / dê a preferência / velocidade e árvores de calçada.
import * as THREE from 'three';
import { Paint, rnd } from './world.js';

const TREE_ROADS = new Set(['residential', 'tertiary', 'unclassified', 'living_street', 'secondary']);
const LAMP_ROADS = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk', 'living_street']);
const SIDEWALK = new Set(['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'trunk']);

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

function signTex(kind, text) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.translate(64, 64);
  if (kind === 'stop') {
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); } g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(Math.cos(a) * 54, Math.sin(a) * 54); } g.closePath(); g.fillStyle = '#c4161c'; g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PARE', 0, 2);
  } else if (kind === 'yield') {
    g.beginPath(); g.moveTo(-60, -44); g.lineTo(60, -44); g.lineTo(0, 62); g.closePath(); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.moveTo(-46, -34); g.lineTo(46, -34); g.lineTo(0, 46); g.closePath(); g.lineWidth = 0; g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#c4161c'; g.lineWidth = 12; g.stroke();
  } else {
    g.beginPath(); g.arc(0, 0, 60, 0, 7); g.fillStyle = '#c4161c'; g.fill(); g.beginPath(); g.arc(0, 0, 45, 0, 7); g.fillStyle = '#fff'; g.fill();
    g.fillStyle = '#111'; g.font = 'bold 50px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 3);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

function lightAtlas() {
  const cv = document.createElement('canvas'); cv.width = 192; cv.height = 192; const g = cv.getContext('2d');
  const cols = ['#ff2a2a', '#ffc21a', '#2aff6a'];
  for (let s = 0; s < 3; s++) {
    g.fillStyle = '#101214'; g.fillRect(s * 64 + 2, 2, 60, 188);
    for (let k = 0; k < 3; k++) { g.beginPath(); g.arc(s * 64 + 32, 34 + k * 62, 22, 0, 7); g.fillStyle = k === s ? cols[k] : '#26282c'; g.fill(); }
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(1 / 3, 1); return t;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
function mat(x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) { _e.set(0, ry, 0); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
function inst(w, geo, material, mats, colors) {
  if (!mats.length) return null;
  const im = new THREE.InstancedMesh(geo, material, mats.length);
  mats.forEach((m, i) => { im.setMatrixAt(i, m); if (colors) im.setColorAt(i, colors[i]); });
  im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; w.group.add(im); return im;
}

export function addStreetDetails(w, D, roads, bmask) {
  const drive = roads.filter(r => !r.off && r.pts.length > 1);
  const R = rnd(17), P = new Paint(w);
  const H = (x, z) => w.heightAt(x, z);
  // ---- marcações ----
  for (const r of drive) {
    const p = r.pts, hw = r.w / 2;
    if (r.w >= 5.5) for (const sg of [-1, 1]) { const o = offsetPts(p, sg * (hw - 0.4)); for (let i = 0; i < o.length - 1; i++) P.line('#ececec', o[i][0], o[i][1], o[i + 1][0], o[i + 1][1], 0.15, 0.07); }
    if (r.w >= 9) for (const sg of [-1, 1]) { const o = offsetPts(p, sg * hw / 2); for (let i = 0; i < o.length - 1; i++) P.dashed('#ececec', o[i][0], o[i][1], o[i + 1][0], o[i + 1][1], 0.13, 3, 6, 0.07); }
    if (r.w >= 5 && !r.oneway) for (let i = 0; i < p.length - 1; i++) { const [ax, az] = p[i], [bx, bz] = p[i + 1]; if (Math.hypot(bx - ax, bz - az) > 2) P.dashed('#f2d24a', ax, az, bx, bz, 0.15, 3.5, 5.5, 0.07); }
  }
  // ---- segmentos para busca ----
  const segs = [];
  for (const r of drive) for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L > 1) segs.push([ax, az, bx, bz, (bx - ax) / L, (bz - az) / L, r.w, L]); }
  const nearest = (x, z, maxD) => {
    let best = null, bd = maxD * maxD;
    for (const s of segs) {
      const dx = x - s[0], dz = z - s[1], t = Math.max(0, Math.min(s[7], dx * s[4] + dz * s[5])), px = s[0] + s[4] * t, pz = s[1] + s[5] * t, d = (x - px) ** 2 + (z - pz) ** 2;
      if (d < bd) { bd = d; best = { x: px, z: pz, tx: s[4], tz: s[5], w: s[6] }; }
    }
    return best;
  };
  // ---- faixas de pedestre ----
  const zebra = (c) => {
    const nx = -c.tz, nz = c.tx, hw = c.w / 2;
    for (let k = -3; k <= 3; k++) { const ox = c.x + c.tx * k * 0.95, oz = c.z + c.tz * k * 0.95, a = 0.25;
      P.quad('#f4f4f4', [[ox - c.tx * a + nx * hw, oz - c.tz * a + nz * hw], [ox + c.tx * a + nx * hw, oz + c.tz * a + nz * hw], [ox + c.tx * a - nx * hw, oz + c.tz * a - nz * hw], [ox - c.tx * a - nx * hw, oz - c.tz * a - nz * hw]], 0.075); }
  };
  const nodes = D.nodes || [], placedZ = [];
  for (const n of nodes) if (n.k === 'crossing' || n.k === 'traffic_signals') { const c = nearest(n.x, n.z, 14); if (c && !placedZ.some(q => Math.hypot(q[0] - c.x, q[1] - c.z) < 11)) { zebra(c); placedZ.push([c.x, c.z]); } }
  P.build(w.group);

  // ---- calçadas: faixa clara ao lado das vias ----
  { const pos = [], idx = [], col = [], c = new THREE.Color(1.1, 1.1, 1.06);
    for (const r of drive) if (hasSidewalk(r)) for (const sg of [-1, 1]) {
      const a = offsetPts(r.pts, sg * (r.w / 2 + 0.3)), b = offsetPts(r.pts, sg * (r.w / 2 + 2.3)), base = pos.length / 3;
      for (let i = 0; i < a.length; i++) { pos.push(a[i][0], H(a[i][0], a[i][1]) + 0.08, a[i][1], b[i][0], H(b[i][0], b[i][1]) + 0.08, b[i][1]); col.push(c.r, c.g, c.b, c.r, c.g, c.b); if (i < a.length - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); } }
    }
    if (pos.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xc8c8c0, vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; m.frustumCulled = false; w.group.add(m); } }

  // ---- postes de luz ----
  const lampSpots = [];
  for (const n of nodes) if (n.k === 'street_lamp') { const c = nearest(n.x, n.z, 25); if (c) lampSpots.push([n.x, n.z, c.x - n.x, c.z - n.z]); }
  for (const r of drive) if (LAMP_ROADS.has(r.type) && r.w >= 4.5) { let side = 1; along(r.pts, 46, (x, z, tx, tz) => { side = -side; const nx = -tz * side, nz = tx * side, o = r.w / 2 + 1.3; if (lampSpots.length < 1100) lampSpots.push([x + nx * o, z + nz * o, -nx, -nz]); }); }
  { const pole = new THREE.CylinderGeometry(0.06, 0.09, 7.6, 8); pole.translate(0, 3.8, 0);
    const arm = new THREE.BoxGeometry(1.7, 0.07, 0.07); arm.translate(0.85, 0, 0); const head = new THREE.BoxGeometry(0.75, 0.1, 0.3); head.translate(1.55, -0.08, 0);
    const pm = [], am = [];
    for (const [x, z, dx, dz] of lampSpots) { if (bmask && bmask[Math.floor((z - w.z0) / w.sc) * w.NS + Math.floor((x - w.x0) / w.sc)]) continue; const y = H(x, z), ry = -Math.atan2(dz, dx); pm.push(mat(x, y, z)); am.push(mat(x, y + 7.5, z, ry)); }
    inst(w, pole, new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.6, metalness: 0.6 }), pm);
    inst(w, arm, new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 0.6, metalness: 0.6 }), am);
    inst(w, head, new THREE.MeshStandardMaterial({ color: 0xfff2c8, emissive: 0xffe9a8, emissiveIntensity: 1.6 }), am); }

  // ---- semáforos (duas fases cruzadas) ----
  { const atlasA = lightAtlas(), atlasB = lightAtlas();
    const pole = new THREE.CylinderGeometry(0.05, 0.06, 4.6, 8); pole.translate(0, 2.3, 0);
    const box = new THREE.BoxGeometry(0.34, 0.98, 0.3); box.translate(0, 4.15, 0);
    const pl = new THREE.PlaneGeometry(0.3, 0.9); pl.translate(0, 4.15, 0.16);
    const pm = [], A = [], Bm = [];
    nodes.filter(n => n.k === 'traffic_signals').forEach((n, ni) => {
      const c = nearest(n.x, n.z, 16); if (!c) return; const hw = c.w / 2 + 0.9;
      [[1, -1], [-1, 1]].forEach(([sg, face], di) => {
        const rx = -c.tz * sg, rz = c.tx * sg, x = c.x + rx * hw, z = c.z + rz * hw, y = H(x, z);
        const ry = Math.atan2(di ? c.tx : -c.tx, di ? c.tz : -c.tz);
        pm.push(mat(x, y, z, ry)); ((ni + di) % 2 ? A : Bm).push(mat(x, y, z, ry));
      });
    });
    const bm = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 });
    inst(w, pole, new THREE.MeshStandardMaterial({ color: 0x40444a, roughness: 0.6, metalness: 0.5 }), pm); inst(w, box, bm, pm);
    inst(w, pl, new THREE.MeshBasicMaterial({ map: atlasA }), A); inst(w, pl, new THREE.MeshBasicMaterial({ map: atlasB }), Bm);
    const state = (t, ph) => { const k = (t + ph) % 20; return k < 10 ? 2 : k < 12 ? 1 : 0; };
    w.anim = (t) => { atlasA.offset.x = state(t, 0) / 3; atlasB.offset.x = state(t, 10) / 3; }; }

  // ---- placas (PARE, dê a preferência, velocidade) ----
  { const poleG = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6), poleM = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.5, metalness: 0.6 });
    const cache = {}, planeG = new THREE.PlaneGeometry(0.78, 0.78);
    const mk = (kind, txt) => cache[kind + txt] || (cache[kind + txt] = new THREE.MeshStandardMaterial({ map: signTex(kind, txt), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6 }));
    let count = 0;
    const put = (x, z, fx, fz, kind, txt) => { if (count++ > 400) return; const y = H(x, z); const p = new THREE.Mesh(poleG, poleM); p.position.set(x, y + 1.2, z); w.group.add(p); const s = new THREE.Mesh(planeG, mk(kind, txt)); s.position.set(x + fx * 0.06, y + 2.15, z + fz * 0.06); s.rotation.y = Math.atan2(fx, fz); s.castShadow = true; w.group.add(s); };
    for (const n of nodes) if (n.k === 'stop' || n.k === 'give_way') { const c = nearest(n.x, n.z, 14); if (!c) continue; const hw = c.w / 2 + 0.8; put(c.x - c.tz * hw, c.z + c.tx * hw, -c.tx, -c.tz, n.k === 'stop' ? 'stop' : 'yield'); }
    for (const r of drive) if (r.ms && r.ms >= 20 && r.ms <= 120) { const p = r.pts, [ax, az] = p[0], [bx, bz] = p[1], L = Math.hypot(bx - ax, bz - az) || 1, tx = (bx - ax) / L, tz = (bz - az) / L, hw = r.w / 2 + 0.9; put(ax - tz * hw + tx * 3, az + tx * hw + tz * 3, -tx, -tz, 'speed', String(r.ms)); }
  }

  // ---- árvores de calçada ----
  { const trunk = new THREE.CylinderGeometry(0.12, 0.18, 2.6, 6); trunk.translate(0, 1.3, 0);
    const crown = new THREE.IcosahedronGeometry(1.9, 1); crown.scale(1, 0.85, 1); crown.translate(0, 3.7, 0);
    const tm = [], cm = [], cc = [];
    for (const r of drive) if (TREE_ROADS.has(r.type) && r.w >= 3.5) { let side = 1; along(r.pts, 21, (x, z, tx, tz) => { side = -side; if (tm.length > 1400) return; const o = r.w / 2 + 3.0 + R() * 0.6, px = x - tz * side * o, pz = z + tx * side * o; if (bmask && bmask[Math.floor((pz - w.z0) / w.sc) * w.NS + Math.floor((px - w.x0) / w.sc)]) return; if (w.surfAt(px, pz) === 9) return; const y = H(px, pz), s = 0.8 + R() * 0.7; tm.push(mat(px, y, pz, R() * 6, s, s, s)); cm.push(mat(px, y, pz, R() * 6, s, s, s)); cc.push(new THREE.Color().setHSL(0.27 + R() * 0.08, 0.5, 0.22 + R() * 0.1)); }); }
    inst(w, trunk, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), tm);
    inst(w, crown, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), cm, cc); }
}
