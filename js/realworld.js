// ============================================================
//  Mundo Real: converte dados do OpenStreetMap + elevação em um mapa 3D dirigível
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SURF, clamp } from './data.js';
import { World, Paint, makeTex, rnd } from './world.js';
import { terrainColor, pineSet } from './maps.js';

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
  const roads = D.roads.filter(r => r.pts.length > 1);
  for (const r of roads) stamp(r.pts, r.w / 2, r.off ? (r.type === 'track' ? 2 : 5) : (r.type === 'pedestrian' ? 1 : 0));

  // terreno a partir da elevação real
  w.genTerrain((x, z) => {
    let h = D.elev(x, z) - D.base;
    const k = w.S[clamp(Math.floor((z - z0) / sc), 0, NS - 1) * NS + clamp(Math.floor((x - x0) / sc), 0, NS - 1)];
    if (k === 9) h -= 1.3;
    return h;
  });
  w.buildTerrainMesh((x, z, h, s, ny, out) => { terrainColor(x, z, h, s, ny, out); if (s === 9) { out[0] = 0.10; out[1] = 0.28; out[2] = 0.42; } if (s === 1) { out[0] = out[1] = out[2] = 0.5; } }, 0.12);

  // ruas: faixa única com textura de asfalto
  const pos = [], uv = [], col = [], idx = [];
  const asphalt = new THREE.Color(0.62, 0.62, 0.64), dirt = new THREE.Color(1.5, 1.1, 0.8), walk = new THREE.Color(1.3, 1.3, 1.25);
  for (const r of roads) {
    const p = r.pts, hw = r.w / 2, base = pos.length / 3, c = r.off ? (r.type === 'track' ? dirt : walk) : (r.type === 'pedestrian' ? walk : asphalt);
    for (let i = 0; i < p.length; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      for (const sg of [-1, 1]) {
        const x = p[i][0] - tz * hw * sg, z = p[i][1] + tx * hw * sg;
        pos.push(x, w.heightAt(x, z) + (r.off ? 0.03 : 0.05), z); uv.push(x * 0.12, z * 0.12); col.push(c.r, c.g, c.b);
      }
      if (i < p.length - 1) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(pos.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals();
    const t = makeTex('asphalt', 256).clone(); t.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({ map: t, vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.frustumCulled = false; w.group.add(m); w.roadMat = mat;
  }
  // faixas centrais nas vias principais
  const P = new Paint(w);
  for (const r of roads) if (!r.off && r.w >= 5) for (let i = 0; i < r.pts.length - 1; i++) { const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1]; if (Math.hypot(bx - ax, bz - az) > 2) P.dashed('#f2d24a', ax, az, bx, bz, 0.16, 3, 5, 0.06); }
  P.build(w.group);

  // prédios (malha única por lotes + colisões em caixas orientadas)
  const R = rnd(11), pal = [0xd8d0c4, 0xc8c0b4, 0xb8b4ac, 0xe0d8cc, 0xa8a8a8, 0xc4b8a4, 0xb0a090, 0xd0d4d8];
  const blds = D.buildings.slice().sort((a, b) => Math.hypot(a.pts[0][0], a.pts[0][1]) - Math.hypot(b.pts[0][0], b.pts[0][1])).slice(0, 3500);
  let batch = [];
  const flush = () => {
    if (!batch.length) return;
    const g = mergeGeometries(batch, false); batch.forEach(b => b.dispose()); batch = [];
    if (!g) return;
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 }));
    m.castShadow = m.receiveShadow = true; m.frustumCulled = false; w.group.add(m);
  };
  for (const b of blds) {
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
      g.deleteAttribute('uv'); batch.push(g); if (batch.length >= 250) flush();
      // colisão: retângulo orientado pela maior aresta
      let best = 0, ang = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], bb = pts[(i + 1) % pts.length], L = Math.hypot(bb[0] - a[0], bb[1] - a[1]); if (L > best) { best = L; ang = Math.atan2(bb[1] - a[1], bb[0] - a[0]); } }
      const ca = Math.cos(ang), sa = Math.sin(ang); let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
      for (const [x, z] of pts) { const u = x * ca + z * sa, v = -x * sa + z * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
      const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
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
  if (trees.length) pineSet(w, trees);

  // ponto de partida: via carro mais próxima do centro
  let best = 1e9, sp = null;
  for (const r of D.roads) { if (r.off || r.pts.length < 2 || r.w < 3.2) continue; for (let i = 0; i < r.pts.length - 1; i++) { const m = [(r.pts[i][0] + r.pts[i + 1][0]) / 2, (r.pts[i][1] + r.pts[i + 1][1]) / 2], d = Math.hypot(m[0], m[1]); if (d < best && Math.hypot(r.pts[i + 1][0] - r.pts[i][0], r.pts[i + 1][1] - r.pts[i][1]) > 8) { best = d; sp = { x: m[0], z: m[1], yaw: -Math.atan2(r.pts[i + 1][1] - r.pts[i][1], r.pts[i + 1][0] - r.pts[i][0]) }; } } }
  w.spawn = sp || { x: 0, z: 0, yaw: 0 };
  w.bx = RW / 2 - 2; w.bz = RH / 2 - 2;
  w.fogFar = 2200; w.name = 'Mundo Real — ' + (D.name || 'área escolhida');
  return w;
}
