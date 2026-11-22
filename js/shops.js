// ============================================================
//  Comércios do Mundo Real (dados do OpenStreetMap): fachadas com vitrine, porta, toldo listrado e letreiro com o nome real.
//  Fontes: prédios com shop=* / amenity=* / building=retail|commercial|supermarket, e pontos de interesse (POI) com nome,
//  que são encaixados na parede mais próxima da rua.
// ============================================================
import * as THREE from 'three';

// categoria -> [rótulo, cor, ícone]
const CAT = {
  supermarket: ['Supermercado', '#d62f2f', '🛒'], convenience: ['Conveniência', '#e67e22', '🏪'], bakery: ['Padaria', '#c9852b', '🥖'], butcher: ['Açougue', '#a31d1d', '🥩'],
  pharmacy: ['Farmácia', '#1fa35c', '✚'], chemist: ['Farmácia', '#1fa35c', '✚'], clothes: ['Moda', '#7a3d9a', '👕'], shoes: ['Calçados', '#8a5a2a', '👟'], electronics: ['Eletrônicos', '#1b4fa8', '📱'],
  mobile_phone: ['Celulares', '#1b4fa8', '📱'], hardware: ['Ferragens', '#e1a21a', '🔧'], doityourself: ['Construção', '#e1a21a', '🧱'], florist: ['Floricultura', '#d6609a', '💐'],
  hairdresser: ['Salão', '#c0558f', '✂'], beauty: ['Beleza', '#c0558f', '💄'], jewelry: ['Joalheria', '#6b5a2a', '💎'], books: ['Livraria', '#3a6f4a', '📚'], car: ['Automóveis', '#444b55', '🚗'],
  car_repair: ['Oficina', '#444b55', '🔧'], furniture: ['Móveis', '#6b4a2f', '🛋'], department_store: ['Loja de departamentos', '#1f2a44', '🏬'], mall: ['Shopping', '#1f2a44', '🛍'],
  supermarket_: ['Mercado', '#d62f2f', '🛒'], greengrocer: ['Hortifruti', '#3a8a3a', '🍎'], optician: ['Ótica', '#2d6ab0', '👓'], bicycle: ['Bicicletas', '#2d8a6a', '🚲'], toys: ['Brinquedos', '#d6a01a', '🧸'],
  restaurant: ['Restaurante', '#8a3d2a', '🍴'], cafe: ['Café', '#6b4a2f', '☕'], fast_food: ['Lanchonete', '#d62f2f', '🍔'], bar: ['Bar', '#2f4f2f', '🍺'], pub: ['Pub', '#2f4f2f', '🍺'],
  bank: ['Banco', '#1b4fa8', '🏦'], ice_cream: ['Sorveteria', '#d6609a', '🍦'], fuel: ['Posto', '#c0392b', '⛽'], cinema: ['Cinema', '#3a2a5a', '🎬'], dentist: ['Dentista', '#2d8a8a', '🦷'],
  clinic: ['Clínica', '#2d8a8a', '✚'], marketplace: ['Feira', '#6b8a2a', '🧺'],
};
const DEF = ['Comércio', '#555e6b', '🏬'];
const catOf = b => CAT[b.shop] || CAT[b.amenity] || (b.btype === 'supermarket' ? CAT.supermarket : DEF);

export function buildShops(w, D, blds) {
  const H = (x, z) => w.heightAt(x, z), isShopB = b => b.shop || (b.amenity && CAT[b.amenity]) || b.btype === 'retail' || b.btype === 'commercial' || b.btype === 'supermarket' || b.btype === 'kiosk';
  const cands = blds.filter(b => b.pts && b.pts.length >= 3 && isShopB(b));
  // ---- índice espacial das arestas dos prédios + pontos das ruas (para saber qual parede dá para a rua) ----
  const CL = 40, eg = new Map(), edges = [], byB = new Map();
  const inPoly = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  blds.forEach((b, bi) => {
    if (!b.pts || b.pts.length < 3 || b.h > 70) return; const p = b.pts;
    for (let i = 0; i < p.length; i++) {
      const a = p[i], c = p[(i + 1) % p.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 3.5) continue;
      const tx = (c[0] - a[0]) / L, tz = (c[1] - a[1]) / L; let nx = tz, nz = -tx; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      if (inPoly(mx + nx * 0.4, mz + nz * 0.4, p)) { nx = -nx; nz = -nz; }
      const e = { b, bi, a, c, L, tx, tz, nx, nz, mx, mz }; edges.push(e); (byB.get(b) || byB.set(b, []).get(b)).push(e);
      const k = Math.floor(mx / CL) * 20011 + Math.floor(mz / CL); (eg.get(k) || eg.set(k, []).get(k)).push(e);
    }
  });
  const rg = new Map();
  for (const r of D.roads) { if (r.off || r.w < 3 || !r.pts) continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], c = r.pts[i + 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]), n = Math.max(1, Math.ceil(L / 8)); for (let k = 0; k <= n; k++) { const x = a[0] + (c[0] - a[0]) * k / n, z = a[1] + (c[1] - a[1]) * k / n, key = Math.floor(x / CL) * 20011 + Math.floor(z / CL); (rg.get(key) || rg.set(key, []).get(key)).push([x, z, r.w / 2]); } } }
  const roadDist = (x, z) => { let best = 1e9; const cx = Math.floor(x / CL), cz = Math.floor(z / CL); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = rg.get((cx + i) * 20011 + (cz + j)); if (l) for (const q of l) { const d = Math.hypot(q[0] - x, q[1] - z) - q[2]; if (d < best) best = d; } } return best; };

  // ---- lojas ----
  const shops = [], used = [];
  const near = (x, z, r) => used.some(u => Math.hypot(u[0] - x, u[1] - z) < r);
  for (const b of cands) {
    let best = null, bs = -1e9;
    for (const e of byB.get(b) || []) { const rd = roadDist(e.mx + e.nx * 3, e.mz + e.nz * 3); const sc = -rd * 2 + Math.min(e.L, 14); if (sc > bs && rd < 25) { bs = sc; best = e; } }
    if (best && !near(best.mx, best.mz, 5)) { shops.push({ e: best, cat: catOf(b), name: b.name, t0: 0.5 }); used.push([best.mx, best.mz]); }
  }
  for (const p of D.pois || []) {
    if (near(p.x, p.z, 7) || !(CAT[p.shop] || CAT[p.amenity] || p.shop)) continue;
    const cx = Math.floor(p.x / CL), cz = Math.floor(p.z / CL); let best = null, bd = 25;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const l = eg.get((cx + i) * 20011 + (cz + j)); if (l) for (const e of l) { const dx = p.x - e.mx, dz = p.z - e.mz, t = Math.max(-e.L / 2, Math.min(e.L / 2, dx * e.tx + dz * e.tz)), px = e.mx + e.tx * t, pz = e.mz + e.tz * t, d = Math.hypot(p.x - px, p.z - pz), rd = roadDist(px + e.nx * 3, pz + e.nz * 3); if (rd < 18 && d < bd) { bd = d; best = { e, t }; } } }
    if (!best) continue;
    const e = best.e; shops.push({ e, cat: catOf(p), name: p.name, t0: 0.5 + best.t / e.L, len: 6.5 }); used.push([p.x, p.z]);
  }
  // as mais próximas do centro primeiro (limite do atlas de letreiros)
  shops.sort((p, q) => Math.hypot(p.e.mx, p.e.mz) - Math.hypot(q.e.mx, q.e.mz));
  const list = shops.slice(0, 256); if (!list.length) return 0;

  // ---- atlas de letreiros ----
  const COLS = 8, ROWS = 32, CW = 256, CH = 64, cv = document.createElement('canvas'); cv.width = COLS * CW; cv.height = ROWS * CH; const g = cv.getContext('2d');
  list.forEach((s, i) => {
    const c = i % COLS, r = (i / COLS) | 0, x0 = c * CW, y0 = r * CH, [lab, col, ico] = s.cat, name = (s.name || lab).slice(0, 34);
    g.fillStyle = '#f4f4f4'; g.fillRect(x0, y0, CW, CH); g.fillStyle = col; g.fillRect(x0 + 3, y0 + 3, CW - 6, CH - 6);
    g.fillStyle = '#fff'; g.textBaseline = 'middle';
    let sz = 30; g.font = `bold ${sz}px "Segoe UI",Arial`; while (g.measureText(name).width > CW - 24 && sz > 12) { sz -= 2; g.font = `bold ${sz}px "Segoe UI",Arial`; }
    g.textAlign = 'center'; g.fillText(name.toUpperCase(), x0 + CW / 2, y0 + CH / 2 + 2);
  });
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;

  // ---- geometria: vitrine, porta, toldo e letreiro ----
  const P = [], C = [], I = [], SP = [], SU = [], SI = [];
  const quad = (arr, carr, iarr, p1, p2, p3, p4, c) => { const b = arr.length / 3; for (const p of [p1, p2, p3, p4]) { arr.push(p[0], p[1], p[2]); if (carr) carr.push(c.r, c.g, c.b); } iarr.push(b, b + 1, b + 2, b, b + 2, b + 3); };
  const glass = new THREE.Color(0.10, 0.17, 0.22), frame = new THREE.Color(0.12, 0.12, 0.13), door = new THREE.Color(0.05, 0.07, 0.09), white = new THREE.Color(0.95, 0.95, 0.95);
  list.forEach((s, i) => {
    const e = s.e, Ls = Math.min(s.len || e.L * 0.92, e.L * 0.95, 14), tm = Math.max(Ls / 2, Math.min(e.L - Ls / 2, s.t0 * e.L)), cx = e.a[0] + e.tx * tm, cz = e.a[1] + e.tz * tm;
    const hw = Ls / 2, off = 0.07, yb = H(cx, cz) + 0.15, col = new THREE.Color(s.cat[1]);
    const rx = e.nz, rz = -e.nx;   // 'direita' de quem olha a fachada de frente (mantém o texto do letreiro legível)
    const pt = (u, y, o = off) => [cx + rx * u + e.nx * o, y, cz + rz * u + e.nz * o];
    const hgt = Math.min(e.b.h, 7), top = Math.min(3.0, hgt - 0.6);
    // moldura + vitrine + porta
    quad(P, C, I, pt(-hw, yb), pt(hw, yb), pt(hw, yb + top + 0.2), pt(-hw, yb + top + 0.2), frame);
    const n = Math.max(1, Math.floor(Ls / 2.4)), gw = (Ls - 0.3) / n;
    for (let k = 0; k < n; k++) { const u0 = -hw + 0.15 + k * gw + 0.05, u1 = -hw + 0.15 + (k + 1) * gw - 0.05, isDoor = k === ((n / 2) | 0) && n > 1 || n === 1; quad(P, C, I, pt(u0, yb + 0.35, off + 0.02), pt(u1, yb + 0.35, off + 0.02), pt(u1, yb + top, off + 0.02), pt(u0, yb + top, off + 0.02), isDoor && n > 1 ? door : glass); }
    // toldo listrado inclinado
    const aw = 1.25, ya = yb + top + 0.25, nst = Math.max(2, Math.round(Ls / 0.55));
    for (let k = 0; k < nst; k++) { const u0 = -hw + Ls * k / nst, u1 = -hw + Ls * (k + 1) / nst, c = k % 2 ? white : col; quad(P, C, I, pt(u0, ya + 0.25, off), pt(u1, ya + 0.25, off), pt(u1, ya, off + aw), pt(u0, ya, off + aw), c); }
    // letreiro (célula do atlas)
    const ys = ya + 0.45, sh = Math.min(1.0, Ls / 4), c = i % COLS, r = (i / COLS) | 0;
    const u0 = c / COLS, u1 = (c + 1) / COLS, v1 = 1 - r / ROWS, v0 = 1 - (r + 1) / ROWS, b0 = SP.length / 3;
    for (const [u, y, uu, vv] of [[-hw, ys, u0, v0], [hw, ys, u1, v0], [hw, ys + sh, u1, v1], [-hw, ys + sh, u0, v1]]) { const p = pt(u, y, off + 0.1); SP.push(p[0], p[1], p[2]); SU.push(uu, vv); }
    SI.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  });
  const mk = (pos, idx, col, uv) => { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (col) geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals(); return geo; };
  const m1 = new THREE.Mesh(mk(P, I, C), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const m2 = new THREE.Mesh(mk(SP, SI, null, SU), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  for (const m of [m1, m2]) { m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; w.group.add(m); }
  w.shopList = list.map(s => ({ x: s.e.mx, z: s.e.mz, nx: s.e.nx, nz: s.e.nz, name: s.name || s.cat[0] }));
  return list.length;
}
