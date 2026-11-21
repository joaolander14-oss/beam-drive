// ============================================================
//  Construtores dos mapas
// ============================================================
import * as THREE from 'three';
import { SURF, clamp, lerp, sstep } from './data.js';
import { World, Paint, Road, splineSample, makeTex, fbm, vnoise, rnd } from './world.js';

const TAU = Math.PI * 2;

function terrainColor(x, z, h, s, ny, out) {
  const c = SURF[s].col, n = (fbm(x * 0.045, z * 0.045, 3) - 0.5) * 0.30, n2 = (vnoise(x * 0.6, z * 0.6) - 0.5) * 0.10;
  const k = 1 + n + n2;
  out[0] = c[0] * k; out[1] = c[1] * k; out[2] = c[2] * k;
}
function slopeAt(w, x, z) { const e = w.cs; const hx = (w.rawHeight(x + e, z) - w.rawHeight(x - e, z)) / (2 * e), hz = (w.rawHeight(x, z + e) - w.rawHeight(x, z - e)) / (2 * e); return Math.hypot(hx, hz); }

function instanced(world, geo, mat, mats, colors, shadow = true) {
  const im = new THREE.InstancedMesh(geo, mat, mats.length);
  for (let i = 0; i < mats.length; i++) { im.setMatrixAt(i, mats[i]); if (colors) im.setColorAt(i, colors[i]); }
  im.castShadow = shadow; im.receiveShadow = true; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  world.group.add(im); return im;
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function mat4(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz); _q.setFromEuler(_e); return new THREE.Matrix4().compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }

function pineSet(w, pts) {
  const trunk = new THREE.CylinderGeometry(0.22, 0.34, 3.2, 6); trunk.translate(0, 1.6, 0);
  const c1 = new THREE.ConeGeometry(2.4, 5.5, 7); c1.translate(0, 5.0, 0);
  const c2 = new THREE.ConeGeometry(1.8, 4.5, 7); c2.translate(0, 7.8, 0);
  const tM = [], cM = [], cc = [];
  const R = rnd(77);
  for (const [x, z] of pts) {
    const h = w.heightAt(x, z), sc = 0.8 + R() * 0.9, ry = R() * TAU;
    tM.push(mat4(x, h, z, sc, sc, sc, ry)); cM.push(mat4(x, h, z, sc, sc, sc, ry));
    cc.push(new THREE.Color().setHSL(0.30 + R() * 0.06, 0.45, 0.16 + R() * 0.07));
  }
  instanced(w, trunk, new THREE.MeshStandardMaterial({ color: 0x4a3322, roughness: 1 }), tM);
  instanced(w, c1, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), cM, cc);
  instanced(w, c2, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), cM, cc);
}
function rockGeo() {
  const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 0.82 + vnoise(x * 2.1 + 5, z * 2.1 + y * 1.7) * 0.4; p.setXYZ(i, x * k, y * k * 0.85, z * k); }
  g.computeVertexNormals(); return g;
}
function rockSet(w, list, color = 0x7a756e, collide = false) {
  const mats = [], cols = [], R = rnd(31);
  for (const [x, z, r] of list) {
    const h = w.heightAt(x, z);
    mats.push(mat4(x, h + r * 0.35, z, r, r, r * (0.8 + R() * 0.4), R() * TAU, R() * 0.3, R() * 0.3));
    cols.push(new THREE.Color(color).multiplyScalar(0.75 + R() * 0.5));
    if (collide) w.addSphCol(x, h + r * 0.35, z, r * 0.88);
  }
  instanced(w, rockGeo(), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }), mats, cols);
}

function signMesh(w, text, x, z, yaw, wd = 6, ht = 1.6, h0 = 4, sub = '') {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const g = cv.getContext('2d'); g.fillStyle = '#10151f'; g.fillRect(0, 0, 512, 128); g.strokeStyle = '#ffd24a'; g.lineWidth = 6; g.strokeRect(4, 4, 504, 120);
  g.fillStyle = '#ffd24a'; g.font = 'bold 60px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, sub ? 48 : 64);
  if (sub) { g.font = 'bold 30px Arial'; g.fillStyle = '#fff'; g.fillText(sub, 256, 98); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, ht), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  const base = w.heightAt(x, z);
  m.position.set(x, base + h0, z); m.rotation.y = -yaw + Math.PI / 2;
  w.group.add(m);
  for (const sx of [-wd / 2 + 0.2, wd / 2 - 0.2]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, h0 + ht / 2, 6), new THREE.MeshStandardMaterial({ color: 0x555a60, metalness: 0.5, roughness: 0.5 }));
    p.position.set(x + Math.sin(yaw) * sx, base + (h0 + ht / 2) / 2, z - Math.cos(yaw) * sx);
    p.castShadow = true; w.group.add(p);
  }
}

// ---------- estrada com asfalto, faixas e superfície ----------
function buildRoadMesh(w, road, { tex = 'asphalt', color = 0xffffff, rep = 10, lift = 0.0, wid = null, rough = 0.92 }) {
  const n = road.n, hw = wid ?? road.hw, cnt = road.closed ? n + 1 : n;
  const pos = new Float32Array(cnt * 2 * 3), uv = new Float32Array(cnt * 2 * 2), idx = [];
  for (let k = 0; k < cnt; k++) {
    const i = k % n, nx = -road.TZ[i], nz = road.TX[i];
    for (let sd = 0; sd < 2; sd++) {
      const sg = sd ? 1 : -1, x = road.X[i] + nx * hw * sg, z = road.Z[i] + nz * hw * sg;
      const o = (k * 2 + sd) * 3; pos[o] = x; pos[o + 1] = w.heightAt(x, z) + lift; pos[o + 2] = z;
      uv[(k * 2 + sd) * 2] = sd; uv[(k * 2 + sd) * 2 + 1] = (k === n ? road.length : road.S[i]) / rep;
    }
    if (k < cnt - 1) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const t = makeTex(tex, 256).clone(); t.needsUpdate = true; t.repeat.set(1, 1); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.MeshStandardMaterial({ map: t, color, roughness: rough, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; w.group.add(mesh); w.roadMat = mat;
  return mesh;
}
function roadMarkings(w, road, P, { edge = true, center = 'dash', hw = null }) {
  const n = road.n; hw = hw ?? road.hw;
  const at = (i, off) => [road.X[i % n] + -road.TZ[i % n] * off, road.Z[i % n] + road.TX[i % n] * off];
  const cnt = road.closed ? n : n - 1;
  for (let i = 0; i < cnt; i++) {
    const a = at(i, 0), b = at(i + 1, 0);
    if (center === 'dash' && Math.floor(road.S[i] / 6) % 2 === 0) P.line('#f2d24a', a[0], a[1], b[0], b[1], 0.18, 0.04);
    if (center === 'double') { const l1 = at(i, 0.18), l2 = at(i + 1, 0.18), r1 = at(i, -0.18), r2 = at(i + 1, -0.18); P.line('#f2d24a', l1[0], l1[1], l2[0], l2[1], 0.12, 0.04); P.line('#f2d24a', r1[0], r1[1], r2[0], r2[1], 0.12, 0.04); }
    if (edge) for (const sg of [-1, 1]) { const e1 = at(i, sg * (hw - 0.45)), e2 = at(i + 1, sg * (hw - 0.45)); P.line('#e8e8e8', e1[0], e1[1], e2[0], e2[1], 0.16, 0.04); }
  }
}
function smoothProfile(road, nat, win, grade) {
  const n = road.n, Y = road.Y;
  for (let i = 0; i < n; i++) Y[i] = nat(road.X[i], road.Z[i]);
  const tmp = new Float32Array(n);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -win; k <= win; k++) { let j = i + k; if (road.closed) j = (j % n + n) % n; else j = clamp(j, 0, n - 1); s += Y[j]; c++; }
      tmp[i] = s / c;
    }
    Y.set(tmp);
  }
  const ds = road.length / n;
  for (let it = 0; it < 4; it++) {
    for (let i = 0; i < n * 2; i++) { const a = i % n, b = (i + 1) % n; if (Y[b] - Y[a] > grade * ds) Y[b] = Y[a] + grade * ds; if (Y[a] - Y[b] > grade * ds) Y[a] = Y[b] + grade * ds; }
    for (let i = n * 2; i > 0; i--) { const a = i % n, b = (i + 1) % n; if (Y[b] - Y[a] > grade * ds) Y[b] = Y[a] + grade * ds; if (Y[a] - Y[b] > grade * ds) Y[a] = Y[b] + grade * ds; }
  }
}

// =====================================================================
//  CAMPO DE PROVAS
// =====================================================================
export function buildCampo(w) {
  w.initGrid(900, 3, 2);
  const padX = 300, padZ = 210;
  const hill = (x, z) => 46 * Math.exp(-(((x + 120) ** 2 + (z - 350) ** 2) / (2 * 52 * 52)));
  w.genTerrain((x, z) => {
    const dx = Math.max(0, Math.abs(x) - padX - 4), dz = Math.max(0, Math.abs(z) - padZ - 4);
    const wg = sstep(0, 45, Math.hypot(dx, dz));
    const n = (fbm(x * 0.006 + 3, z * 0.006 + 7, 4) - 0.5) * 2;
    let h = wg * (n * 5 + 3.5);
    if (z > 0) h += wg * sstep(230, 300, z) * (fbm(x * 0.02, z * 0.02, 3) - 0.5) * 16;
    h += hill(x, z) * wg;
    h -= 1.8 * Math.exp(-((x - 120) ** 2 + (z - 335) ** 2) / (2 * 22 * 22)) * wg;
    return h;
  });
  w.genSurface((x, z) => {
    if (Math.abs(x) <= padX && Math.abs(z) <= padZ) return 0;
    if (Math.hypot(x - 120, z - 335) < 27) return 6;
    const sl = slopeAt(w, x, z);
    if (sl > 0.55) return 7;
    const n = fbm(x * 0.012 + 11, z * 0.012, 3);
    if (z > padZ) { if (x < -260 && z > 280) return 4; if (n > 0.58) return 2; if (n < 0.32) return 5; return 3; }
    return n > 0.62 ? 2 : 3;
  });
  w.buildTerrainMesh(terrainColor);
  // asfalto
  const t = makeTex('asphalt', 256).clone(); t.repeat.set(padX * 2 / 10, padZ * 2 / 10); t.needsUpdate = true;
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(padX * 2, padZ * 2), new THREE.MeshStandardMaterial({ map: t, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.012, 0); pad.receiveShadow = true; w.group.add(pad); w.roadMat = pad.material;
  const P = new Paint(w);
  // contorno
  for (const [a, b, c, d] of [[-padX, -padZ, padX, -padZ], [padX, -padZ, padX, padZ], [padX, padZ, -padX, padZ], [-padX, padZ, -padX, -padZ]]) P.line('#e8e8e8', a, b, c, d, 0.4, 0.03);

  // --- arrancada 1/4 de milha (z=170) ---
  const zs = 170, x0 = -280, xe = x0 + 402.3;
  for (const z of [162, 178]) P.line('#e8e8e8', x0 - 12, z, xe + 150, z, 0.25);
  P.dashed('#e8e8e8', x0 - 12, zs, xe + 150, zs, 0.18, 4, 6);
  P.line('#ffffff', x0, 162, x0, 178, 0.5); P.line('#ffffff', x0 - 3, 162, x0 - 3, 178, 0.25); P.line('#ffffff', x0 - 6, 162, x0 - 6, 178, 0.25);
  for (let k = 1; k <= 4; k++) { const xx = k === 4 ? xe : x0 + k * 100.58; P.line(k === 4 ? '#ffffff' : '#9aa0a6', xx, 162, xx, 178, k === 4 ? 0.7 : 0.35); }
  signMesh(w, '1/4 MILHA', xe, 157, 0, 8, 2, 5.5, '402 m');
  for (let k = 1; k <= 3; k++) signMesh(w, `${k * 100} m`, x0 + k * 100.58, 156, 0, 4, 1.1, 3, '');

  // --- skidpad (círculo) ---
  const sc = [-150, -30];
  P.ring('#e8e8e8', sc[0], sc[1], 38, 0.3); P.ring('#e8e8e8', sc[0], sc[1], 50, 0.3);
  P.line('#e8e8e8', sc[0] - 6, sc[1], sc[0] + 6, sc[1], 0.3); P.line('#e8e8e8', sc[0], sc[1] - 6, sc[0], sc[1] + 6, 0.3);
  signMesh(w, 'SKIDPAD', sc[0], sc[1] - 58, Math.PI / 2, 6, 1.4, 3.2, 'raio 44 m');

  // --- slalom ---
  for (let i = 0; i < 12; i++) w.addProp('cone', -270 + i * 17, -172);
  signMesh(w, 'SLALOM', -270, -150, 0, 5, 1.3, 3, '');

  // --- faixa de frenagem (z=-110) ---
  for (let i = 0; i <= 14; i++) { const xx = 0 + i * 10; P.line(i % 5 === 0 ? '#ffffff' : '#9aa0a6', xx, -118, xx, -102, i % 5 === 0 ? 0.5 : 0.25); }
  P.line('#e8e8e8', -60, -118, 160, -118, 0.2); P.line('#e8e8e8', -60, -102, 160, -102, 0.2);
  signMesh(w, 'FRENAGEM', 0, -126, 0, 6, 1.3, 3, 'marcas a cada 10 m');

  // --- lombadas e ondulações ---
  w.addPatch({ x0: -280, x1: -120, z0: 92, z1: 128, res: 0.5, fn: (x, z) => 0.16 * Math.max(0, Math.sin((x + 280) / 14 * TAU)) * sstep(92, 94, z) * (1 - sstep(126, 128, z)), color: 0x45454a });
  w.addPatch({ x0: -90, x1: -20, z0: 100, z1: 130, res: 0.4, fn: (x, z) => { let h = 0; for (let k = 0; k < 6; k++) { const d = Math.abs(x + 85 - k * 11); if (d < 1.6) h = Math.max(h, 0.13 * Math.cos(d / 1.6 * Math.PI / 2)); } return h; }, color: 0xd8c020 });

  // --- rampas ---
  w.addRamp({ x: 85, z: -70, yaw: 0, wid: 7, prof: [[0, 0], [10, 1.8]] });
  w.addRamp({ x: 114, z: -70, yaw: 0, wid: 7, prof: [[0, 1.8], [14, 0]] });
  w.addRamp({ x: 85, z: -25, yaw: 0, wid: 7, prof: [[0, 0], [14, 3.5]] });
  w.addRamp({ x: 135, z: -25, yaw: 0, wid: 7, prof: [[0, 3.5], [18, 0]] });
  w.addRamp({ x: 85, z: 25, yaw: 0, wid: 8, prof: [[0, 0], [22, 7]] });
  w.addRamp({ x: 168, z: 25, yaw: 0, wid: 8, prof: [[0, 6.2], [26, 0]] });
  w.addRamp({ x: 20, z: 60, yaw: 0, wid: 8, prof: [[0, 0], [6, 3.0], [12, 3.0], [18, 0]], color: 0x9a8a60 }); // plataforma
  signMesh(w, 'RAMPAS', 70, -92, 0, 5, 1.3, 3, 'pequena · média · grande');

  // --- zona de colisão ---
  w.box(255, -30, 1.0, 1.4, 130, 0, 0xb8b8b2);             // muro de concreto longo
  w.box(205, -125, 12, 2.4, 0.6, 0.3, 0x9a4a30, null);     // muro de tijolos
  for (let i = 0; i < 6; i++) w.box(205 + i * 6, 90, 3, 0.85, 0.5, 0.1 * (i % 2), 0xb0b0aa);
  for (let i = 0; i < 9; i++) { const zz = -105 + i * 6; w.addCylCol(225, zz, w.heightAt(225, zz), w.heightAt(225, zz) + 4, 0.18); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4, 10), new THREE.MeshStandardMaterial({ color: 0x777b80, metalness: 0.6, roughness: 0.4 })); m.position.set(225, w.heightAt(225, zz) + 2, zz); m.castShadow = true; w.group.add(m); }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4 - r; c++) w.addProp('barrel', 190 + c * 0.85 + r * 0.425, 50, w.heightAt(190, 50) + r * 0.8);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) w.addProp('crate', 190 + i * 1.0, 20 + j * 1.0);
  for (let i = 0; i < 10; i++) w.addProp('tyre', 180 + (i % 5) * 0.8, 70 + Math.floor(i / 5) * 0.8);
  for (let i = 0; i < 10; i++) w.addProp('pin', 235 + (i % 4) * 0.7, 130 + Math.floor(i / 4) * 0.7);
  for (let i = 0; i < 8; i++) w.addProp('cone', 150 + i * 3, 100);
  signMesh(w, 'ÁREA DE COLISÃO', 255, 50, Math.PI / 2, 8, 1.6, 4, 'muros · barris · caixas');

  // --- off-road ---
  w.addPatch({ x0: 170, x1: 260, z0: 248, z1: 276, res: 0.4, fn: (x) => 0.15 * (0.5 + 0.5 * Math.sin(x * TAU / 2.3)), color: 0x6a5238 });
  const R = rnd(5), rocks = [];
  for (let i = 0; i < 46; i++) rocks.push([-160 + R() * 330, 255 + R() * 150, 0.9 + R() * 2.2]);
  rockSet(w, rocks.filter(r => Math.hypot(r[0] - 120, r[1] - 335) > 40 && Math.hypot(r[0] + 120, r[1] - 350) > 50), 0x807a70, true);
  const trees = []; for (let i = 0; i < 260; i++) { const x = (R() - 0.5) * 860, z = (R() - 0.5) * 860; if ((Math.abs(x) < 310 && Math.abs(z) < 220) || w.surfAt(x, z) !== 3) continue; trees.push([x, z]); }
  pineSet(w, trees);
  signMesh(w, 'OFF-ROAD', 0, 238, Math.PI, 6, 1.4, 3, 'lama · colina · pedras · costelas');
  w.spawn = { x: -40, z: 30, yaw: 0 };
  w.fogFar = 1800; w.name = 'Campo de Provas';
}

// =====================================================================
//  SERRA
// =====================================================================
export function buildSerra(w) {
  w.initGrid(2200, 5, 3);
  const ctrl = [];
  const NP = 40;
  for (let k = 0; k < NP; k++) {
    const th = k / NP * TAU;
    const r = 520 + 190 * Math.sin(2 * th + 0.6) + 110 * Math.sin(3 * th + 2.0) + 60 * Math.sin(5 * th + 1) + 30 * Math.sin(9 * th);
    ctrl.push([Math.cos(th) * r * 1.05, Math.sin(th) * r * 0.82]);
  }
  const pts = splineSample(ctrl, true, 3);
  const hw = 5.2;
  const road = new Road(pts, true, hw);
  const natural = (x, z) => {
    const r = Math.hypot(x / 1.05, z / 0.82);
    let h = 120 * (fbm(x / 650 + 5, z / 650 + 9, 4) - 0.35) + 36 * (fbm(x / 160, z / 160, 3) - 0.5);
    h += 130 * Math.exp(-((r / 430) ** 2));
    h += 160 * sstep(760, 1050, r);
    return h;
  };
  smoothProfile(road, natural, 18, 0.10);
  w.road = road;
  const blendW = 14, shoulder = 2.0;
  w.genTerrain((x, z) => {
    const nat = natural(x, z);
    const nr = road.nearest(x, z, 110);
    if (!nr) return nat;
    const ry = road.Y[nr.i], dlt = Math.abs(nat - ry);
    const bw = blendW + 0.8 * dlt;
    return lerp(ry, nat, sstep(hw + shoulder, hw + shoulder + bw, nr.d));
  });
  w.genSurface((x, z, h) => {
    const nr = road.nearest(x, z, 40);
    if (nr && nr.d < hw) return 0;
    if (nr && nr.d < hw + 1.8) return 5;
    const sl = slopeAt(w, x, z);
    if (sl > 0.62 || h > 255) return 7;
    const n = fbm(x * 0.02 + 3, z * 0.02, 3);
    return n > 0.62 ? 2 : 3;
  });
  w.buildTerrainMesh((x, z, h, s, ny, out) => {
    terrainColor(x, z, h, s, ny, out);
    if (h > 235 && s !== 0) { const k = sstep(235, 275, h); out[0] = lerp(out[0], 0.92, k); out[1] = lerp(out[1], 0.94, k); out[2] = lerp(out[2], 0.98, k); }
    if (s === 3) { const k = sstep(40, 180, h) * 0.5; out[0] *= 1 - k * 0.2; out[1] *= 1 - k * 0.05; out[2] *= 1 - k * 0.3; }
  }, 0.1);
  buildRoadMesh(w, road, { rep: 12 });
  const P = new Paint(w);
  roadMarkings(w, road, P, { center: 'dash', edge: true });
  // linha de largada
  { const i = 0, nx = -road.TZ[i], nz = road.TX[i]; P.line('#ffffff', road.X[i] + nx * hw, road.Z[i] + nz * hw, road.X[i] - nx * hw, road.Z[i] - nz * hw, 0.8, 0.045); }
  P.build(w.group);
  // guard-rails nos precipícios
  const railM = [], postM = [];
  const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc0, metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < road.n; i += 2) {
    const nx = -road.TZ[i], nz = road.TX[i];
    for (const sg of [-1, 1]) {
      const off = (hw + 1.1) * sg, ox = road.X[i] + nx * off, oz = road.Z[i] + nz * off;
      const far = (hw + 10) * sg, fx = road.X[i] + nx * far, fz = road.Z[i] + nz * far;
      const here = w.heightAt(ox, oz), drop = road.Y[i] - w.heightAt(fx, fz);
      if (drop < 2.5) continue;
      const yaw = Math.atan2(road.TZ[i], road.TX[i]);
      railM.push(mat4(ox, here + 0.62, oz, 6, 1, 1, -yaw));
      postM.push(mat4(ox, here + 0.4, oz, 1, 1, 1, -yaw));
      w.addBoxCol(ox, here + 0.45, oz, 3.05, 0.45, 0.12, yaw);
    }
  }
  instanced(w, new THREE.BoxGeometry(1, 0.32, 0.07), metal, railM);
  instanced(w, new THREE.BoxGeometry(0.1, 0.9, 0.1), new THREE.MeshStandardMaterial({ color: 0x777b80, roughness: 0.6 }), postM);
  // placas de curva
  const R = rnd(9);
  const chev = new THREE.MeshStandardMaterial({ color: 0xf2c400, roughness: 0.5 });
  const chevM = [];
  for (let i = 0; i < road.n; i += 3) {
    if (Math.abs(road.curv[i]) > 0.0105) {
      const side = road.curv[i] > 0 ? -1 : 1; // lado externo
      const nx = -road.TZ[i], nz = road.TX[i], off = (hw + 2.4) * side;
      const x = road.X[i] + nx * off, z = road.Z[i] + nz * off;
      chevM.push(mat4(x, w.heightAt(x, z) + 1.2, z, 1, 1, 1, -Math.atan2(road.TZ[i], road.TX[i]) + Math.PI / 2));
    }
  }
  if (chevM.length) instanced(w, new THREE.BoxGeometry(1.4, 0.9, 0.08), chev, chevM);
  // árvores e pedras
  const trees = [];
  for (let k = 0; k < 4200 && trees.length < 2600; k++) {
    const x = (R() - 0.5) * 2100, z = (R() - 0.5) * 2100;
    const h = w.heightAt(x, z), s = w.surfAt(x, z);
    if (s !== 3 || h > 200) continue;
    const nr = road.nearest(x, z, 14); if (nr && nr.d < hw + 5) continue;
    trees.push([x, z]);
    if (nr && nr.d < 14 && w.statics.length < 4000) w.addCylCol(x, z, h, h + 10, 0.45);
  }
  pineSet(w, trees);
  const rocks = [];
  for (let k = 0; k < 800; k++) {
    const i = (R() * road.n) | 0, sg = R() < 0.5 ? -1 : 1, off = (hw + 4 + R() * 16) * sg;
    const x = road.X[i] - road.TZ[i] * off, z = road.Z[i] + road.TX[i] * off;
    const sl = slopeAt(w, x, z); if (sl < 0.3) continue;
    rocks.push([x, z, 0.8 + R() * 2.4]);
  }
  rockSet(w, rocks, 0x777770, false);
  for (const r of rocks) { const nr = road.nearest(r[0], r[1], 12); if (nr && nr.d < hw + 9 && r[2] > 1.2) w.addSphCol(r[0], w.heightAt(r[0], r[1]) + r[2] * 0.35, r[1], r[2] * 0.85); }
  w.spawn = { x: road.X[0], z: road.Z[0], yaw: -Math.atan2(road.TZ[0], road.TX[0]) };
  w.spawnY = null;
  w.fogFar = 2600; w.name = 'Serra do Rio';
}

// =====================================================================
//  DESERTO
// =====================================================================
export function buildDeserto(w) {
  w.initGrid(2000, 5, 3);
  const ctrl = [];
  const NP = 26;
  for (let k = 0; k < NP; k++) {
    const th = k / NP * TAU;
    const r = 420 + 150 * Math.sin(2 * th + 1.1) + 90 * Math.sin(3 * th) + 50 * Math.sin(6 * th + 2);
    ctrl.push([Math.cos(th) * r, Math.sin(th) * r * 0.9]);
  }
  const hw = 3.8;
  const road = new Road(splineSample(ctrl, true, 3), true, hw);
  const cr = (c, ang) => { const ca = Math.cos(ang), sa = Math.sin(ang); return [c[0] * ca - c[1] * sa, c[0] * sa + c[1] * ca]; };
  const riverZ = x => 160 * Math.sin(x / 300 + 1) + 40 * Math.sin(x / 90) - 380;
  const natural = (x, z) => {
    const [u, v] = cr([x, z], 0.5);
    const ridge = 1 - Math.abs(2 * fbm(u * 0.0042 + 9, v * 0.011 + 2, 3) - 1);
    let h = 17 * Math.pow(ridge, 1.8) + 4 * fbm(x * 0.02, z * 0.02, 3) + 2;
    const m = fbm(x * 0.0017 + 20, z * 0.0017 + 3, 4);
    h += 46 * sstep(0.60, 0.665, m);
    h += 55 * Math.exp(-(((x + 520) ** 2 + (z - 430) ** 2) / (2 * 110 * 110)));
    const dr = Math.abs(z - riverZ(x));
    h -= 7 * (1 - sstep(8, 55, dr));
    const dm = Math.hypot(x - 430, z + 260); h -= 4.5 * (1 - sstep(25, 85, dm));
    return h;
  };
  smoothProfile(road, natural, 12, 0.12);
  w.road = road;
  w.genTerrain((x, z) => {
    const nat = natural(x, z);
    const nr = road.nearest(x, z, 90);
    if (!nr) return nat;
    const ry = road.Y[nr.i], bw = 8 + 0.7 * Math.abs(nat - ry);
    return lerp(ry, nat, sstep(hw + 1, hw + 1 + bw, nr.d));
  });
  w.genSurface((x, z, h) => {
    const nr = road.nearest(x, z, 20);
    if (nr && nr.d < hw) return 2;
    if (Math.hypot(x - 430, z + 260) < 52) return 6;
    const sl = slopeAt(w, x, z);
    if (sl > 0.6) return 7;
    if (Math.abs(z - riverZ(x)) < 22) return 5;
    if (Math.hypot(x + 520, z - 430) < 150 && sl > 0.28) return 7;
    return 4;
  });
  w.buildTerrainMesh((x, z, h, s, ny, out) => {
    terrainColor(x, z, h, s, ny, out);
    if (s === 4) { const k = (fbm(x * 0.008, z * 0.008, 3) - 0.5) * 0.4; out[0] *= 1 + k * 0.7; out[1] *= 1 + k * 0.5; out[2] *= 1 + k * 0.1; out[0] *= 1.02; }
    if (s === 7) { out[0] *= 1.25; out[1] *= 0.95; out[2] *= 0.8; }
  }, 0.1);
  buildRoadMesh(w, road, { tex: 'concrete', color: 0xb0865a, rep: 8, rough: 1 });
  const R = rnd(21);
  const rocks = [];
  for (let k = 0; k < 520; k++) { const x = (R() - 0.5) * 1900, z = (R() - 0.5) * 1900; const sl = slopeAt(w, x, z); if (sl < 0.35 && R() < 0.7) continue; rocks.push([x, z, 0.8 + R() * 3]); }
  const near = []; const far = [];
  for (const r of rocks) { const nr = road.nearest(r[0], r[1], 20); if (nr && nr.d < hw + 3) continue; (Math.hypot(r[0] - 0, r[1] - 0) < 1100 ? near : far).push(r); }
  rockSet(w, near, 0xa0805a, false);
  for (const r of near) if (r[2] > 1.1) w.addSphCol(r[0], w.heightAt(r[0], r[1]) + r[2] * 0.35, r[1], r[2] * 0.85);
  // campo de pedras do rock-crawl
  const rc = [];
  for (let k = 0; k < 90; k++) { const a = R() * TAU, d = 20 + R() * 110; rc.push([-520 + Math.cos(a) * d, 430 + Math.sin(a) * d, 1.2 + R() * 3.2]); }
  rockSet(w, rc, 0x8a6a4a, true);
  // cactos/arbustos mortos simples
  const cactus = new THREE.CylinderGeometry(0.28, 0.34, 3.2, 8); cactus.translate(0, 1.6, 0);
  const cM = []; for (let k = 0; k < 340; k++) { const x = (R() - 0.5) * 1900, z = (R() - 0.5) * 1900; if (w.surfAt(x, z) !== 4) continue; const h = w.heightAt(x, z); cM.push(mat4(x, h, z, 0.8 + R() * 0.6, 0.6 + R() * 0.9, 0.8 + R() * 0.6, R() * 3)); }
  instanced(w, cactus, new THREE.MeshStandardMaterial({ color: 0x4c6a3a, roughness: 0.9 }), cM);
  w.spawn = { x: road.X[0], z: road.Z[0], yaw: -Math.atan2(road.TZ[0], road.TX[0]) };
  w.fogFar = 2400; w.name = 'Deserto & Rochas';
}

// =====================================================================
//  AUTÓDROMO
// =====================================================================
export function buildAutodromo(w) {
  w.initGrid(1400, 4, 2);
  const ctrl = [[-300, 0], [-100, 0], [100, 0], [240, 0], [330, 40], [370, 110], [350, 190], [290, 240], [200, 250], [130, 210], [60, 170], [-10, 190], [-60, 250], [-140, 300], [-240, 300], [-320, 260], [-350, 190], [-345, 110], [-340, 45]];
  const hw = 6.5;
  const road = new Road(splineSample(ctrl, true, 2.5), true, hw);
  const natural = (x, z) => 5 * (fbm(x / 420 + 3, z / 420 + 5, 3) - 0.5) * 2;
  smoothProfile(road, natural, 30, 0.05);
  w.road = road;
  w.genTerrain((x, z) => {
    const nr = road.nearest(x, z, 140);
    const far = 6 * (fbm(x / 160, z / 160, 3) - 0.5) + 2 * (fbm(x / 40, z / 40, 2) - 0.5);
    const nat = natural(x, z) + far * (nr ? sstep(40, 120, nr.d) : 1) + 12 * sstep(560, 690, Math.hypot(x, z * 0.9));
    if (!nr) return nat;
    return lerp(road.Y[nr.i], nat, sstep(hw + 22, hw + 70, nr.d));
  });
  // brita nas curvas
  const gravel = [];
  for (let i = 0; i < road.n; i += 3) {
    if (Math.abs(road.curv[i]) > 0.0085) {
      const out = road.curv[i] > 0 ? -1 : 1;     // lado externo
      gravel.push([road.X[i] - road.TZ[i] * out * (hw + 11), road.Z[i] + road.TX[i] * out * (hw + 11), i]);
    }
  }
  w.genSurface((x, z) => {
    const nr = road.nearest(x, z, 40);
    if (nr && nr.d < hw) return 0;
    if (nr && nr.d < hw + 1.4) return 8;
    for (const g of gravel) if ((g[0] - x) ** 2 + (g[1] - z) ** 2 < 15 * 15) return 5;
    if (nr && nr.d < hw + 18) return 3;
    return 3;
  });
  w.buildTerrainMesh((x, z, h, s, ny, out) => { terrainColor(x, z, h, s, ny, out); if (s === 8) { out[0] = out[1] = out[2] = 0.7; } }, 0.1);
  buildRoadMesh(w, road, { rep: 12, color: 0xdddddd });
  const P = new Paint(w);
  roadMarkings(w, road, P, { center: null, edge: true });
  // zebras
  for (let i = 0; i < road.n; i++) {
    if (Math.abs(road.curv[i]) > 0.0075) {
      const side = road.curv[i] > 0 ? -1 : 1;
      const j = (i + 1) % road.n;
      const nx = -road.TZ[i], nz = road.TX[i], n2x = -road.TZ[j], n2z = road.TX[j];
      const o1 = hw * side * -1, o2 = (hw + 1.3) * side * -1;
      // curvatura positiva => lado interno é o oposto
      const col = Math.floor(road.S[i] / 2.5) % 2 ? '#d02020' : '#f0f0f0';
      P.quad(col, [[road.X[i] + nx * o1, road.Z[i] + nz * o1], [road.X[j] + n2x * o1, road.Z[j] + n2z * o1], [road.X[j] + n2x * o2, road.Z[j] + n2z * o2], [road.X[i] + nx * o2, road.Z[i] + nz * o2]], 0.045);
    }
  }
  // linha de largada xadrez
  { const nx = -road.TZ[0], nz = road.TX[0]; for (let k = 0; k < 12; k++) for (let r = 0; r < 2; r++) { const o0 = -hw + k * (2 * hw / 12), o1 = o0 + 2 * hw / 12, t0 = r * 0.7, t1 = t0 + 0.7; const col = (k + r) % 2 ? '#101010' : '#ffffff'; P.quad(col, [[road.X[0] + nx * o0 + road.TX[0] * t0, road.Z[0] + nz * o0 + road.TZ[0] * t0], [road.X[0] + nx * o1 + road.TX[0] * t0, road.Z[0] + nz * o1 + road.TZ[0] * t0], [road.X[0] + nx * o1 + road.TX[0] * t1, road.Z[0] + nz * o1 + road.TZ[0] * t1], [road.X[0] + nx * o0 + road.TX[0] * t1, road.Z[0] + nz * o0 + road.TZ[0] * t1]], 0.05); } }
  P.build(w.group);
  // barreiras de pneus
  const bM = [], bC = [];
  for (let i = 0; i < road.n; i += 2) {
    if (Math.abs(road.curv[i]) > 0.0085) {
      const out = road.curv[i] > 0 ? -1 : 1, off = (hw + 24) * out;
      const x = road.X[i] - road.TZ[i] * off, z = road.Z[i] + road.TX[i] * off, h = w.heightAt(x, z), yaw = Math.atan2(road.TZ[i], road.TX[i]);
      bM.push(mat4(x, h + 0.55, z, 1, 1, 1, -yaw)); bC.push(new THREE.Color(Math.floor(i / 2) % 2 ? 0xd02020 : 0xf0f0f0));
      w.addBoxCol(x, h + 0.55, z, 2.6, 0.55, 0.5, yaw);
    }
  }
  if (bM.length) instanced(w, new THREE.BoxGeometry(5.2, 1.1, 1.0), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }), bM, bC);
  // arquibancadas
  const stand = (x, z, yaw) => { const m = new THREE.Mesh(new THREE.BoxGeometry(140, 9, 14), new THREE.MeshStandardMaterial({ color: 0x8a92a6, roughness: 0.7 })); m.position.set(x, w.heightAt(x, z) + 4.5, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true; w.group.add(m); w.addBoxCol(x, w.heightAt(x, z) + 4.5, z, 70, 4.5, 7, -yaw); };
  stand(-100, -45, 0); stand(80, -48, 0);
  const R = rnd(3), trees = [];
  for (let k = 0; k < 900; k++) { const x = (R() - 0.5) * 1300, z = (R() - 0.5) * 1300; const nr = road.nearest(x, z, 50); if (nr && nr.d < 42) continue; if (w.surfAt(x, z) !== 3) continue; trees.push([x, z]); }
  pineSet(w, trees);
  signMesh(w, 'BEAM CIRCUIT', -10, -22, 0, 12, 2.4, 9, 'linha de largada');
  w.spawn = { x: road.X[0] + road.TX[0] * 8, z: road.Z[0] + road.TZ[0] * 8, yaw: -Math.atan2(road.TZ[0], road.TX[0]) };
  // checkpoints para cronometragem
  w.checkpoints = [0.2, 0.4, 0.6, 0.8].map(f => Math.floor(f * road.n));
  w.fogFar = 2200; w.name = 'Autódromo';
}

export function buildWorld(id) {
  const w = new World(id);
  ({ campo: buildCampo, serra: buildSerra, deserto: buildDeserto, autodromo: buildAutodromo })[id](w);
  // paredes invisíveis nas bordas já tratadas por clampBounds
  return w;
}
