// ============================================================
//  Mundo: terreno (heightfield), superfícies, colisores estáticos, rampas, props dinâmicos
// ============================================================
import * as THREE from 'three';
import { SURF, clamp, lerp, sstep, smooth } from './data.js';

// ---------------- ruído ----------------
function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
export function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
export function rnd(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---------------- texturas procedurais ----------------
const texCache = {};
export function makeTex(kind, size = 256) {
  if (texCache[kind]) return texCache[kind];
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); const img = g.createImageData(size, size);
  const R = rnd(kind.length * 977 + 13);
  const P = {
    asphalt: { b: [74, 74, 78], a: 22, s: 0.35, o: 3, speck: 0.08 },
    grass: { b: [150, 175, 120], a: 55, s: 0.12, o: 5, speck: 0.0 },
    detail: { b: [200, 200, 200], a: 70, s: 0.10, o: 5, speck: 0.0 },
    concrete: { b: [168, 168, 164], a: 26, s: 0.2, o: 3, speck: 0.03 },
    wood: { b: [150, 105, 60], a: 40, s: 0.4, o: 2, speck: 0.0 },
    metal: { b: [150, 152, 158], a: 18, s: 0.5, o: 2, speck: 0.0 },
  }[kind] || { b: [128, 128, 128], a: 30, s: 0.2, o: 3, speck: 0 };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // ruído periódico (tileable) misturando coordenadas
    let n = 0, a = 0.5, f = 1, tot = 0;
    for (let o = 0; o < P.o + 2; o++) {
      const per = Math.max(1, Math.round(size * P.s / 8 * f));
      const nx = x / size * per, ny = y / size * per;
      const x0 = Math.floor(nx), y0 = Math.floor(ny), fx = nx - x0, fy = ny - y0;
      const h = (i, j) => hash2(((i % per) + per) % per + o * 53, ((j % per) + per) % per + o * 97);
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const val = h(x0, y0) * (1 - u) * (1 - v) + h(x0 + 1, y0) * u * (1 - v) + h(x0, y0 + 1) * (1 - u) * v + h(x0 + 1, y0 + 1) * u * v;
      n += a * val; tot += a; a *= 0.55; f *= 2;
    }
    n = n / tot - 0.5;
    let k = n * P.a * 2;
    if (kind === 'wood') k += Math.sin(x * 0.7 + n * 8) * 10;
    if (P.speck && R() < P.speck) k += (R() - 0.3) * 60;
    const i = (y * size + x) * 4;
    img.data[i] = clamp(P.b[0] + k, 0, 255); img.data[i + 1] = clamp(P.b[1] + k, 0, 255); img.data[i + 2] = clamp(P.b[2] + k, 0, 255); img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (texCache[kind] = t);
}

// ---------------- lote de pintura (faixas no chão) ----------------
export class Paint {
  constructor(world) { this.w = world; this.by = {}; }
  _arr(color) { return this.by[color] || (this.by[color] = { pos: [], idx: [] }); }
  quad(color, pts, lift = 0.035) {
    const a = this._arr(color), base = a.pos.length / 3;
    for (const [x, z] of pts) a.pos.push(x, this.w.heightAt(x, z) + lift, z);
    a.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  line(color, x1, z1, x2, z2, wd, lift) {
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * wd / 2, nz = dx / l * wd / 2;
    this.quad(color, [[x1 + nx, z1 + nz], [x2 + nx, z2 + nz], [x2 - nx, z2 - nz], [x1 - nx, z1 - nz]], lift);
  }
  dashed(color, x1, z1, x2, z2, wd, dash, gap, lift) {
    const l = Math.hypot(x2 - x1, z2 - z1), ux = (x2 - x1) / l, uz = (z2 - z1) / l;
    for (let s = 0; s < l; s += dash + gap) { const e = Math.min(l, s + dash); this.line(color, x1 + ux * s, z1 + uz * s, x1 + ux * e, z1 + uz * e, wd, lift); }
  }
  ring(color, cx, cz, r, wd, lift) {
    const n = Math.max(48, Math.floor(r * 1.6));
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      const r0 = r - wd / 2, r1 = r + wd / 2;
      this.quad(color, [[cx + Math.cos(a0) * r1, cz + Math.sin(a0) * r1], [cx + Math.cos(a1) * r1, cz + Math.sin(a1) * r1], [cx + Math.cos(a1) * r0, cz + Math.sin(a1) * r0], [cx + Math.cos(a0) * r0, cz + Math.sin(a0) * r0]], lift);
    }
  }
  build(parent) {
    for (const c in this.by) {
      const a = this.by[c];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
      g.setIndex(a.idx); g.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; parent.add(mesh);
    }
    this.by = {};
  }
}

// ---------------- estrada (spline) ----------------
export function splineSample(ctrl, closed, ds) {
  const n = ctrl.length, dense = [];
  const segs = closed ? n : n - 1;
  const P = i => closed ? ctrl[((i % n) + n) % n] : ctrl[clamp(i, 0, n - 1)];
  for (let i = 0; i < segs; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  if (!closed) dense.push(ctrl[n - 1].slice());
  // reamostra por comprimento de arco
  const out = [dense[0]]; let acc = 0, last = dense[0];
  const total = dense.length + (closed ? 1 : 0);
  for (let i = 1; i < total; i++) {
    const q = dense[i % dense.length];
    let d = Math.hypot(q[0] - last[0], q[1] - last[1]);
    while (acc + d >= ds) {
      const t = (ds - acc) / d;
      last = [last[0] + (q[0] - last[0]) * t, last[1] + (q[1] - last[1]) * t];
      out.push(last); d = Math.hypot(q[0] - last[0], q[1] - last[1]); acc = 0;
    }
    acc += d; last = q;
  }
  if (closed && Math.hypot(out[out.length - 1][0] - out[0][0], out[out.length - 1][1] - out[0][1]) < ds * 0.5) out.pop();
  return out;
}

export class Road {
  constructor(pts, closed, hw) {
    this.n = pts.length; this.closed = closed; this.hw = hw;
    this.X = new Float32Array(this.n); this.Z = new Float32Array(this.n); this.Y = new Float32Array(this.n);
    this.TX = new Float32Array(this.n); this.TZ = new Float32Array(this.n); this.curv = new Float32Array(this.n); this.S = new Float32Array(this.n);
    for (let i = 0; i < this.n; i++) { this.X[i] = pts[i][0]; this.Z[i] = pts[i][1]; }
    let s = 0;
    for (let i = 0; i < this.n; i++) {
      const a = closed ? (i - 1 + this.n) % this.n : Math.max(0, i - 1), b = closed ? (i + 1) % this.n : Math.min(this.n - 1, i + 1);
      let tx = this.X[b] - this.X[a], tz = this.Z[b] - this.Z[a]; const l = Math.hypot(tx, tz) || 1;
      this.TX[i] = tx / l; this.TZ[i] = tz / l;
      this.S[i] = s; s += Math.hypot(this.X[(i + 1) % this.n] - this.X[i], this.Z[(i + 1) % this.n] - this.Z[i]);
    }
    this.length = s;
    for (let i = 0; i < this.n; i++) {
      const a = closed ? (i - 2 + this.n) % this.n : Math.max(0, i - 2), b = closed ? (i + 2) % this.n : Math.min(this.n - 1, i + 2);
      const ang = Math.atan2(this.TZ[b] * this.TX[a] - this.TX[b] * this.TZ[a], this.TX[b] * this.TX[a] + this.TZ[b] * this.TZ[a]);
      const ds = Math.hypot(this.X[b] - this.X[a], this.Z[b] - this.Z[a]) || 1;
      this.curv[i] = ang / ds;
    }
    // hash espacial
    this.cell = 24; this.grid = new Map();
    for (let i = 0; i < this.n; i++) {
      const k = Math.floor(this.X[i] / this.cell) * 100003 + Math.floor(this.Z[i] / this.cell);
      let a = this.grid.get(k); if (!a) this.grid.set(k, a = []); a.push(i);
    }
  }
  nearest(x, z, maxD = 80) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell), rmax = Math.ceil(maxD / this.cell);
    let best = -1, bd = maxD * maxD;
    for (let r = 0; r <= rmax; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const a = this.grid.get((cx + i) * 100003 + (cz + j)); if (!a) continue;
        for (const k of a) { const d = (this.X[k] - x) ** 2 + (this.Z[k] - z) ** 2; if (d < bd) { bd = d; best = k; } }
      }
      if (best >= 0 && bd <= (r * this.cell) * (r * this.cell)) break;
    }
    if (best < 0) return null;
    // distância lateral com sinal (positivo = direita, +Z quando TX=1)
    const dx = x - this.X[best], dz = z - this.Z[best];
    const lat = dx * -this.TZ[best] + dz * this.TX[best];
    return { i: best, d: Math.sqrt(bd), lat };
  }
}

// ============================================================
export class World {
  constructor(id) {
    this.id = id;
    this.group = new THREE.Group();
    this.statics = []; this.cells = new Map(); this.stamp = 0;
    this.feat = []; this.props = []; this.wet = 0;
    this.spawn = { x: 0, z: 0, yaw: 0 };
    this.checkpoints = []; this.lapLine = null;
    this.size = 800; this.cs = 4; this.sc = 2;
    this.bound = 400;
  }

  initGrid(size, cs, sc = 2) {
    this.size = size; this.cs = cs; this.sc = sc;
    this.N = Math.round(size / cs); this.x0 = -size / 2; this.z0 = -size / 2;
    this.H = new Float32Array((this.N + 1) * (this.N + 1));
    this.NS = Math.round(size / sc);
    this.S = new Uint8Array(this.NS * this.NS);
    this.bound = size / 2 - 6;
  }

  genTerrain(fn) {
    const N = this.N, cs = this.cs;
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) this.H[j * (N + 1) + i] = fn(this.x0 + i * cs, this.z0 + j * cs);
  }
  genSurface(fn) {
    const NS = this.NS, sc = this.sc;
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) {
      const x = this.x0 + (i + 0.5) * sc, z = this.z0 + (j + 0.5) * sc;
      this.S[j * NS + i] = fn(x, z, this.rawHeight(x, z));
    }
  }
  rawHeight(x, z) {
    const N = this.N, cs = this.cs;
    let gx = (x - this.x0) / cs, gz = (z - this.z0) / cs;
    gx = clamp(gx, 0, N - 1e-4); gz = clamp(gz, 0, N - 1e-4);
    const ix = gx | 0, iz = gz | 0, fx = gx - ix, fz = gz - iz, W = N + 1, H = this.H;
    const a = H[iz * W + ix], b = H[iz * W + ix + 1], c = H[(iz + 1) * W + ix], d = H[(iz + 1) * W + ix + 1];
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  heightAt(x, z) {
    let h = this.rawHeight(x, z);
    const F = this.feat;
    for (let i = 0; i < F.length; i++) { const f = F[i]; if (x > f.x0 && x < f.x1 && z > f.z0 && z < f.z1) h = f.fn(x, z, h); }
    return h;
  }
  normalAt(x, z, out) {
    const e = 0.4;
    const hx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const hz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return out.set(-hx, 1, -hz).normalize();
  }
  surfAt(x, z) {
    const NS = this.NS, sc = this.sc;
    const i = clamp(Math.floor((x - this.x0) / sc), 0, NS - 1), j = clamp(Math.floor((z - this.z0) / sc), 0, NS - 1);
    // superfícies locais (ex.: concreto da rampa)
    return this.S[j * NS + i];
  }

  // ---------- terreno visual ----------
  buildTerrainMesh(colorFn, uvScale = 0.12) {
    const N = this.N, cs = this.cs, W = N + 1;
    const pos = new Float32Array(W * W * 3), col = new Float32Array(W * W * 3), uv = new Float32Array(W * W * 2), nor = new Float32Array(W * W * 3);
    const c = [0, 0, 0];
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, x = this.x0 + i * cs, z = this.z0 + j * cs, h = this.H[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      uv[k * 2] = x * uvScale; uv[k * 2 + 1] = z * uvScale;
      const hl = this.H[j * W + Math.max(0, i - 1)], hr = this.H[j * W + Math.min(N, i + 1)], hu = this.H[Math.max(0, j - 1) * W + i], hd = this.H[Math.min(N, j + 1) * W + i];
      const nx = (hl - hr), nz = (hu - hd), ny = 2 * cs, l = Math.hypot(nx, ny, nz);
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
      const s = this.S[clamp(Math.floor((z - this.z0) / this.sc), 0, this.NS - 1) * this.NS + clamp(Math.floor((x - this.x0) / this.sc), 0, this.NS - 1)];
      colorFn(x, z, h, s, ny / l, c);
      col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2];
    }
    const idx = new Uint32Array(N * N * 6); let p = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const a = j * W + i, b = a + 1, d = a + W, e = d + 1;
      idx[p++] = a; idx[p++] = d; idx[p++] = b; idx[p++] = b; idx[p++] = d; idx[p++] = e;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, map: makeTex('detail', 256), roughness: 0.96, metalness: 0 });
    const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; mesh.frustumCulled = false;
    this.group.add(mesh); this.terrainMesh = mesh;
    return mesh;
  }

  // ---------- colisores estáticos ----------
  _reg(o, x0, z0, x1, z1) {
    const C = 16;
    for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(z0 / C); j <= Math.floor(z1 / C); j++) {
      const k = i * 100003 + j; let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(o);
    }
    this.statics.push(o);
  }
  addBoxCol(cx, cy, cz, hx, hy, hz, yaw = 0) {
    const o = { t: 0, cx, cy, cz, hx, hy, hz, c: Math.cos(yaw), s: Math.sin(yaw), st: 0 };
    const r = Math.hypot(hx, hz);
    this._reg(o, cx - r, cz - r, cx + r, cz + r); return o;
  }
  addCylCol(cx, cz, y0, y1, r) { const o = { t: 1, cx, cz, y0, y1, r, st: 0 }; this._reg(o, cx - r, cz - r, cx + r, cz + r); return o; }
  addSphCol(cx, cy, cz, r) { const o = { t: 2, cx, cy, cz, r, st: 0 }; this._reg(o, cx - r, cz - r, cx + r, cz + r); return o; }
  queryStatic(x, z, r, out) {
    out.length = 0; this.stamp++;
    const C = 16;
    for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) {
      const a = this.cells.get(i * 100003 + j); if (!a) continue;
      for (let k = 0; k < a.length; k++) { const o = a[k]; if (o.st !== this.stamp) { o.st = this.stamp; out.push(o); } }
    }
    return out;
  }
  clampBounds(v) {
    const B = this.bound, p = v.pos;
    if (p.x > B) { p.x = B; if (v.vel.x > 0) v.vel.x *= -0.2; }
    if (p.x < -B) { p.x = -B; if (v.vel.x < 0) v.vel.x *= -0.2; }
    if (p.z > B) { p.z = B; if (v.vel.z > 0) v.vel.z *= -0.2; }
    if (p.z < -B) { p.z = -B; if (v.vel.z < 0) v.vel.z *= -0.2; }
  }

  // ---------- rampas ----------
  // prof: lista [[u, altura]] ao longo do comprimento; base = altura do terreno na origem
  addRamp({ x, z, yaw, wid, prof, color = 0x8a8a86, base }) {
    base = base ?? this.rawHeight(x, z);
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const L = prof[prof.length - 1][0];
    const r = Math.hypot(L, wid / 2) + 1;
    const f = {
      x0: x - r, x1: x + r, z0: z - r, z1: z + r,
      fn: (px, pz, h) => {
        const dx = px - x, dz = pz - z;
        const u = dx * c + dz * s, v = -dx * s + dz * c;
        if (u < 0 || u > L || Math.abs(v) > wid / 2) return h;
        let k = 0; while (k < prof.length - 2 && u > prof[k + 1][0]) k++;
        const t = (u - prof[k][0]) / (prof[k + 1][0] - prof[k][0]);
        const hh = base + prof[k][1] + (prof[k + 1][1] - prof[k][1]) * t;
        return Math.max(h, hh);
      }
    };
    this.feat.push(f);
    // malha: prisma
    const pos = [], idx = [];
    const n = prof.length;
    const at = (u, y, v) => { const wx = x + u * c - v * s, wz = z + u * s + v * c; return [wx, base + y, wz]; };
    const hw = wid / 2;
    for (let i = 0; i < n; i++) { for (const sg of [-1, 1]) { pos.push(...at(prof[i][0], prof[i][1], sg * hw)); pos.push(...at(prof[i][0], -0.5, sg * hw)); } }
    // índices: cada perfil i -> 4 vértices: (-hw topo, -hw base, +hw topo, +hw base)
    for (let i = 0; i < n - 1; i++) {
      const a = i * 4, b = (i + 1) * 4;
      idx.push(a, a + 2, b + 2, a, b + 2, b); // topo
      idx.push(a, b, b + 1, a, b + 1, a + 1); // lado -
      idx.push(a + 2, a + 3, b + 3, a + 2, b + 3, b + 2); // lado +
    }
    idx.push(0, 1, 3, 0, 3, 2); const e = (n - 1) * 4; idx.push(e, e + 2, e + 3, e, e + 3, e + 1);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide, map: makeTex('concrete') }));
    mesh.castShadow = mesh.receiveShadow = true; this.group.add(mesh);
    return mesh;
  }
  // área com altura adicional por função (ex.: lombadas), com malha fina
  addPatch({ x0, x1, z0, z1, fn, res = 0.5, color = 0x7a6a50, add = true }) {
    this.feat.push({ x0, x1, z0, z1, fn: (px, pz, h) => add ? h + fn(px, pz) : Math.max(h, fn(px, pz)) });
    const nx = Math.ceil((x1 - x0) / res), nz = Math.ceil((z1 - z0) / res);
    const pos = new Float32Array((nx + 1) * (nz + 1) * 3), idx = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = x0 + i * res, z = z0 + j * res, k = (j * (nx + 1) + i) * 3;
      pos[k] = x; pos[k + 1] = this.heightAt(x, z) + 0.01; pos[k + 2] = z;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, d = a + nx + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    mesh.receiveShadow = true; this.group.add(mesh);
  }

  // ---------- caixa/ cilindro com visual ----------
  box(cx, cz, w, h, d, yaw, color = 0xaaaaaa, tex = 'concrete', y0 = null) {
    const base = y0 ?? this.heightAt(cx, cz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9, map: tex ? makeTex(tex) : null }));
    m.position.set(cx, base + h / 2, cz); m.rotation.y = -yaw; m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    this.addBoxCol(cx, base + h / 2, cz, w / 2, h / 2, d / 2, yaw);
    return m;
  }

  // ---------- props dinâmicos ----------
  addProp(kind, x, z, y = null) {
    const Vv = THREE.Vector3;
    const def = {
      cone: { r: 0.30, m: 1.6, fr: 3.0, e: 0.25 },
      barrel: { r: 0.40, m: 30, fr: 0.6, e: 0.3 },
      crate: { r: 0.48, m: 22, fr: 3.5, e: 0.15 },
      tyre: { r: 0.36, m: 9, fr: 0.5, e: 0.45 },
      pin: { r: 0.22, m: 1.8, fr: 3.0, e: 0.3 },
    }[kind];
    const p = { kind, ...def, pos: new Vv(x, (y ?? this.heightAt(x, z)) + def.r, z), vel: new Vv(), q: new THREE.Quaternion(), asleep: true, fall: 0, axis: new Vv(1, 0, 0), spinQ: new THREE.Quaternion(), home: null };
    p.mesh = makePropMesh(kind);
    p.mesh.position.copy(p.pos); p.home = p.pos.clone();
    this.group.add(p.mesh); this.props.push(p);
    return p;
  }
  resetProps() {
    for (const p of this.props) { p.pos.copy(p.home); p.vel.set(0, 0, 0); p.q.identity(); p.fall = 0; p.asleep = true; this._syncProp(p); }
  }
  _syncProp(p) {
    p.mesh.position.copy(p.pos); p.mesh.quaternion.copy(p.q);
    if (p.kind === 'cone') p.mesh.position.y -= p.r * (1 - p.fall) * 0.0 + (p.fall * 0.12);
  }
  updateProps(dt, veh) {
    const cpos = veh.pos, cr = veh.spec.L * 0.7 + 3;
    for (const p of this.props) {
      const near = (p.pos.x - cpos.x) ** 2 + (p.pos.z - cpos.z) ** 2 < cr * cr;
      if (p.asleep && !near) continue;
      // contato com o carro
      const hit = veh.sphereImpact(p.pos, p.vel, p.r, p.m, p.e);
      if (hit) {
        if (p.asleep) for (const o of this.props) if (o.asleep && o.pos.distanceToSquared(p.pos) < 4.5) { o.asleep = false; }
        p.asleep = false;
      }
      if (p.asleep) continue;
      p.vel.y -= 9.81 * dt;
      p.pos.addScaledVector(p.vel, dt);
      const h = this.heightAt(p.pos.x, p.pos.z);
      if (p.pos.y - p.r < h) {
        p.pos.y = h + p.r;
        if (p.vel.y < 0) p.vel.y *= -p.e;
        const f = Math.max(0, 1 - p.fr * dt);
        p.vel.x *= f; p.vel.z *= f;
      }
      const sp = Math.hypot(p.vel.x, p.vel.z);
      // orientação
      if (p.kind === 'cone' || p.kind === 'pin') {
        if (sp > 2.2) p.fall = Math.min(1, p.fall + dt * 6);
        if (sp > 0.3) p.axis.set(-p.vel.z, 0, p.vel.x).normalize();
        p.q.setFromAxisAngle(p.axis, p.fall * (p.kind === 'cone' ? 1.45 : 1.5));
      } else if (sp > 0.05) {
        // rolando: gira em torno de (up x v)
        t_ax.set(-p.vel.z, 0, p.vel.x).normalize();
        p.spinQ.setFromAxisAngle(t_ax, sp / p.r * dt);
        p.q.premultiply(p.spinQ);
      }
      if (sp < 0.05 && Math.abs(p.vel.y) < 0.3 && !near) p.asleep = true;
      this._syncProp(p);
    }
  }
}
const t_ax = new THREE.Vector3();

// ---------------- malhas de props ----------------
const propGeo = {};
function makePropMesh(kind) {
  if (!propGeo.ready) {
    const cone = new THREE.ConeGeometry(0.17, 0.62, 16, 4, true);
    cone.translate(0, 0.31 - 0.30, 0);
    const cc = []; const pos = cone.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) + 0.30; const band = (y > 0.22 && y < 0.36) || (y > 0.40 && y < 0.46); cc.push(band ? 0.95 : 0.95, band ? 0.95 : 0.35, band ? 0.95 : 0.05); }
    cone.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
    const base = new THREE.BoxGeometry(0.36, 0.035, 0.36); base.translate(0, 0.0175 - 0.30, 0);
    propGeo.cone = [cone, base];
    propGeo.barrel = new THREE.CylinderGeometry(0.30, 0.30, 0.84, 20);
    propGeo.ring = new THREE.TorusGeometry(0.305, 0.018, 6, 20); propGeo.ring.rotateX(Math.PI / 2);
    propGeo.crate = new THREE.BoxGeometry(0.9, 0.9, 0.9);
    propGeo.tyre = new THREE.TorusGeometry(0.26, 0.1, 10, 20);
    propGeo.pin = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 10);
    propGeo.ready = true;
  }
  const g = new THREE.Group();
  if (kind === 'cone') {
    const m1 = new THREE.Mesh(propGeo.cone[0], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }));
    const m2 = new THREE.Mesh(propGeo.cone[1], new THREE.MeshStandardMaterial({ color: 0xe86a10, roughness: 0.6 }));
    m1.castShadow = m2.castShadow = true; g.add(m1, m2);
  } else if (kind === 'barrel') {
    const col = [0xc03020, 0x2050b0, 0xd0a010][(Math.random() * 3) | 0];
    const b = new THREE.Mesh(propGeo.barrel, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: 0.3 })); b.castShadow = true; g.add(b);
    for (const y of [-0.25, 0.25]) { const r = new THREE.Mesh(propGeo.ring, new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.5 })); r.position.y = y; g.add(r); }
  } else if (kind === 'crate') {
    const b = new THREE.Mesh(propGeo.crate, new THREE.MeshStandardMaterial({ color: 0xc89a5a, map: makeTex('wood'), roughness: 0.9 })); b.castShadow = true; g.add(b);
  } else if (kind === 'tyre') {
    const b = new THREE.Mesh(propGeo.tyre, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 })); b.castShadow = true; b.rotation.x = Math.PI / 2; g.add(b);
  } else {
    const b = new THREE.Mesh(propGeo.pin, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 })); b.castShadow = true; g.add(b);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 })); c.position.y = 0.3; g.add(c);
  }
  return g;
}
