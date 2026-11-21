// ============================================================
//  Mundo Real: converte dados do OpenStreetMap + elevação em um mapa 3D dirigível
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURF, clamp } from './data.js';
import { World, Paint, makeTex, rnd } from './world.js';
import { terrainColor, pineSet } from './maps.js';
import { addStreetDetails, offsetPts, hasSidewalk, along } from './streetdecor.js';

const DRIVE = { motorway: 7, motorway_link: 5, trunk: 7, trunk_link: 5, primary: 5.5, primary_link: 4, secondary: 5, secondary_link: 4, tertiary: 4.5, tertiary_link: 3.5, residential: 3.8, unclassified: 3.8, living_street: 3.2, service: 2.6, road: 3.5 };
const OFFROAD = { track: 2.4, path: 1.0, cycleway: 1.3, footway: 1.0, pedestrian: 3.0, steps: 1.0 };

function inPoly(x, z, p) {
  let c = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, zi] = p[i], [xj, zj] = p[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
  }
  return c;
}

// telhado de duas águas (cumeeira ao longo do lado maior) em coordenadas do mundo
const ROOFC = [[0.62, 0.29, 0.19], [0.55, 0.3, 0.22], [0.48, 0.24, 0.16], [0.42, 0.42, 0.45], [0.66, 0.34, 0.22], [0.36, 0.2, 0.15]];
function roofGeo(cu, cv, ca, sa, hu, hv, y0, R) {
  const along = hu >= hv, a = along ? hu : hv, b = along ? hv : hu, o = 0.35, rh = Math.min(2.8, Math.min(a, b) * 0.5);
  const P = (l, y, m) => { const u = along ? l : m, v = along ? m : l, uu = cu + u, vv = cv + v; return [uu * ca - vv * sa, y, uu * sa + vv * ca]; };
  const pos = [];
  const tri = (A, Bv, C, out) => { const e1 = [Bv[0] - A[0], Bv[1] - A[1], Bv[2] - A[2]], e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]; const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) pos.push(...A, ...C, ...Bv); else pos.push(...A, ...Bv, ...C); };
  const L1 = a + o, B1 = b + o, y1 = y0 + rh;
  const e = (l, m) => P(l, y0, m), r = l => P(l, y1, 0);
  // outward em coordenadas do mundo (aproximado pelo ponto médio relativo ao centro)
  const ctr = P(0, y0, 0), outv = (pt) => [pt[0] - ctr[0], pt[1] - ctr[1] + 0.3, pt[2] - ctr[2]];
  const quad = (p1, p2, p3, p4) => { const m = [(p1[0] + p2[0] + p3[0] + p4[0]) / 4, (p1[1] + p2[1] + p3[1] + p4[1]) / 4, (p1[2] + p2[2] + p3[2] + p4[2]) / 4], ov = outv(m); tri(p1, p2, p3, ov); tri(p1, p3, p4, ov); };
  quad(e(-L1, B1), e(L1, B1), r(L1), r(-L1));
  quad(e(-L1, -B1), e(L1, -B1), r(L1), r(-L1));
  tri(e(L1, -B1), e(L1, B1), r(L1), outv(P(L1, y0, 0)));
  tri(e(-L1, -B1), e(-L1, B1), r(-L1), outv(P(-L1, y0, 0)));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const n = pos.length / 3, c = ROOFC[(R() * ROOFC.length) | 0], arr = new Float32Array(n * 3), uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2]; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

export function buildRealWorld(D) {
  const w = new World('real');
  const RW = D.size.w, RH = D.size.h;
  const size = Math.ceil((Math.max(RW, RH) + 240) / 8) * 8;
  w.initGrid(size, 4, 2);
  const NS = w.NS, sc = w.sc, x0 = w.x0, z0 = w.z0, S = w.S;
  S.fill(3);
  const cell = (x, z) => { const i = Math.floor((x - x0) / sc), j = Math.floor((z - z0) / sc); return (i < 0 || j < 0 || i >= NS || j >= NS) ? -1 : j * NS + i; };
  const fillPoly = (pts, id) => {
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
    for (const [x, z] of pts) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, z); d = Math.max(d, z); }
    for (let z = b; z <= d; z += sc * 0.5) for (let x = a; x <= c; x += sc * 0.5) { if (inPoly(x, z, pts)) { const k = cell(x, z); if (k >= 0) S[k] = id; } }
  };
  const stamp = (pts, hw, id) => {
    for (let s = 0; s < pts.length - 1; s++) {
      const [ax, az] = pts[s], [bx, bz] = pts[s + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / (sc * 0.5)));
      for (let t = 0; t <= n; t++) {
        const x = ax + (bx - ax) * t / n, z = az + (bz - az) * t / n;
        for (let dz = -hw; dz <= hw; dz += sc * 0.5) for (let dx = -hw; dx <= hw; dx += sc * 0.5) if (dx * dx + dz * dz <= hw * hw) { const k = cell(x + dx, z + dz); if (k >= 0) S[k] = id; }
      }
    }
  };
  // ordem de prioridade: verde < areia < água < prédios < ruas
  for (const g of D.greens) fillPoly(g.pts, g.kind === 'sand' ? 4 : 3);
  for (const wt of D.waters) { if (wt.poly) fillPoly(wt.pts, 9); else stamp(wt.pts, wt.w / 2, 9); }
  for (const b of D.buildings) fillPoly(b.pts, 1);
  const bmask = new Uint8Array(S.length); for (let i = 0; i < S.length; i++) bmask[i] = S[i] === 1 ? 1 : 0;
  for (const r of D.roads) if (hasSidewalk(r)) for (const sg of [-1, 1]) stamp(offsetPts(r.pts, sg * (r.w / 2 + 1.3)), 1.0, 1);
  const roads = D.roads.filter(r => r.pts.length > 1);
  for (const r of roads) stamp(r.pts, r.w / 2, r.off ? (r.type === 'track' ? 2 : 5) : (r.type === 'pedestrian' ? 1 : 0));

  // ---- perfil suave das ruas: o terreno é nivelado ao longo (e através) da pista => asfalto reto e liso ----
  const samp = [], gridR = new Map(), CR = 16;
  for (const r of roads) {
    if (r.pts.length < 2 || (r.off && r.w < 2.2)) continue;
    const pts = [r.pts[0]]; along(r.pts, 4, (x, z) => pts.push([x, z])); pts.push(r.pts[r.pts.length - 1]);
    let ys = pts.map(([x, z]) => D.elev(x, z) - D.base);
    for (let pass = 0; pass < 4; pass++) { const t = ys.slice(); for (let i = 0; i < ys.length; i++) { let sum = 0, c = 0; for (let k = -4; k <= 4; k++) { const j = i + k; if (j >= 0 && j < ys.length) { sum += ys[j]; c++; } } t[i] = sum / c; } ys = t; }
    const hwE = r.w / 2 + (r.off ? 0.6 : hasSidewalk(r) ? 2.6 : 1.0);
    pts.forEach(([x, z], i) => { const o = { x, z, y: ys[i], hw: hwE }; samp.push(o); const key = Math.floor(x / CR) * 20011 + Math.floor(z / CR); (gridR.get(key) || gridR.set(key, []).get(key)).push(o); });
  }
  const roadAt = (x, z) => {
    let best = null, bv = 1e9; const cx = Math.floor(x / CR), cz = Math.floor(z / CR);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = gridR.get((cx + i) * 20011 + (cz + j)); if (a) for (const o of a) { const d = Math.hypot(o.x - x, o.z - z) - o.hw; if (d < bv) { bv = d; best = o; } } }
    return best ? { y: best.y, d: bv } : null;
  };
  w.genTerrain((x, z) => {
    let h = D.elev(x, z) - D.base;
    const rd = roadAt(x, z);
    if (rd && rd.d < 3.5) { const t = rd.d <= 0 ? 0 : Math.min(1, rd.d / 3.5), e = t * t * (3 - 2 * t); return rd.y + (h - rd.y) * e; }
    const k = w.S[clamp(Math.floor((z - z0) / sc), 0, NS - 1) * NS + clamp(Math.floor((x - x0) / sc), 0, NS - 1)];
    if (k === 9) h -= 1.3;
    return h;
  });
  w.buildTerrainMesh((x, z, h, s, ny, out) => { terrainColor(x, z, h, s, ny, out); if (s === 9) { out[0] = 0.10; out[1] = 0.28; out[2] = 0.42; } if (s === 1) { out[0] = out[1] = out[2] = 0.5; } }, 0.12);

  // ---- asfalto: textura com trilhas de roda, bordas, remendos e rachaduras; faixa contínua com UV ao longo da via ----
  const makeRoadTex = (lanes) => {
    const SZ = 256, cv = document.createElement('canvas'); cv.width = cv.height = SZ; const g = cv.getContext('2d'), img = g.createImageData(SZ, SZ), d = img.data;
    const h2 = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
    for (let y = 0; y < SZ; y++) for (let x = 0; x < SZ; x++) {
      const u = x / SZ; let v = 66 + (h2(x, y) - 0.5) * 16 + (h2((x >> 2) + 99, (y >> 2) + 7) - 0.5) * 8 + (h2((x >> 4) + 5, (y >> 4) + 31) - 0.5) * 7;
      for (let l = 0; l < lanes; l++) { const c = (l + 0.5) / lanes, o = 0.17 / lanes; v -= 8 * (Math.exp(-(((u - c + o) / (0.05 / lanes * 2)) ** 2)) + Math.exp(-(((u - c - o) / (0.05 / lanes * 2)) ** 2))); }
      if (u < 0.03 || u > 0.97) v -= 9;
      const i = (y * SZ + x) * 4; d[i] = v; d[i + 1] = v; d[i + 2] = v + 3; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const rr = (a) => Math.abs(Math.sin(a * 12.9898) * 43758.5453) % 1;
    g.strokeStyle = 'rgba(16,16,18,0.5)'; g.lineWidth = 1;
    for (let k = 0; k < 7; k++) { let px = rr(k + lanes) * SZ, py = rr(k * 3 + 1) * SZ; g.beginPath(); g.moveTo(px, py); for (let j = 0; j < 7; j++) { px += (rr(k * 11 + j) - 0.5) * 34; py += (rr(k * 7 + j + 3) - 0.3) * 24; g.lineTo(px, py); } g.stroke(); }
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(36,36,40,0.2)'; g.fillRect(rr(k * 5 + 2) * 200, rr(k * 9 + 4) * 190, 28 + rr(k) * 40, 40 + rr(k + 7) * 50); }
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  };
  const strips = (list, mode) => {
    const pos = [], uv = [], idx = [];
    for (const r of list) {
      const p = r.pts, hw = r.w / 2, base = pos.length / 3, lift = r.off ? 0.03 : 0.05, tile = Math.max(5, r.w * 1.2); let sAcc = 0;
      for (let i = 0; i < p.length; i++) {
        if (i > 0) sAcc += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
        const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
        let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
        for (const sg of [-1, 1]) {
          const x = p[i][0] - tz * hw * sg, z = p[i][1] + tx * hw * sg;
          pos.push(x, w.heightAt(x, z) + lift, z); if (mode === 'asphalt') uv.push(sg < 0 ? 0 : 1, sAcc / tile); else uv.push(x * 0.12, z * 0.12);
        }
        if (i < p.length - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
      }
    }
    if (!pos.length) return null;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals(); return g;
  };
  w.roadMats = [];
  const addRoad = (g, mat) => { if (!g) return; mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; w.group.add(m); w.roadMats.push(mat); w.roadMat = w.roadMats[0]; };
  const car = roads.filter(r => !r.off && r.type !== 'pedestrian'), wide = car.filter(r => r.w >= 9), norm = car.filter(r => r.w < 9);
  addRoad(strips(norm, 'asphalt'), new THREE.MeshStandardMaterial({ map: makeRoadTex(2), roughness: 0.9 }));
  addRoad(strips(wide, 'asphalt'), new THREE.MeshStandardMaterial({ map: makeRoadTex(4), roughness: 0.9 }));
  const trk = roads.filter(r => r.off && r.type === 'track'), wlk = roads.filter(r => r.off && r.type !== 'track' || r.type === 'pedestrian');
  { const t = makeTex('asphalt', 256).clone(); t.needsUpdate = true; addRoad(strips(trk, 'world'), new THREE.MeshStandardMaterial({ map: t, color: 0xb08a5c, roughness: 1 })); addRoad(strips(wlk, 'world'), new THREE.MeshStandardMaterial({ map: t, color: 0xc4c4bc, roughness: 0.95 })); }
  addStreetDetails(w, D, roads, bmask);

  // prédios (malha única por lotes + colisões em caixas orientadas)
  const R = rnd(11), pal = [0xd8d0c4, 0xc8c0b4, 0xb8b4ac, 0xe0d8cc, 0xa8a8a8, 0xc4b8a4, 0xb0a090, 0xd0d4d8];
  // casas genéricas nos lotes vazios ao longo de ruas residenciais (opção do jogador)
  let nGen = 0;
  if (D.opts && D.opts.generic) {
    const RES = new Set(['residential', 'living_street', 'unclassified']), Rg = rnd(23);
    const cellOf = (x, z) => { const i = Math.floor((x - x0) / sc), j = Math.floor((z - z0) / sc); return (i < 0 || j < 0 || i >= NS || j >= NS) ? -1 : j * NS + i; };
    const blocked = (x, z) => { const k = cellOf(x, z); return k < 0 || bmask[k] === 1 || S[k] === 0 || S[k] === 9 || Math.abs(x) > RW / 2 - 6 || Math.abs(z) > RH / 2 - 6; };
    const mark = pts => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, z] of pts) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, z); d = Math.max(d, z); } for (let z = b; z <= d; z += sc * 0.5) for (let x = a; x <= c; x += sc * 0.5) if (inPoly(x, z, pts)) { const k = cellOf(x, z); if (k >= 0) { bmask[k] = 1; S[k] = 1; } } };
    for (const r of D.roads) {
      if (r.off || !RES.has(r.type) || r.pts.length < 2) continue;
      along(r.pts, 15, (x, z, tx, tz) => {
        for (const sg of [-1, 1]) {
          if (nGen >= 2500) return;
          const ww = 8 + Rg() * 4, dd = 8.5 + Rg() * 3.5, off = r.w / 2 + 6.4 + dd / 2, nx = -tz * sg, nz = tx * sg, cx = x + nx * off, cz = z + nz * off;
          const hx = ww / 2, hd = dd / 2;
          const corner = (a, b) => [cx + tx * a * hx + nx * b * hd, cz + tz * a * hx + nz * b * hd];
          const pts = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
          if (blocked(cx, cz) || pts.some(p => blocked(p[0], p[1]))) continue;
          const mid = [corner(0, -1.3), corner(0, 1.3), corner(-1.3, 0), corner(1.3, 0)];
          if (mid.some(p => blocked(p[0], p[1]))) continue;
          D.buildings.push({ pts, h: Rg() < 0.25 ? 6.6 : 3.5 + Rg() * 0.5, gen: true }); mark(pts); nGen++;
        }
      });
    }
  }
  D.stats = Object.assign(D.stats || {}, { generic: nGen });
  const key = b => Math.floor(b.pts[0][0] / 110) * 10007 + Math.floor(b.pts[0][1] / 110);
  const blds = D.buildings.slice(0, 20000).sort((a, b) => key(a) - key(b));
  const COLL_R = 420, COLL_MAX = 1600; let ncoll = 0;
  const wcv = document.createElement('canvas'); wcv.width = wcv.height = 64; { const g = wcv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#7f8c99'; for (let y = 6; y < 64; y += 21) for (let x = 6; x < 64; x += 21) g.fillRect(x, y, 11, 12); }
  const wtex = new THREE.CanvasTexture(wcv); wtex.wrapS = wtex.wrapT = THREE.RepeatWrapping; wtex.colorSpace = THREE.SRGBColorSpace; wtex.repeat.set(1 / 3.4, 1 / 3.4); wtex.anisotropy = 4;
  let batch = [], lastKey = null;
  const flush = () => {
    if (!batch.length) return;
    const g = mergeGeometries(batch, false); batch.forEach(b => b.dispose()); batch = [];
    if (!g) return;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: wtex, roughness: 0.85, metalness: 0.02 }));
    m.castShadow = m.receiveShadow = true; w.group.add(m);
  };
  for (const b of blds) {
    const kk = key(b); if (lastKey !== null && kk !== lastKey) flush(); lastKey = kk;
    try {
      const pts = b.pts.slice(); if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      if (pts.length < 3) continue;
      let lo = 1e9, hi = -1e9;
      for (const [x, z] of pts) { const h = w.heightAt(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
      const H = b.h, depth = H + (hi - lo) + 0.5;
      const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
      const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, steps: 1 });
      g.rotateX(-Math.PI / 2); g.translate(0, lo - 0.5, 0);
      const c = new THREE.Color(pal[(R() * pal.length) | 0]).multiplyScalar(0.85 + R() * 0.25), n = g.attributes.position.count, arr = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      batch.push(g); if (batch.length >= 250) flush();
      let best = 0, ang = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], bb = pts[(i + 1) % pts.length], L = Math.hypot(bb[0] - a[0], bb[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(bb[1] - a[1], bb[0] - a[0]); } }
      const ca = Math.cos(ang), sa = Math.sin(ang); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const [x, z] of pts) { const u = x * ca + z * sa, v = -x * sa + z * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
      if ((u1 - u0) * (v1 - v0) < 420 && H <= 8 && (u1 - u0) > 3 && (v1 - v0) > 3) batch.push(roofGeo(cu, cv, ca, sa, (u1 - u0) / 2, (v1 - v0) / 2, lo - 0.5 + depth, R));
      if (ncoll >= COLL_MAX || Math.hypot(pts[0][0], pts[0][1]) > COLL_R) continue;   // longe do centro: só visual, sem colisão
      ncoll++;
      w.addBoxCol(cu * ca - cv * sa, lo + depth / 2 - 0.5, cu * sa + cv * ca, (u1 - u0) / 2, depth / 2, (v1 - v0) / 2, ang);
    } catch (e) { /* polígono inválido */ }
  }
  flush();

  // árvores em áreas verdes
  const trees = [];
  for (const g of D.greens) {
    if (g.kind !== 'forest' || trees.length > 500) continue;
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, z] of g.pts) { a = Math.min(a, x); c = Math.max(c, x); b = Math.min(b, z); d = Math.max(d, z); }
    const area = (c - a) * (d - b), n = Math.min(120, Math.floor(area / 600));
    for (let k = 0; k < n * 3 && trees.length < 600; k++) { const x = a + R() * (c - a), z = b + R() * (d - b); if (inPoly(x, z, g.pts) && w.surfAt(x, z) === 3) trees.push([x, z]); }
  }
  for (const [x, z] of D.trees || []) if (trees.length < 2500 && w.surfAt(x, z) !== 9) trees.push([x, z]);
  if (trees.length) pineSet(w, trees);

  // ponto de partida: via carro mais próxima do centro
  let best = 1e9, sp = null;
  for (const r of D.roads) { if (r.off || r.pts.length < 2 || r.w < 3.2) continue; for (let i = 0; i < r.pts.length - 1; i++) { const m = [(r.pts[i][0] + r.pts[i + 1][0]) / 2, (r.pts[i][1] + r.pts[i + 1][1]) / 2], d = Math.hypot(m[0], m[1]); if (d < best && Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]) > 8) { best = d; sp = { x: m[0], z: m[1], yaw: -Math.atan2(r.pts[i + 1][1] - r.pts[i][1], r.pts[i + 1][0] - r.pts[i][0]) }; } } }
  w.spawn = sp || { x: 0, z: 0, yaw: 0 };
  w.bx = RW / 2 - 2; w.bz = RH / 2 - 2;
  w.fogFar = 2200; w.name = 'Mundo Real — ' + (D.name || 'área escolhida'); w.stats = D.stats;
  return w;
}
