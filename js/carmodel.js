// ============================================================
//  Modelos 3D dos carros: carroceria gerada a partir de silhueta real (loft de seções),
//  rodas com raios/pneus, interior, luzes, kits e deformação por impacto.
// ============================================================
import * as THREE from 'three';
import { CARS, WHEEL_STYLES, tireDims, pchip, clamp, lerp, sstep } from './data.js';
import { vnoise, makeTex } from './world.js';
import { CATS } from './catalog.js';

const V3 = THREE.Vector3;
const FINISH = {
  gloss: { metal: 0.05, rough: 0.22, cc: 1.0, ccr: 0.04 },
  metal: { metal: 0.70, rough: 0.30, cc: 1.0, ccr: 0.05 },
  pearl: { metal: 0.35, rough: 0.28, cc: 1.0, ccr: 0.02 },
  matte: { metal: 0.10, rough: 0.82, cc: 0.0, ccr: 0.5 },
  satin: { metal: 0.45, rough: 0.55, cc: 0.3, ccr: 0.3 },
};
const C_UNDER = new THREE.Color(0x060607), C_WELL = new THREE.Color(0x030303), C_TRIM = new THREE.Color(0x0e0e10), C_LINER = new THREE.Color(0x15151a);
const C_GLASS = new THREE.Color(0x0a1118), C_SCRATCH = new THREE.Color(0x24201c), C_CRACK = new THREE.Color(0x9aa4aa);

// ---------------------------------------------------------------
class Surface {
  constructor() { this.pos = []; this.batches = {}; this.nv = 0; }
  addVertex(x, y, z) { this.pos.push(x, y, z); return this.nv++; }
  addQuad(batch, a, b, c, d, center) {
    const P = this.pos;
    const ax = P[a * 3], ay = P[a * 3 + 1], az = P[a * 3 + 2];
    const e1x = P[b * 3] - ax, e1y = P[b * 3 + 1] - ay, e1z = P[b * 3 + 2] - az;
    const e2x = P[c * 3] - ax, e2y = P[c * 3 + 1] - ay, e2z = P[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    const cx = (ax + P[c * 3]) / 2 - center[0], cy = (ay + P[c * 3 + 1]) / 2 - center[1], cz = (az + P[c * 3 + 2]) / 2 - center[2];
    const len = Math.hypot(nx, ny, nz);
    if (len < 1e-9) { // quad degenerado (b==c etc): tenta com outro triângulo
      const f1x = P[c * 3] - ax, f1y = P[c * 3 + 1] - ay, f1z = P[c * 3 + 2] - az, f2x = P[d * 3] - ax, f2y = P[d * 3 + 1] - ay, f2z = P[d * 3 + 2] - az;
      const mx = f1y * f2z - f1z * f2y, my = f1z * f2x - f1x * f2z, mz = f1x * f2y - f1y * f2x;
      if (Math.hypot(mx, my, mz) < 1e-9) return;
      const dot2 = mx * cx + my * cy + mz * cz;
      (this.batches[batch] ||= []).push(dot2 >= 0 ? [a, b, c, d] : [d, c, b, a]);
      return;
    }
    const dot = nx * cx + ny * cy + nz * cz;
    (this.batches[batch] ||= []).push(dot >= 0 ? [a, b, c, d] : [d, c, b, a]);
  }
  finalize() {
    this.grid = new Float32Array(this.pos); this.rest = new Float32Array(this.pos);
    this.dmg = new Float32Array(this.nv);
    this.nor = new Float32Array(this.nv * 3);
    this.meshes = [];
  }
  normals() {
    const G = this.grid, N = this.nor; N.fill(0);
    for (const k in this.batches) for (const q of this.batches[k]) {
      for (let t = 0; t < 2; t++) {
        const a = q[0], b = q[t ? 2 : 1], c = q[t ? 3 : 2];
        const ax = G[a * 3], ay = G[a * 3 + 1], az = G[a * 3 + 2];
        const e1x = G[b * 3] - ax, e1y = G[b * 3 + 1] - ay, e1z = G[b * 3 + 2] - az, e2x = G[c * 3] - ax, e2y = G[c * 3 + 1] - ay, e2z = G[c * 3 + 2] - az;
        const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
        for (const v of [a, b, c]) { N[v * 3] += nx; N[v * 3 + 1] += ny; N[v * 3 + 2] += nz; }
      }
    }
    for (let i = 0; i < this.nv; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
  }
  // cria as malhas (uma por lote)
  build(materials, colorFor, parent) {
    this.colorFor = colorFor; this.mats = materials;
    this.normals();
    for (const k in this.batches) {
      const quads = this.batches[k], n = quads.length;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
      const idx = new Uint32Array(n * 6);
      for (let i = 0; i < n; i++) { const o = i * 4; idx.set([o, o + 1, o + 2, o, o + 2, o + 3], i * 6); }
      g.setIndex(new THREE.BufferAttribute(idx, 1));
      const mesh = new THREE.Mesh(g, materials[k]);
      mesh.castShadow = k !== 'glass'; mesh.receiveShadow = true; mesh.frustumCulled = false;
      mesh.userData.batch = k; parent.add(mesh); this.meshes.push(mesh);
    }
    this.refresh();
  }
  refresh(withNormals = false) {
    if (withNormals) this.normals();
    const G = this.grid, N = this.nor, tmp = new THREE.Color();
    for (const mesh of this.meshes) {
      const k = mesh.userData.batch, quads = this.batches[k];
      const P = mesh.geometry.attributes.position.array, NN = mesh.geometry.attributes.normal.array, CC = mesh.geometry.attributes.color.array;
      for (let i = 0; i < quads.length; i++) {
        const q = quads[i];
        for (let c = 0; c < 4; c++) {
          const v = q[c], o = i * 12 + c * 3;
          P[o] = G[v * 3]; P[o + 1] = G[v * 3 + 1]; P[o + 2] = G[v * 3 + 2];
          NN[o] = N[v * 3]; NN[o + 1] = N[v * 3 + 1]; NN[o + 2] = N[v * 3 + 2];
          this.colorFor(k, v, this.dmg[v], tmp, this);
          CC[o] = tmp.r; CC[o + 1] = tmp.g; CC[o + 2] = tmp.b;
        }
      }
      mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.normal.needsUpdate = true; mesh.geometry.attributes.color.needsUpdate = true;
    }
  }
  dent(p, dir, depth, radius, maxDisp = 0.95) {
    const G = this.grid, R = this.rest;
    let any = false;
    for (let v = 0; v < this.nv; v++) {
      const x = G[v * 3], y = G[v * 3 + 1], z = G[v * 3 + 2];
      const dx = x - p.x, dy = y - p.y, dz = z - p.z, d = Math.hypot(dx, dy, dz);
      if (d > radius) continue;
      const k = Math.pow(1 - d / radius, 1.5) * (0.65 + 0.7 * vnoise(x * 11 + 3, z * 11 + y * 7));
      let nx = G[v * 3] + dir.x * depth * k, ny = G[v * 3 + 1] + dir.y * depth * k, nz = G[v * 3 + 2] + dir.z * depth * k;
      // limita deslocamento total a partir da posição original
      const ox = nx - R[v * 3], oy = ny - R[v * 3 + 1], oz = nz - R[v * 3 + 2], od = Math.hypot(ox, oy, oz);
      if (od > maxDisp) { const f = maxDisp / od; nx = R[v * 3] + ox * f; ny = R[v * 3 + 1] + oy * f; nz = R[v * 3 + 2] + oz * f; }
      G[v * 3] = nx; G[v * 3 + 1] = ny; G[v * 3 + 2] = nz;
      this.dmg[v] = Math.min(1, this.dmg[v] + k * (0.35 + depth * 1.5));
      any = true;
    }
    return any;
  }
  displacementAt(p) { // deslocamento acumulado interpolado (vértice mais próximo)
    const G = this.grid, R = this.rest; let best = 1e9, bi = 0;
    for (let v = 0; v < this.nv; v += 3) { const d = (R[v * 3] - p.x) ** 2 + (R[v * 3 + 1] - p.y) ** 2 + (R[v * 3 + 2] - p.z) ** 2; if (d < best) { best = d; bi = v; } }
    return [G[bi * 3] - R[bi * 3], G[bi * 3 + 1] - R[bi * 3 + 1], G[bi * 3 + 2] - R[bi * 3 + 2]];
  }
  reset() { this.grid.set(this.rest); this.dmg.fill(0); this.refresh(true); }
}

// ---------------------------------------------------------------
function sgnpow(v, e) { return Math.sign(v) * Math.pow(Math.abs(v), e); }

function makeProfiles(car, cfg, wheelCentersM, Rw) {
  const L = car.L, W = car.W, H = car.H, sp = car.shape;
  const xc = sp.xc * L, xrf = sp.xrf * L, xrr = sp.xrr * L, xt = sp.xt * L;
  const keepAsc = (pts) => { const o = []; for (const p of pts) if (!o.length || p[0] > o[o.length - 1][0] + 0.02) o.push(p); return o; };
  const bedH = sp.bed ? sp.bed[1] : null;
  const bedX = sp.bed ? sp.bed[0] * L : null;
  let lt;
  const belt0 = sp.belt[0], belt1 = sp.belt[1];
  if (sp.bed) {
    lt = keepAsc([[0, sp.nt], [0.012 * L, lerp(sp.nt, sp.hf, 0.45)], [0.10 * L, sp.hf], [xc * 0.55, lerp(sp.hf, belt0, 0.55)], [xc, belt0], [(xc + xt) / 2, (belt0 + belt1) / 2], [xt, belt1], [xt + 0.07, bedH + 0.02], [xt + 0.3, bedH], [L - 0.12, bedH], [L, bedH - 0.03]]);
  } else {
    lt = keepAsc([[0, sp.nt], [0.012 * L, lerp(sp.nt, sp.hf, 0.45)], [0.10 * L, sp.hf], [xc * 0.55, lerp(sp.hf, belt0, 0.55)], [xc, belt0], [(xc + xt) / 2, (belt0 + belt1) / 2], [xt, belt1], [xt + (L - xt) * 0.5, lerp(belt1, sp.tail, 0.5)], [L, sp.tail]]);
  }
  const lowerTop = pchip(lt.map(p => p[0]), lt.map(p => p[1]));
  const rt = keepAsc([[xc, belt0], [xc + (xrf - xc) * 0.35, lerp(belt0, H, 0.20)], [xc + (xrf - xc) * 0.75, lerp(belt0, H, 0.78)], [xrf, H - 0.04], [(xrf + xrr) / 2, H], [xrr, H - 0.04], [xrr + (xt - xrr) * 0.4, lerp(H, belt1, 0.38)], [xrr + (xt - xrr) * 0.8, lerp(H, belt1, 0.78)], [xt, belt1]]);
  const roofTop = pchip(rt.map(p => p[0]), rt.map(p => p[1]));
  const bt = keepAsc([[0, sp.nb], [0.05 * L, lerp(sp.nb, 0.14, 0.55)], [0.14 * L, 0.14], [L - 0.14 * L, 0.14], [L - 0.04 * L, lerp(0.14, sp.tb, 0.55)], [L, sp.tb]]);
  const bottom = pchip(bt.map(p => p[0]), bt.map(p => p[1]));
  const wb = cfg.widebody ? 0.03 : 0;
  const halfW = x => {
    const front = sp.fn + (1 - sp.fn) * sstep(0, 1.1, x), rear = sp.fr + (1 - sp.fr) * sstep(0, 0.9, L - x);
    let w = W / 2 * Math.min(front, rear) + wb;
    for (const xw of wheelCentersM) { const d = Math.abs(x - xw); if (d < 0.55) w += (cfg.widebody ? 0.035 : 0.012) * (1 + Math.cos(d / 0.55 * Math.PI)) / 2; }
    const rc = sp.beetle ? 0.34 : 0.15;
    const e0 = x < rc ? Math.sqrt(Math.max(0.0, 1 - Math.pow((rc - x) / rc, 2))) : 1;
    const e1 = L - x < rc ? Math.sqrt(Math.max(0.0, 1 - Math.pow((rc - (L - x)) / rc, 2))) : 1;
    return Math.max(0.06, w * Math.min(e0, e1) * (sp.beetle ? 1 : 1));
  };
  return { lowerTop, roofTop, bottom, halfW, xc, xrf, xrr, xt, L };
}

function buildBodySurfaces(car, cfg, wheelsM, paintFn) {
  const sp = car.shape, L = car.L, H = car.H;
  const wc = wheelsM.map(w => w.x);
  const pf = makeProfiles(car, cfg, wc, 0);
  const { lowerTop, roofTop, bottom, halfW, xc, xrf, xrr, xt } = pf;
  // estações
  const set = new Set();
  const add = x => { if (x >= 0 && x <= L) set.add(Math.round(x * 1000) / 1000); };
  for (let x = 0; x <= L + 1e-6; x += 0.07) add(x);
  for (const x of [0.01, 0.03, 0.06, L - 0.01, L - 0.03, L - 0.06, L, xc - 0.02, xc, xc + 0.02, xrf, xrr, xt - 0.04, xt - 0.015, xt, xt + 0.02]) add(x);
  for (const w of wheelsM) { const Ra = w.R + 0.06; for (let k = -8; k <= 8; k++) add(w.x + Ra * k / 8); add(w.x + Ra + 0.02); add(w.x - Ra - 0.02); }
  const xs = [...set].sort((a, b) => a - b);
  const M = 40, tum = sp.beetle ? 0.10 : 0.045, boxF = sp.boxy ? 1.7 : sp.beetle ? 0.8 : 1;
  const low = new Surface();
  const clampFlag = [];
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const yb = bottom(x), yt = Math.max(lowerTop(x), yb + 0.06), w = halfW(x);
    for (let j = 0; j < M; j++) {
      const th = -Math.PI / 2 + Math.PI * 2 * j / M, c = Math.cos(th), s = Math.sin(th);
      const nx = (s < 0 ? 6.5 : 5.4) * boxF, ny = (s < 0 ? 6.0 : 3.4) * boxF;
      let z = w * sgnpow(c, 2 / nx);
      let yr = 0.5 + 0.5 * sgnpow(s, 2 / ny);
      let y = yb + (yt - yb) * yr;
      z *= 1 - tum * yr * yr;
      if (s > 0) y += 0.012 * Math.max(0, 1 - Math.pow(z / w, 2)) * (sp.beetle ? 2.2 : 1);
      // cavas de roda
      let cl = 0;
      for (const wh of wheelsM) {
        const Ra = wh.R + 0.065 + (cfg.widebody ? 0.02 : 0), dx = x - wh.x;
        if (Math.abs(dx) < Ra && Math.abs(z) > 0.40 * w) {
          const ya = wh.y + Math.sqrt(Ra * Ra - dx * dx);
          if (y < ya) { y = Math.min(ya, yt - 0.04); cl = 1; }
        }
      }
      low.addVertex(x, y, z); clampFlag.push(cl);
    }
  }
  const ns = xs.length;
  // vértice centro das tampas
  const c0 = low.addVertex(0, (bottom(0) + lowerTop(0)) / 2, 0), c1 = low.addVertex(L, (bottom(L) + lowerTop(L)) / 2, 0);
  clampFlag.push(0, 0);
  const P = low.pos;
  const classify = (a, b, c, d, xm, ym, zm) => {
    const fl = clampFlag[a] + clampFlag[b] + clampFlag[c] + clampFlag[d];
    if (fl >= 4) return 'well';
    const yb = bottom(xm), w = halfW(xm);
    // normal aproximada (para classificar o fundo)
    const ay = P[a * 3 + 1], cy = P[c * 3 + 1];
    if (ym < yb + 0.015 + 0.0) return 'under';
    if (Math.abs(zm) > 0.52 * w && ym < yb + 0.115 && xm > 0.09 * L && xm < L - 0.09 * L) return 'trim';
    if ((xm < 0.075 * L || xm > L - 0.075 * L) && ym < yb + 0.20) return 'trim';
    if (sp.bed && xm > pf.xt + 0.22 && ym > lowerTop(xm) - 0.02) return 'liner';
    return 'paint';
  };
  for (let i = 0; i < ns - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + (j + 1) % M, d = (i + 1) * M + j;
    const xm = (P[a * 3] + P[c * 3]) / 2, ym = (P[a * 3 + 1] + P[c * 3 + 1] + P[b * 3 + 1] + P[d * 3 + 1]) / 4, zm = (P[a * 3 + 2] + P[c * 3 + 2]) / 2;
    const ctr = [xm, (bottom(xm) + lowerTop(xm)) / 2, 0];
    // fundo: quadrilátero com normal para baixo
    const cls = classify(a, b, c, d, xm, ym, zm);
    low.addQuad(cls, a, b, c, d, ctr);
  }
  for (let j = 0; j < M; j++) { // tampas
    const a = j, b = (j + 1) % M; low.addQuad('paint', a, b, c0, c0, [0.5, (bottom(0) + lowerTop(0)) / 2, 0]);
    const e = (ns - 1) * M; low.addQuad('paint', e + j, e + (j + 1) % M, c1, c1, [L - 0.5, (bottom(L) + lowerTop(L)) / 2, 0]);
  }
  low.finalize();

  // ---------- cabine ----------
  const gh = new Surface();
  const gxs = xs.filter(x => x >= xc - 0.001 && x <= xt + 0.001);
  const K = 6, RN = 2 * K + 1;
  for (const x of gxs) {
    const base = lowerTop(x) - 0.03, top = Math.max(roofTop(x), base + 0.001), hh = top - base;
    const bw = halfW(x) * (sp.beetle ? 0.90 : sp.boxy ? 0.94 : 0.865), rw = bw * sp.roofW;
    const pts = [];
    for (let k = 0; k <= K; k++) {
      const ph = k / K * Math.PI / 2, sn = Math.sin(ph), cs = Math.cos(ph);
      const zz = lerp(bw, rw, Math.pow(sn, 1.6)) * Math.pow(cs, 0.55);
      const yy = base + hh * Math.pow(sn, 0.9);
      pts.push([x, yy, zz]);
    }
    const ring = [];
    for (let k = 0; k <= K; k++) ring.push([pts[k][0], pts[k][1], pts[k][2]]);
    for (let k = K - 1; k >= 0; k--) ring.push([pts[k][0], pts[k][1], -pts[k][2]]);
    for (const p of ring) gh.addVertex(p[0], p[1], p[2]);
  }
  const gn = gxs.length;
  const door4 = sp.door === 4;
  const xA = xc + (xrf - xc) * 0.5, xB = xrf + (xrr - xrf) * 0.52, xC = xrr + (xt - xrr) * 0.42;
  const Pg = gh.pos;
  for (let i = 0; i < gn - 1; i++) {
    const xm = (gxs[i] + gxs[i + 1]) / 2;
    for (let r = 0; r < RN - 1; r++) {
      const a = i * RN + r, b = i * RN + r + 1, c = (i + 1) * RN + r + 1, d = (i + 1) * RN + r;
      const k = r < K ? r : (RN - 2 - r);       // segmento 0..K-1 simétrico
      let cls;
      if (xm < xrf) cls = k >= 3 ? 'glass' : (xm > xA ? 'glass' : 'paint');
      else if (xm <= xrr) { if (k >= 3) cls = 'paint'; else cls = (door4 && Math.abs(xm - xB) < 0.065) ? 'paint' : 'glass'; }
      else cls = k >= 3 ? 'glass' : (xm < xC ? 'glass' : 'paint');
      const ym = (lowerTop(xm) + roofTop(xm)) / 2;
      gh.addQuad(cls, a, b, c, d, [xm, lowerTop(xm) - 0.05, 0]);
    }
  }
  // fecha as pontas (quando a seção ainda tem altura)
  gh.finalize();
  return { low, gh, pf, M, xs, gxs };
}

// ---------------------------------------------------------------
//  rodas
// ---------------------------------------------------------------
let treadTex = null;
function getTreadTex() {
  if (treadTex) return treadTex;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = '#1a1a1c'; g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#101012';
  for (let i = 0; i < 32; i++) { g.fillRect(i * 8 + 1, 14, 3, 36); }
  g.fillStyle = '#232326'; g.fillRect(0, 30, 256, 3);
  treadTex = new THREE.CanvasTexture(cv); treadTex.wrapS = THREE.RepeatWrapping; treadTex.colorSpace = THREE.SRGBColorSpace; treadTex.anisotropy = 4;
  return treadTex;
}

export function buildWheelMesh(tire, style, rimColor, brakeBig, side) {
  const { w, R, rim, side: sw } = tireDims(...tire);
  const g = new THREE.Group();
  // pneu
  const rr = rim, hw = w / 2;
  const prof = [
    [rr + 0.004, -hw * 0.80], [rr + sw * 0.18, -hw * 0.97], [rr + sw * 0.55, -hw * 1.0], [R - sw * 0.16, -hw * 0.93], [R - 0.012, -hw * 0.70], [R, -hw * 0.40], [R + 0.002, 0],
    [R, hw * 0.40], [R - 0.012, hw * 0.70], [R - sw * 0.16, hw * 0.93], [rr + sw * 0.55, hw * 1.0], [rr + sw * 0.18, hw * 0.97], [rr + 0.004, hw * 0.80],
  ];
  const lp = prof.map(p => new THREE.Vector2(p[0], p[1]));
  const tg = new THREE.LatheGeometry(lp, 56); tg.rotateX(Math.PI / 2);
  // UV para a banda de rodagem
  const uv = tg.attributes.uv;
  for (let i = 0; i < uv.count; i++) { uv.setX(i, uv.getX(i) * 2); }
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2d, roughness: 0.92, metalness: 0, map: getTreadTex() });
  const tm = new THREE.Mesh(tg, tireMat); tm.castShadow = true; g.add(tm);
  // aro
  const st = WHEEL_STYLES[style] || WHEEL_STYLES.five;
  const rimMat = new THREE.MeshStandardMaterial({ color: rimColor, metalness: st.kind === 'steel' ? 0.5 : 0.9, roughness: st.kind === 'steel' ? 0.5 : 0.22 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x08080a, roughness: 0.8, metalness: 0.2 });
  const barrel = [[rr - 0.012, -hw * 0.78], [rr + 0.004, -hw * 0.82], [rr + 0.004, -hw * 0.70], [rr - 0.018, -hw * 0.55], [rr - 0.02, hw * 0.5], [rr + 0.004, hw * 0.78], [rr + 0.012, hw * 0.83]].map(p => new THREE.Vector2(p[0], p[1]));
  const bg = new THREE.LatheGeometry(barrel, 40); bg.rotateX(Math.PI / 2);
  const bm = new THREE.Mesh(bg, rimMat); g.add(bm);
  const dish = st.dish, zf = hw * 0.55 - dish;   // face do aro (axial, +z para fora)
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(rr - 0.02, rr - 0.02, 0.02, 24, 1, true), dark); inner.rotation.x = Math.PI / 2; inner.position.z = -hw * 0.2; g.add(inner);
  if (st.kind === 'steel') {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(rr - 0.015, rr - 0.015, 0.012, 40), rimMat); disc.rotation.x = Math.PI / 2; disc.position.z = zf - 0.006; g.add(disc);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const h = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.13, rr * 0.13, 0.016, 12), dark); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * rr * 0.58, Math.sin(a) * rr * 0.58, zf); g.add(h); }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.28, rr * 0.28, 0.03, 20), new THREE.MeshStandardMaterial({ color: 0x9a9ea4, metalness: 0.8, roughness: 0.3 })); cap.rotation.x = Math.PI / 2; cap.position.z = zf + 0.01; g.add(cap);
    if (st.bolts) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0xb0b4ba, metalness: 0.9, roughness: 0.3 })); b.rotation.x = Math.PI / 2; b.position.set(Math.cos(a) * (rr - 0.02), Math.sin(a) * (rr - 0.02), hw * 0.62); g.add(b); }
  } else {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.22, rr * 0.24, 0.05, 20), rimMat); hub.rotation.x = Math.PI / 2; hub.position.z = zf; g.add(hub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.12, rr * 0.12, 0.04, 16), new THREE.MeshStandardMaterial({ color: 0x15161a, metalness: 0.6, roughness: 0.4 })); cap.rotation.x = Math.PI / 2; cap.position.z = zf + 0.02; g.add(cap);
    const n = st.spokes, len = rr - 0.03 - rr * 0.18;
    const sg = new THREE.BoxGeometry(len, Math.max(0.006, rr * st.w), 0.022 + (st.kind === 'spoke' ? 0.012 : 0));
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const mk = (da, zo, tw) => {
        const m = new THREE.Mesh(sg, rimMat); const rad = rr * 0.18 + len / 2;
        m.position.set(Math.cos(a + da) * rad, Math.sin(a + da) * rad, zf - 0.005 + zo); m.rotation.z = a + da; if (tw) m.rotation.x = tw; g.add(m);
      };
      if (st.kind === 'fan') mk(0, 0, 0.5);
      else if (st.kind === 'mesh') { mk(0.12, 0, 0); mk(-0.12, -0.012, 0); }
      else if (st.twin) { mk(0.06, 0, 0); mk(-0.06, 0, 0); }
      else mk(0, 0, 0);
    }
    // anel de ligação raios-aro
    const ring = new THREE.Mesh(new THREE.TorusGeometry(rr - 0.025, 0.007, 6, 40), rimMat); ring.position.z = zf - 0.004; g.add(ring);
  }
  g.userData.radius = R;
  return g;
}

function brakeParts(R, rimR, big, hw, color) {
  const grp = new THREE.Group();
  const dr = Math.min(R * 0.78, rimR * 0.96);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(dr, dr, 0.028, 36), new THREE.MeshStandardMaterial({ color: 0x4a4b50, metalness: 0.85, roughness: 0.45 }));
  disc.rotation.x = Math.PI / 2; disc.position.z = -hw * 0.30;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.34, rimR * 0.34, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0x2c2d31, metalness: 0.7, roughness: 0.5 }));
  hat.rotation.x = Math.PI / 2; hat.position.z = -hw * 0.30;
  const cal = new THREE.Mesh(new THREE.BoxGeometry(dr * 0.5, dr * 0.34, 0.07), new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 }));
  cal.position.set(0.03, dr * 0.74 - 0.02, -hw * 0.30 + 0.002); cal.rotation.z = 0.0;
  return { disc: new THREE.Group().add(disc, hat), caliper: cal };
}

// ---------------------------------------------------------------
//  Carro completo
// ---------------------------------------------------------------
export class CarModel {
  constructor(spec, cfg) {
    this.spec = spec; this.cfg = cfg; this.car = spec.car;
    this.root = new THREE.Group();
    this.dents = []; this.details = [];
    this.build();
  }

  build() {
    const { spec, cfg, car } = this;
    const sp = car.shape, L = car.L, W = car.W, H = car.H;
    const root = this.root;
    const body = this.bodyGroup = new THREE.Group();
    body.rotation.y = Math.PI; body.position.copy(spec.meshOff);
    root.add(body);
    // posição das rodas em coordenadas do modelo (x a partir do nariz, y acima do chão do projeto)
    const lift = spec.cgH - car.cgH;
    const wheelsM = spec.wheels.map(w => ({ x: car.fo + (w.axle === 0 ? 0 : car.WB), y: w.R - lift, R: w.R, z: -w.z }));
    this.wheelsM = wheelsM;
    // materiais
    const fin = FINISH[cfg.finish] || FINISH.metal;
    this.paintColor = new THREE.Color(cfg.paint);
    const paintMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: fin.rough, metalness: fin.metal, clearcoat: fin.cc, clearcoatRoughness: fin.ccr, envMapIntensity: 1.0 });
    const trimMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
    const darkMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
    const glassMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.30 + 0.5 * cfg.tint, envMapIntensity: 1.6, clearcoat: 1, side: THREE.FrontSide, depthWrite: false });
    this.mats = { paintMat, glassMat, trimMat };
    const S = buildBodySurfaces(car, cfg, wheelsM);
    this.low = S.low; this.gh = S.gh; this.pf = S.pf;
    const mfor = { paint: paintMat, trim: trimMat, under: darkMat, well: darkMat, liner: darkMat, glass: glassMat };
    const P = cfg.parts || {};
    const rc = CATS.roofcolor.opts[P.roofcolor | 0], rcCol = rc && rc.v ? new THREE.Color(rc.v) : null;
    const sp0 = CATS.stripes.opts[P.stripes | 0].p, stCol = new THREE.Color(cfg.stripeColor || '#f2f2f2');
    const covf = sp0 ? this.stripeFn(sp0, S.pf) : null;
    const colorFor = (k, v, d, out, surf) => {
      if (k === 'paint') {
        out.copy(rcCol && surf === this.gh ? rcCol : this.paintColor);
        if (covf) { const R = surf.rest, c = covf(R[v * 3], R[v * 3 + 1], R[v * 3 + 2]); if (c > 0) out.lerp(stCol, c); }
        out.lerp(C_SCRATCH, Math.min(0.85, d * 0.9));
      }
      else if (k === 'trim') out.copy(C_TRIM).lerp(C_SCRATCH, d * 0.5);
      else if (k === 'under') out.copy(C_UNDER);
      else if (k === 'well') out.copy(C_WELL);
      else if (k === 'liner') out.copy(C_LINER);
      else if (k === 'glass') out.copy(C_GLASS).lerp(C_CRACK, Math.min(0.9, d * 1.6));
    };
    this.low.build(mfor, colorFor, body); this.gh.build(mfor, colorFor, body);
    for (const m of [...this.low.meshes, ...this.gh.meshes]) if (m.userData.batch === 'glass') m.renderOrder = 2;
    this.addDetails(body, S.pf);
    this.addParts(body, S.pf);
    this.addInterior(body, S.pf);
    this.addWheels();
    this.addLights();
  }

  addDet(mesh, parent, keep = true) {
    parent.add(mesh);
    this.details.push({ mesh, p0: mesh.position.clone(), r0: mesh.rotation.clone(), hidden: false });
    return mesh;
  }

  addDetails(body, pf) {
    const { car, cfg } = this, sp = car.shape, L = car.L, W = car.W, H = car.H;
    const lowerTop = pf.lowerTop, halfW = pf.halfW;
    const black = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.6, metalness: 0.2 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.15, metalness: 1.0 });
    const carbon = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.35, metalness: 0.5 });
    const lens = this.lensMat = new THREE.MeshStandardMaterial({ color: 0xe6edf2, roughness: 0.1, metalness: 0.1, emissive: 0xffffff, emissiveIntensity: 0.0 });
    const tail = this.tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0a0a, roughness: 0.2, metalness: 0.1, emissive: 0xff1010, emissiveIntensity: 0.25 });
    const rev = this.revMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, emissive: 0xffffff, emissiveIntensity: 0.0 });
    const paintDet = new THREE.MeshPhysicalMaterial({ color: cfg.paint, roughness: FINISH[cfg.finish].rough, metalness: FINISH[cfg.finish].metal, clearcoat: FINISH[cfg.finish].cc, clearcoatRoughness: 0.05 });
    this.paintDet = paintDet;
    const bx = (w, h, d, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.castShadow = true; return m; };
    const place = (m, x, y, z, ry = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.y = ry; m.rotation.z = rz; return m; };
    const hl = sp.beetle ? 0.20 : sp.boxy ? 0.0 : 0.0;
    // faróis
    const xh = sp.boxy ? 0.07 : 0.16, zh = halfW(xh) * (sp.boxy ? 0.78 : 0.68), yh = lowerTop(xh) - (sp.boxy ? 0.18 : 0.095);
    for (const sg of [-1, 1]) {
      let m;
      if (sp.boxy || sp.beetle) { m = new THREE.Mesh(new THREE.SphereGeometry(sp.boxy ? 0.095 : 0.085, 14, 10), lens); m.scale.set(0.45, 1, 1); m.position.set(xh - 0.01, yh + (sp.beetle ? 0.05 : 0.03), sg * zh * (sp.beetle ? 1.1 : 1)); }
      else { m = bx(0.10, 0.075 + (car.cls === 'Supercarro' ? -0.02 : 0), car.cls === 'Supercarro' ? 0.34 : 0.40, lens); place(m, xh - 0.02, yh, sg * zh, sg * -0.38); }
      this.addDet(m, body);
      // lanternas traseiras
      const xt2 = L - 0.075, zt = halfW(xt2) * 0.70, yt2 = (sp.bed ? sp.bed[1] - 0.1 : lowerTop(xt2) - 0.15);
      const t = bx(0.05, 0.085, sp.boxy ? 0.14 : 0.36, tail); place(t, xt2, yt2, sg * zt, sg * 0.22); this.addDet(t, body);
      const r2 = bx(0.04, 0.04, 0.1, rev); place(r2, xt2 + 0.005, yt2 - 0.08, sg * zt * 0.72); this.addDet(r2, body);
    }
    // setas (esquerda = +z no modelo) e limpadores de para-brisa
    this.sigMat = [0, 1].map(() => new THREE.MeshStandardMaterial({ color: 0x5a3a00, roughness: 0.3, emissive: 0xff9a10, emissiveIntensity: 0 }));
    for (const sg of [-1, 1]) {
      const m = this.sigMat[sg > 0 ? 0 : 1], xf = 0.10, zf = halfW(xf) * 0.86, yf = lowerTop(xf) - 0.20;
      const f = bx(0.05, 0.05, 0.14, m); place(f, xf - 0.005, yf, sg * zf, sg * -0.3); this.addDet(f, body);
      const xr = L - 0.07, zr = halfW(xr) * 0.84, yr = (sp.bed ? sp.bed[1] - 0.1 : lowerTop(xr) - 0.15) + 0.10;
      const r = bx(0.04, 0.05, 0.14, m); place(r, xr + 0.005, yr, sg * zr, sg * 0.3); this.addDet(r, body);
    }
    this.wipers = [];
    { const th = Math.atan2(H - sp.belt[0], pf.xrf - pf.xc);
      for (const zz of [-0.28, 0.22]) { const piv = new THREE.Group(); piv.position.set(pf.xc + 0.07, lowerTop(pf.xc + 0.07) + 0.012, zz); piv.rotation.z = th * 0.92;
        const sw = new THREE.Group(), arm = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.008, 0.016), black); arm.position.x = 0.23; sw.add(arm); piv.add(sw); body.add(piv); this.wipers.push(sw); sw.rotation.y = -1.45; } }
    // grade dianteira
    if (!sp.beetle) { const g = bx(0.05, sp.boxy ? 0.36 : 0.095, W * (sp.boxy ? 0.36 : 0.40), black); place(g, 0.025 + (sp.boxy ? 0.0 : 0.03), lowerTop(0.04) - (sp.boxy ? 0.22 : 0.15), 0); this.addDet(g, body);
      if (sp.boxy) for (let i = -3; i <= 3; i++) { const sl = bx(0.04, 0.34, 0.012, chrome); place(sl, 0.008, lowerTop(0.04) - 0.22, i * 0.065); this.addDet(sl, body); } }
    // para-choques cromados (fusca) e frisos
    if (sp.beetle) for (const x of [0.02, L - 0.02]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, W * 0.86, 10), chrome); c.rotation.x = Math.PI / 2; c.position.set(x, 0.40, 0); c.castShadow = true; this.addDet(c, body); }
    // placas
    const pst = (cfg.parts && cfg.parts.plates) | 0; const PS = [['#f2f2f2', '#1a3f8a', '#111', 'BDR-1A23'], ['#c8c8c8', '#c8c8c8', '#111', 'ABC-1234'], ['#f2f2f2', '#1a3f8a', '#111', 'B-DR 2026'], ['#f2f2f2', '#b01820', '#102060', 'BEAM 123'], ['#101010', '#101010', '#e8e8e8', 'CLASSIC'], ['#f2f2f2', '#f2f2f2', '#f2f2f2', '']][pst];
    const plate = (x, y, face) => { const cv = document.createElement('canvas'); cv.width = 128; cv.height = 64; const g = cv.getContext('2d'); g.fillStyle = PS[0]; g.fillRect(0, 0, 128, 64); g.fillStyle = PS[1]; g.fillRect(0, 0, 128, 14); g.fillStyle = PS[2]; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText(PS[3], 64, 50); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(0.40, 0.14), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 })); m.position.set(x, y, 0); m.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2; return m; };
    if (pst !== 5) { this.addDet(plate(0.004, sp.nb + 0.18, -1), body);
    this.addDet(plate(L + 0.001 - 0.003, (sp.bed ? sp.bed[1] - 0.25 : sp.tb + 0.30), 1), body); }
    // retrovisores
    const xm = pf.xc + (pf.xrf - pf.xc) * 0.38, ym = lowerTop(xm) + 0.10;
    for (const sg of [-1, 1]) {
      const mm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.15), paintDet); mm.position.set(xm, ym - 0.03, sg * (halfW(xm) * 0.96 + 0.075)); mm.castShadow = true; this.addDet(mm, body);
      const arm = bx(0.05, 0.03, 0.09, black); arm.position.set(xm + 0.02, ym - 0.04, sg * (halfW(xm) * 0.94 + 0.02)); this.addDet(arm, body);
    }
    // maçanetas
    const doors = sp.door === 4 ? [pf.xrf + (pf.xrr - pf.xrf) * 0.30, pf.xrf + (pf.xrr - pf.xrf) * 0.86] : [pf.xrf + (pf.xrr - pf.xrf) * 0.45];
    for (const x of doors) for (const sg of [-1, 1]) { const hm = bx(0.16, 0.025, 0.02, chrome); hm.position.set(x, lowerTop(x) - 0.09, sg * (halfW(x) * 0.985)); this.addDet(hm, body); }
    // escapamento
    const tp = (cfg.parts && cfg.parts.tips) | 0, TIPM = [chrome, chrome, chrome, black, new THREE.MeshStandardMaterial({ color: 0x6a7aa8, metalness: 1, roughness: 0.25 }), carbon, chrome, chrome, chrome, chrome][tp];
    const ex = (z, r = 0.04) => { r = r * (tp === 8 ? 1.5 : tp === 1 ? 1.15 : 1); const e = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.12, tp === 8 ? 8 : 14), TIPM); e.rotation.z = Math.PI / 2; e.position.set(L + 0.01, car.shape.tb + 0.02, z); this.addDet(e, body); };
    if (this.spec.eng.kind !== 'ev') {
      if (car.cls === 'Supercarro') { ex(-0.28, 0.05); ex(0.28, 0.05); }
      else if (car.cls === 'Muscle car' || car.cls === 'Esportivo') { ex(-0.5); ex(0.5); }
      else ex(-halfW(L - 0.1) * 0.6);
      if (tp === 2 || tp === 6) ex(halfW(L - 0.1) * 0.6 * (car.cls === 'Supercarro' ? 0 : 1));
      if (tp === 6) { ex(-0.3); ex(0.3); }
      if (tp === 7) ex(0, 0.06);
    }
    // kits
    const hatch = pf.xt > L - 0.55 && !sp.bed;
    const wx0 = hatch ? pf.xt - 0.04 : L - 0.36, wingTop = hatch ? pf.roofTop(pf.xt - 0.06) - 0.02 : Math.max(sp.bed ? sp.bed[1] : sp.tail, lowerTop(L - 0.36));
    const w = cfg.wing;
    const wingW = W * 0.88;
    const wg = new THREE.Group();
    if (w === 'lip') { const m = bx(0.12, 0.035, W * 0.78, carbon); m.position.set(wx0, wingTop + 0.015, 0); m.rotation.z = -0.1; wg.add(m); }
    else if (w === 'duck') { const m = bx(0.2, 0.03, W * 0.8, carbon); m.position.set(wx0 + 0.05, wingTop + 0.04, 0); m.rotation.z = 0.28; wg.add(m); }
    else if (w === 'gt' || w === 'big') {
      const big = w === 'big', h = big ? 0.46 : 0.30, xw = wx0 - (big ? 0.0 : 0.0) + (hatch ? 0.12 : 0), cw = big ? 0.34 : 0.26;
      const plane = bx(cw, 0.035, wingW * (big ? 1.0 : 0.95), carbon); plane.position.set(xw, wingTop + h, 0); plane.rotation.z = big ? 0.12 : 0.05; wg.add(plane);
      for (const sg of [-1, 1]) {
        const up = bx(0.07, h, 0.035, carbon); up.position.set(xw, wingTop + h / 2, sg * wingW * 0.3); wg.add(up);
        if (big) { const ep = bx(cw * 1.2, 0.2, 0.02, carbon); ep.position.set(xw, wingTop + h, sg * wingW * 0.5); wg.add(ep); }
      }
    }
    if (wg.children.length) { wg.children.forEach(c => { c.castShadow = true; }); this.addDet(wg, body); }
    if (cfg.splitter !== 'none') {
      const big = cfg.splitter === 'race', mid = cfg.splitter === 'split';
      const sx = mid || big ? 0.20 : 0.12;
      const s = bx(sx, 0.02, W * (big ? 0.97 : 0.9), carbon); s.position.set(sx / 2 - 0.08, 0.10, 0); this.addDet(s, body);
      if (big) for (const sg of [-1, 1]) { const ep = bx(0.3, 0.12, 0.02, carbon); ep.position.set(0.05, 0.13, sg * W * 0.48); this.addDet(ep, body); }
    }
    if (cfg.diffuser) { for (let i = -3; i <= 3; i++) { const f = bx(0.35, 0.16, 0.012, black); f.position.set(L - 0.18, 0.2, i * 0.15); f.rotation.z = 0.3; this.addDet(f, body); } }
    if (cfg.scoop) { const sc = bx(0.5, 0.07, 0.4, paintDet); const xs2 = pf.xc * 0.55; sc.position.set(xs2, lowerTop(xs2) + 0.035, 0); this.addDet(sc, body); const sg2 = bx(0.04, 0.06, 0.3, black); sg2.position.set(xs2 - 0.26, lowerTop(xs2) + 0.045, 0); this.addDet(sg2, body); }
    if (cfg.lightbar) {
      const yr = H + 0.025, bar = bx(0.12, 0.07, W * 0.7, black); bar.position.set((pf.xrf + pf.xrr) / 2 - 0.05, yr, 0); this.addDet(bar, body);
      for (let i = -4; i <= 4; i++) { const l = bx(0.02, 0.05, 0.12, lens); l.position.set((pf.xrf + pf.xrr) / 2 - 0.12, yr, i * 0.14); this.addDet(l, body); }
    }
    if (sp.boxy) { const sw = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 20), new THREE.MeshStandardMaterial({ color: 0x1d1d20, roughness: 0.9 })); sw.rotation.z = Math.PI / 2; sw.position.set(L + 0.1, 0.9, 0); this.addDet(sw, body); }
    if (sp.bed) { const rail = bx(L - pf.xt - 0.4, 0.03, 0.03, black); for (const sg of [-1, 1]) { const r = rail.clone(); r.position.set((pf.xt + L) / 2 + 0.1, sp.bed[1] + 0.02, sg * (W / 2 - 0.05)); this.addDet(r, body); } }
  }

  stripeFn(p, pf) {
    const { car } = this, L = car.L, W = car.W, H = car.H, hw = W / 2, xc = pf.xc, xrf = pf.xrf, xrr = pf.xrr, xt = pf.xt;
    const [t, a1, a2] = p, st = x => Math.max(0, Math.min(1, x));
    const top = (y) => y > H * 0.58;
    return (x, y, z) => {
      const a = Math.abs(z) / hw, u = x / L, yh = y / H;
      switch (t) {
        case 'center': return top(y) && a < a1 ? 1 : 0;
        case 'dual': return top(y) && Math.abs(a - a2) < a1 / 2 ? 1 : 0;
        case 'side': return a > 0.84 && Math.abs(yh - a1) < a2 / 2 && u > 0.08 && u < 0.92 ? 1 : 0;
        case 'hood': return x < xc && a < a1 && top(y) ? 1 : 0;
        case 'roof': return x > xrf * 0.95 && x < xrr * 1.02 && a < a1 && yh > 0.85 ? 1 : 0;
        case 'rear': return x > xt - 0.05 && a < a1 && top(y) ? 1 : 0;
        case 'lower': return yh < a1 ? 1 : 0;
        case 'grad': return a1 === 0 ? st(1 - u * 3) : a1 === 1 ? st((u - 0.62) * 2.6) : st((a - 0.55) * 2.2) * (yh < 0.6 ? 1 : 0);
        case 'check': { const inR = a1 < 0.15 ? (yh > 0.85 && x > xrf && x < xrr) : (x < xc && top(y)); return inR && ((Math.floor(x / 0.12) + Math.floor(z / 0.12)) & 1) ? 1 : 0; }
        case 'diag': return a > 0.8 && Math.abs((u - 0.5) - (yh - 0.5) * 0.9 * (1 + a1)) < 0.06 * (1 + a1) ? 1 : 0;
        case 'flame': { if (a < 0.84) return 0; const b = a1 === 0 ? 0.28 : 0.34; return yh > b && yh < b + 0.2 * Math.max(0, 1 - u * (a1 === 0 ? 1.6 : 2.4)) * (0.45 + 0.55 * Math.abs(Math.sin(u * 40))) ? 1 : 0; }
        case 'num': return a > 0.84 && Math.hypot((u - 0.5) * L, (yh - 0.62) * H) < 0.2 ? 1 : 0;
        case 'hex': return a > 0.84 && Math.sin(x * 11) * Math.sin(y * 11 + x * 3) > 0.55 ? 1 : 0;
        case 'dots': return a > 0.7 && (((x * 7) % 1) - 0.5) ** 2 + (((y * 7) % 1) - 0.5) ** 2 < 0.05 ? 1 : 0;
        case 'lemans': return top(y) && (a1 === 0 ? (a < 0.07 || (a > 0.12 && a < 0.19)) : (a < 0.2 || (a > 0.3 && a < 0.34))) ? 1 : 0;
      }
      return 0;
    };
  }

  addParts(body, pf) {
    const { car, cfg, spec } = this, L = car.L, W = car.W, H = car.H, P = cfg.parts || {}, I = k => P[k] | 0;
    const lt = pf.lowerTop, hwid = pf.halfW;
    const M = (c, r = 0.5, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const black = M(0x0b0b0d, 0.6), steel = M(0x8a8f96, 0.35, 0.8), carbon = M(0x15161a, 0.35, 0.5), alu = M(0xb0b4ba, 0.3, 0.9);
    const lamp = new THREE.MeshStandardMaterial({ color: 0xfff4d8, emissive: 0xffe8b0, emissiveIntensity: 1.4 });
    const paintM = this.paintDet;
    const bx = (w, h, d, m, x, y, z, ry = 0, rz = 0, rx = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; this.addDet(o, body); return o; };
    const cy = (r, h, m, x, y, z, rx = 0, rz = 0, seg = 14) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m); o.position.set(x, y, z); o.rotation.set(rx, 0, rz); o.castShadow = true; this.addDet(o, body); return o; };
    const hoodStrips = (m) => { for (let k = 0; k < 6; k++) { const x = pf.xc * (0.12 + k * 0.15); bx(pf.xc * 0.16, 0.012, W * 0.62, m, x, lt(x) + 0.008, 0); } };
    { const i = I('hoodstyle'), xh = pf.xc * 0.5, y = lt(xh);
      if (i === 1) { bx(0.7, 0.1, 0.5, paintM, xh, y + 0.05, 0); bx(0.05, 0.06, 0.42, black, xh - 0.35, y + 0.06, 0); }
      if (i === 2) for (const sg of [-1, 1]) { bx(0.34, 0.025, 0.12, black, xh, y + 0.012, sg * 0.28); }
      if (i === 3) hoodStrips(carbon);
      if (i === 4) for (let k = 0; k < 6; k++) bx(0.03, 0.02, 0.5, black, xh - 0.15 + k * 0.07, lt(xh) + 0.01, 0);
      if (i === 5) for (const [dx, dz] of [[-0.3, 0.45], [-0.3, -0.45], [0.3, 0.45], [0.3, -0.45]]) cy(0.012, 0.02, steel, xh + dx, lt(xh + dx) + 0.01, dz);
      if (i === 6) bx(0.9, 0.06, 0.5, paintM, xh, y + 0.03, 0);
      if (i === 7) hoodStrips(M(0x0a0a0a, 0.95, 0)); }
    { const i = I('roofacc'), xm = (pf.xrf + pf.xrr) / 2, y = H + 0.01, wd = (pf.xrr - pf.xrf);
      if (i === 1) { for (const sg of [-1, 1]) bx(wd * 0.9, 0.03, 0.03, black, xm, y + 0.07, sg * W * 0.3); for (let k = 0; k < 3; k++) bx(0.04, 0.03, W * 0.62, black, xm + (k - 1) * wd * 0.35, y + 0.08, 0); }
      if (i === 2) bx(wd * 0.75, 0.2, W * 0.5, black, xm, y + 0.12, 0);
      if (i === 3) bx(0.22, 0.07, 0.02, black, pf.xrr - 0.2, y + 0.03, 0, 0, -0.2);
      if (i === 4) for (const sg of [-1, 1]) { bx(wd * 0.9, 0.025, 0.03, black, xm, y + 0.04, sg * W * 0.34); }
      if (i === 5) for (const sg of [-1, 1]) bx(wd * 0.8, 0.03, 0.05, steel, xm, y + 0.05, sg * W * 0.12);
      if (i === 6) cy(0.3, 0.1, black, xm, y + 0.1, 0, Math.PI / 2, 0, 20);
      if (i === 7) { for (let k = -2; k <= 2; k++) { const o = cy(0.06, 0.05, lamp, pf.xrf + 0.1, y + 0.06, k * 0.17, 0, 0, 12); o.rotation.z = Math.PI / 2; } } }
    { const i = I('wingkit'); if (i) { const big = i > 6, xw = L - 0.2 - (i % 3) * 0.04, yw = Math.max(lt(L - 0.3), car.shape.tail) + 0.18 + 0.03 * i;
        bx(0.2 + 0.02 * i, 0.03, W * (0.7 + 0.02 * (i % 6)), carbon, xw, yw, 0, 0, 0.1 + 0.02 * i);
        for (const sg of [-1, 1]) { bx(0.05, Math.max(0.1, yw - lt(xw) + 0.02), 0.03, carbon, xw, (yw + lt(xw)) / 2, sg * W * 0.28); if (big) bx(0.3, 0.2, 0.02, carbon, xw, yw, sg * W * 0.47); }
        if (i === 9) bx(0.14, 0.03, W * 0.7, carbon, xw, yw + 0.12, 0, 0, 0.25); } }
    { const i = I('splitter2'); if (i) { const d = 0.08 + 0.03 * i; bx(d, 0.02, W * (0.78 + 0.02 * i), carbon, d / 2 - 0.05, 0.1, 0); if (i > 3) for (const sg of [-1, 1]) bx(0.3, 0.1, 0.02, carbon, 0.1, 0.14, sg * W * 0.48); } }
    { const i = I('diffuser2'); if (i) for (let k = -i - 1; k <= i + 1; k++) bx(0.35, 0.14, 0.01, black, L - 0.18, 0.2, k * (W * 0.4 / (i + 1)), 0, 0.3); }
    { const i = I('canards'); if (i) for (const sg of [-1, 1]) for (let k = 0; k < i; k++) bx(0.18, 0.012, 0.12, carbon, 0.2 + k * 0.1, 0.3 + k * 0.05, sg * (W * 0.44 - k * 0.03), sg * 0.4); }
    { const i = I('skirts'); if (i) for (const sg of [-1, 1]) bx(pf.xt - pf.xc * 0.7, 0.05 + 0.012 * i, 0.04 + 0.008 * i, carbon, (pf.xc * 0.7 + pf.xt) / 2 + 0.2, 0.2, sg * (W / 2 - 0.01)); }
    { const i = I('floor'); if (i) bx(L * 0.7, 0.012, W * 0.7, carbon, L / 2, 0.11, 0); }
    { const i = I('roofsp'); if (i) bx(0.2, 0.02, W * 0.5, carbon, pf.xrr - 0.05, H - 0.02 + 0.03 * i, 0, 0, 0.25); }
    { const i = I('louvers'); if (i) for (let k = 0; k < 3 + (i - 1) * 2; k++) bx(0.01, 0.015, W * 0.46, black, pf.xt - 0.2 - k * 0.07, H * 0.8 - k * 0.03, 0, 0, 0.5); }
    { const i = I('hoodvent'); if (i) { const n = 1 + (i % 3), x0 = pf.xc * 0.5; for (let k = 0; k < n + 1; k++) bx(0.22, 0.025, 0.1, black, x0 + k * 0.1, lt(x0 + k * 0.1) + 0.01, i > 4 ? 0 : (k - n / 2) * 0.25); } }
    { const i = I('frontkit'); if (i) { bx(0.12, 0.05 + 0.008 * i, W * 0.8, carbon, 0.06, 0.2, 0); for (const sg of [-1, 1]) bx(0.08, 0.1, 0.18, black, 0.1, 0.4, sg * W * 0.34); } }
    { const i = I('rearkit'); if (i) { bx(0.1, 0.08 + 0.01 * i, W * 0.8, carbon, L - 0.05, 0.25, 0); if (i > 2) for (const sg of [-1, 1]) bx(0.08, 0.1, 0.12, black, L - 0.1, 0.3, sg * W * 0.35); } }
    { const i = I('flares'); if (i) for (const w of this.wheelsM) for (const sg of [-1, 1]) bx(w.R * 2.3, 0.04 + 0.01 * i, 0.03 + 0.012 * i, carbon, w.x, w.y + w.R * 0.9, sg * (hwid(w.x) + 0.01 + 0.006 * i), 0, 0); }
    { const i = I('bullbar'); if (i) { for (const sg of [-1, 1]) cy(0.03, 0.55, steel, -0.08, 0.6, sg * W * 0.3, 0, 0); cy(0.03, W * 0.62, steel, -0.1, 0.45 + 0.1 * (i % 2), 0, Math.PI / 2, 0); if (i > 1) bx(0.1, 0.2, W * 0.7, black, -0.04, 0.35, 0); } }
    { const i = I('winch'); if (i) bx(0.2, 0.14, 0.3, M(0x26282c, 0.4, 0.6), -0.02, 0.38, 0); }
    { const i = I('snorkel'); if (i) cy(0.05, H * 0.35 + 0.15 * i, black, pf.xc + 0.1, lt(pf.xc) + H * 0.15, W / 2 - 0.02, 0, 0); }
    { const i = I('spare'); if (i === 1 || i === 2) for (let k = 0; k < i; k++) cy(0.34, 0.2, M(0x161618, 0.9, 0), L + 0.12 + k * 0.22, car.shape.tail * 0.65, 0, 0, Math.PI / 2, 20); }
    { const i = I('mudflaps'); if (i) for (const w of this.wheelsM) for (const sg of [-1, 1]) bx(0.02, 0.2 + 0.03 * i, 0.2 + 0.03 * i, black, w.x + w.R * 1.05, w.y * 0.5, sg * (hwid(w.x) - 0.1)); }
    { const i = I('fog'); if (i) for (const sg of [-1, 1]) { if (i < 3) cy(0.06, 0.05, lamp, 0.04, 0.3, sg * W * 0.3, 0, Math.PI / 2, 14); else bx(0.04, 0.06, 0.13, lamp, 0.04, 0.3, sg * W * 0.3); if (i === 4) cy(0.05, 0.05, lamp, 0.04, 0.38, sg * W * 0.12, 0, Math.PI / 2, 12); } }
    { const i = I('pods'); if (i) { const yy = i === 2 ? lt(pf.xc * 0.6) + 0.06 : i === 3 ? 0.55 : 0.4; for (let k = -1; k <= 1; k += (i === 1 || i === 4) ? 0.5 : 2) bx(0.06, 0.07, 0.13, lamp, i === 2 ? pf.xc * 0.6 : 0.02, yy, k * W * 0.2); } }
    { const i = I('skid'); if (i) bx(0.7, 0.025, W * 0.5, i === 1 ? alu : i === 2 ? steel : carbon, 0.9, 0.14, 0); }
    { const i = I('steps'); if (i) for (const sg of [-1, 1]) bx(pf.xt - pf.xc * 0.8, 0.04, 0.12, i === 1 ? steel : black, (pf.xc * 0.8 + pf.xt) / 2 + 0.2, 0.28, sg * (W / 2 + 0.04)); }
    { const i = I('tow'); if (i) for (const sg of [-1, 1]) { bx(0.04, 0.04, 0.04, steel, i === 2 ? L : -0.01, 0.35, sg * 0.35); if (i === 2) bx(0.15, 0.05, 0.05, steel, L + 0.08, 0.3, 0); } }
    { const m = CATS.mirrors.opts[I('mirrors')]; if (m && m.v) for (const d of this.details) if (d.mesh.material === this.paintDet && d.mesh.geometry.parameters && d.mesh.geometry.parameters.width === 0.075) d.mesh.material = M(new THREE.Color(m.v), 0.3, 0.5); }
    { const g = CATS.glow.opts[I('glow')]; if (g && g.v) { this.glow = g.v; const pl = new THREE.PointLight(g.v === 'rainbow' || g.v === 'pulse' ? 0x30a0ff : g.v, 14, 7, 1.6); pl.position.set(spec.noseX - L * 0.5, -spec.cgH + 0.15, 0); this.root.add(pl); this.glowLight = pl;
        const gm = new THREE.Mesh(new THREE.PlaneGeometry(L * 0.9, W * 0.85), new THREE.MeshBasicMaterial({ color: pl.color, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })); gm.rotation.x = -Math.PI / 2; gm.position.set(spec.noseX - L * 0.5, -spec.cgH + 0.1, 0); this.root.add(gm); this.glowMesh = gm; } }
    { const h = CATS.headlight.opts[I('headlight')]; if (h) { this.lensMat.color.set(h.v); this.lensMat.emissive.set(h.v); this._beamCol = h.s; }
      const t = CATS.taillight.opts[I('taillight')]; if (t) { this.tailMat.emissive.set(t.v); this.tailMat.color.set(t.v).multiplyScalar(0.5); } }
  }

  addInterior(body, pf) {
    const { car, spec, cfg } = this, sp = car.shape, W = car.W, H = car.H;
    const g = new THREE.Group(); body.add(g);
    const ic = CATS.interior.opts[(cfg.parts && cfg.parts.interior) | 0];
    const dk = new THREE.MeshStandardMaterial({ color: ic.d, roughness: 0.9 });
    const seatM = new THREE.MeshStandardMaterial({ color: (cfg.parts && cfg.parts.interior) ? ic.v : sp.beetle ? 0x6a4a2c : car.cls === 'Supercarro' ? 0x2a2a2a : 0x23242a, roughness: 0.8 });
    const xseat = pf.xc + 0.80, hipY = 0.46 * H + 0.50 - 0.58;
    const floor = new THREE.Mesh(new THREE.BoxGeometry(pf.xt - pf.xc, 0.04, W * 0.8), dk); floor.position.set((pf.xt + pf.xc) / 2, hipY - 0.28, 0); g.add(floor);
    const dashY = pf.lowerTop(pf.xc + 0.15);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, W * 0.84), dk); dash.position.set(pf.xc + 0.22, dashY - 0.16, 0); g.add(dash);
    const dd = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.12, W * 0.5), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.5, metalness: 0.3 })); dd.position.set(pf.xc + 0.42, dashY - 0.06, 0); g.add(dd);
    const seat = (x, z) => {
      const s = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.48), seatM); s.add(b);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.62, 0.48), seatM); bk.position.set(0.26, 0.34, 0); bk.rotation.z = -0.15; s.add(bk);
      const hr = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.26), seatM); hr.position.set(0.31, 0.72, 0); s.add(hr);
      s.position.set(x, hipY - 0.06, z); g.add(s);
    };
    seat(xseat, 0.37); seat(xseat, -0.37);
    if (!sp.bed && car.cls !== 'Supercarro') { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, W * 0.72), seatM); rb.position.set(xseat + 0.85, hipY + 0.16, 0); g.add(rb); }
    const sw = this.swGroup = new THREE.Group();
    const wheelM = new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.7 });
    const ws = (cfg.parts && cfg.parts.wheelstyle) | 0; const tor = new THREE.Mesh(new THREE.TorusGeometry([0.18, 0.15, 0.16, 0.19, 0.14, 0.24, 0.2, 0.15][ws], [0.017, 0.02, 0.022, 0.025, 0.018, 0.02, 0.01, 0.019][ws], 8, ws === 2 ? 5 : 24), ws === 3 ? new THREE.MeshStandardMaterial({ color: 0x8a5a2a, roughness: 0.5 }) : ws === 7 ? new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.5 }) : wheelM); tor.rotation.y = Math.PI / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.34), wheelM);
    const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.014), wheelM);
    const swSpin = this.swSpin = new THREE.Group(); swSpin.add(tor, spoke, spoke2);
    sw.add(swSpin);
    sw.position.set(pf.xc + 0.30, hipY + 0.42, 0.37); sw.rotation.z = 0.35;
    g.add(sw);
    this.interior = g;
  }

  addWheels() {
    const { spec, cfg, car } = this;
    this.wheelNodes = [];
    const cal0 = CATS.caliper.opts[(cfg.parts && cfg.parts.caliper) | 0];
    const brakeColor = cal0 && cal0.v ? cal0.v : (cfg.brk === 'big' || cfg.brk === 'carbon' || cfg.brk === 'sport') ? 0xc01818 : 0x555560;
    for (let i = 0; i < 4; i++) {
      const w = spec.wheels[i];
      const root = new THREE.Group();     // posição + esterço + camber
      root.rotation.order = 'YXZ';
      const flip = new THREE.Group(); flip.rotation.y = w.side > 0 ? 0 : Math.PI;
      const spin = new THREE.Group();
      const tire = w.axle === 0 ? cfg.tf : cfg.tr;
      const wm = buildWheelMesh(tire, cfg.wheel, cfg.rimColor, false, w.side);
      spin.add(wm);
      { const sw = (cfg.parts && cfg.parts.sidewall) | 0, rf = (cfg.parts && cfg.parts.rimfinish) | 0;
        if (sw) { const col = [0, 0xf0f0f0, 0xd01818, 0xf2c40f, 0xf0f0f0, 0xf2c40f][sw]; const rr = w.rim + (w.R - w.rim) * (sw === 4 ? 0.45 : 0.55); const tw = sw === 4 ? 0.035 : sw === 1 || sw === 5 ? 0.004 : 0.012;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, tw, 6, 48), new THREE.MeshBasicMaterial({ color: col })); ring.position.z = w.width * 0.47; spin.add(ring); }
        wm.traverse(o => { if (o.material && o.material.metalness >= 0.5 && o.material.roughness < 0.6) { o.material = o.material.clone(); const f = [[0.9, 0.22], [0.85, 0.45], [0.35, 0.75], [1.0, 0.05]][rf]; o.material.metalness = f[0]; o.material.roughness = f[1]; } }); }
      flip.add(spin);
      const bp = brakeParts(w.R, w.rim, false, w.width / 2, brakeColor);
      spin.add(bp.disc);
      const cal = bp.caliper; cal.userData.fix = true;
      // pinça fica no flip (não gira); posição virada para trás da roda
      cal.position.set(-0.02, w.R * 0.52, -w.width / 2 * 0.30);
      flip.add(cal);
      root.add(flip);
      this.root.add(root);
      this.wheelNodes.push({ root, spin, flip });
    }
  }

  addLights() {
    const { spec, car } = this;
    this.beams = [];
    for (const sg of [-1, 1]) {
      const sl = new THREE.SpotLight(0xfff2dc, 0, 130, 0.50, 0.6, 1.1);
      sl.position.set(spec.noseX - 0.3, spec.meshOff.y + car.shape.nt - 0.15, sg * car.W * 0.28);
      sl.target.position.set(spec.noseX + 20, spec.meshOff.y + 0.2, sg * car.W * 0.2);
      if (this._beamCol) sl.color.set(this._beamCol);       this.root.add(sl); this.root.add(sl.target); this.beams.push(sl);
    }
    this.fogBeams = [];
    for (const sg of [-1, 1]) {
      const fl = new THREE.SpotLight(0xffe27a, 0, 55, 0.85, 0.7, 1.3);
      fl.position.set(spec.noseX - 0.1, spec.meshOff.y + 0.32, sg * car.W * 0.3);
      fl.target.position.set(spec.noseX + 9, spec.meshOff.y, sg * car.W * 0.3);
      this.root.add(fl); this.root.add(fl.target); this.fogBeams.push(fl);
    }
  }

  setLights(on, brake, reverse, mode = on ? 2 : 0, fog = false) {
    this.lensMat.emissiveIntensity = [0, 0.7, 2.2, 3.4][mode];
    this.tailMat.emissiveIntensity = brake ? 4.0 : (mode >= 1 ? 1.2 : 0.2);
    this.revMat.emissiveIntensity = reverse ? 2.5 : 0;
    for (const b of this.beams) { b.intensity = mode === 2 ? 2600 : mode === 3 ? 6500 : 0; b.angle = mode === 3 ? 0.34 : 0.5; b.distance = mode === 3 ? 230 : 130; }
    if (this.fogBeams) for (const b of this.fogBeams) b.intensity = fog ? 1100 : 0;
  }

  setPaint(hex) {
    this.cfg.paint = hex; this.paintColor.set(hex); this.paintDet.color.set(hex);
    this.low.refresh(); this.gh.refresh();
  }

  // ---- deformação ----
  dentLocal(lp, ln, speed) {
    // local (origem no CG) -> modelo
    const spec = this.spec, car = this.car;
    const p = new V3(spec.noseX - lp.x, lp.y + car.cgH, -lp.z);
    const n = new V3(-ln.x, ln.y, -ln.z).normalize();
    // n aponta do obstáculo para o carro = direção para dentro da lataria
    const depth = clamp(0.020 * Math.pow(Math.max(0, speed - 1.2), 1.25), 0.01, 0.45);
    const rad = clamp(0.50 + 0.04 * speed, 0.5, 1.5);
    // dobra: junta um pouco ao longo da direção de impacto (amassado "para dentro")
    const a = this.low.dent(p, n, depth, rad), b = this.gh.dent(p, n, depth * 0.9, rad);
    if (a || b) { this.low.refresh(true); this.gh.refresh(true); }
    // peças soltas/ deslocadas
    for (const d of this.details) {
      const dd = d.p0.distanceTo(p);
      if (dd < rad * 1.1) {
        const k = Math.pow(1 - dd / (rad * 1.1), 1.3);
        d.mesh.position.addScaledVector(n, depth * k * 0.9);
        d.mesh.rotation.x += (Math.random() - 0.5) * 0.25 * k; d.mesh.rotation.z += (Math.random() - 0.5) * 0.25 * k;
        d.acc = (d.acc || 0) + depth * k;
        if (d.acc > 0.16 && d.mesh.geometry && d.mesh.visible) { d.mesh.visible = false; d.hidden = true; }
      }
    }
  }

  lampOut() { return this.details.some(d => d.hidden && (d.mesh.material === this.lensMat || d.mesh.material === this.tailMat)); }

  repair() {
    this.low.reset(); this.gh.reset();
    for (const d of this.details) { d.mesh.position.copy(d.p0); d.mesh.rotation.copy(d.r0); d.mesh.visible = true; d.acc = 0; d.hidden = false; }
  }

  // ---- animação por frame ----
  update(v, dt, extras) {
    this.root.position.copy(v.pos); this.root.quaternion.copy(v.quat);
    const spec = this.spec;
    for (let i = 0; i < 4; i++) {
      const h = v.wh[i], w = spec.wheels[i], n = this.wheelNodes[i];
      n.root.position.set(w.x, w.mountL.y - h.s, w.z);
      n.root.rotation.y = h.steer;
      n.root.rotation.x = w.side * (w.camber + (v.dmg.wheel[i] || 0) * 0.12);
      n.spin.rotation.z = -w.side * h.spin;
    }
    if (this.glow) { const t = performance.now() / 1000; if (this.glow === 'rainbow') { this.glowLight.color.setHSL((t * 0.25) % 1, 1, 0.5); this.glowMesh.material.color.copy(this.glowLight.color); } else if (this.glow === 'pulse') { this.glowLight.intensity = 6 + 10 * (0.5 + 0.5 * Math.sin(t * 5)); this.glowMesh.material.opacity = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(t * 5)); } }
    if (this.swSpin) this.swSpin.rotation.x = -v.steerAng * 5.5 * (v.in.steer === 0 ? 1 : 1);
    if (extras) {
      this.setLights(extras.lights, extras.brake, extras.reverse, extras.mode, extras.fog);
      const bl = extras.blink;
      if (this.sigMat) { this.sigMat[0].emissiveIntensity = ((extras.sigL || extras.haz) && bl) ? 4 : 0; this.sigMat[1].emissiveIntensity = ((extras.sigR || extras.haz) && bl) ? 4 : 0; }
      if (this.wipers && this.wipers.length) {
        if (extras.wipers) { this.wipeT = (this.wipeT || 0) + dt * (extras.wipers === 2 ? 7 : 3.6); this.wipeS = 0.5 - 0.5 * Math.cos(this.wipeT); }
        else { this.wipeS = (this.wipeS || 0) * Math.max(0, 1 - dt * 6); }
        for (const w of this.wipers) w.rotation.y = -1.45 + this.wipeS * 1.15;
      }
    }
  }

  dispose() {
    this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
}
