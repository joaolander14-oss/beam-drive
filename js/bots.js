// ============================================================
//  Tráfego de bots: carros com a MESMA física do jogador, que seguem as ruas, mantêm a direita,
//  respeitam semáforos, PARE, dê a preferência, limites de velocidade e distância do carro da frente.
// ============================================================
import * as THREE from 'three';
import { clamp } from './data.js';
import { defaultCfg, buildSpec } from './spec.js';
import { Vehicle, vehicleCollide } from './physics.js';
import { CarModel } from './carmodel.js';
import { LIMIT } from './streetdecor.js';

const BOT_CARS = ['compacto', 'gol', 'argo', 'onix', 'hb20', 'sedan', 'civic', 'jetta', 'hatchgt', 'fit', 'creta', 'duster', 'hrv', 'saveiro', 'toro', 'mobi', 'uno', 'polo', 'punto', 'camry', 'cruze', 'kombi', 'fusca', 'crv'];
const PAINTS = ['#f2f2f2', '#c9ccd2', '#1b1b1e', '#8a1c1c', '#1f3f8f', '#2f6f4a', '#d8c8a0', '#5a5f66', '#c47a1a', '#e8e8e8', '#7a1f5a', '#2a2f3a', '#b02a2a', '#3a6fa8'];
const rnd = (a, b) => a + Math.random() * (b - a);

function buildNav(w) {
  if (w.navRoads && w.navRoads.length) {
    // mantém só a maior parte conectada da malha viária (evita becos e trechos isolados)
    // descarta vias com degraus/rampas íngremes no terreno (>~11°), que os carros não conseguem subir
    w.navAll = w.navRoads;
    { const out = [], steep = (p, q) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]); if (L < 0.5) return false; const n = Math.max(1, Math.ceil(L / 3)); let h0 = w.heightAt(p[0], p[1]); for (let k = 1; k <= n; k++) { const h1 = w.heightAt(p[0] + (q[0] - p[0]) * k / n, p[1] + (q[1] - p[1]) * k / n); if (Math.abs(h1 - h0) / (L / n) > 0.4) return true; h0 = h1; } return false; };
      for (const r of w.navRoads) { let s0 = 0; for (let i = 1; i <= r.pts.length; i++) { if (i === r.pts.length || steep(r.pts[i - 1], r.pts[i])) { if (i - s0 >= 2) out.push(s0 === 0 && i === r.pts.length ? r : { ...r, pts: r.pts.slice(s0, i), ids: r.ids.slice(s0, i) }); s0 = i; } } }
      w.navRoads = out; }
    { const all = w.navRoads, ix = new Map(); all.forEach((r, k) => r.ids.forEach(id => (ix.get(id) || ix.set(id, []).get(id)).push(k)));
      const comp = new Array(all.length).fill(-1); let nc = 0, bestC = 0, bestN = 0;
      for (let s0 = 0; s0 < all.length; s0++) { if (comp[s0] >= 0) continue; let cnt = 0; const st = [s0]; comp[s0] = nc; while (st.length) { const k = st.pop(); cnt++; for (const id of all[k].ids) for (const j of ix.get(id)) if (comp[j] < 0) { comp[j] = nc; st.push(j); } } if (cnt > bestN) { bestN = cnt; bestC = nc; } nc++; }
      w.navRoads = all.filter((r, k) => comp[k] === bestC); }
    const vm = new Map(), roads = w.navRoads;
    for (const r of roads) { r.lim = (r.ms || LIMIT[r.type] || 40) / 3.6; r.ids.forEach((id, i) => { if (i < r.pts.length) (vm.get(id) || vm.set(id, []).get(id)).push({ r, i }); }); }
    const grid = new Map(), C = 25;
    for (const r of roads) for (const p of r.pts) { const k = Math.floor(p[0] / C) * 20011 + Math.floor(p[1] / C); (grid.get(k) || grid.set(k, []).get(k)).push([p[0], p[1], r]); }
    return { kind: 'graph', roads, vm, grid, C };
  }
  let loop = null, lim = 14;
  if (w.road) { const R = w.road; loop = []; const off = R.hw * 0.5; for (let i = 0; i < R.n; i++) loop.push({ x: R.X[i] - R.TZ[i] * off, z: R.Z[i] + R.TX[i] * off }); lim = w.id === 'autodromo' ? 28 : w.id === 'serra' ? 17 : 14; }
  else if (w.navLoop) { loop = w.navLoop.map(p => ({ x: p[0], z: p[1] })); lim = 11; }
  if (loop) return { kind: 'loop', loop, lim };
  return null;
}

export class Traffic {
  constructor(app) { this.app = app; this.bots = []; this.nav = null; this.acc = 0; this.count = 0; }

  rebuild(world) {
    this.clear(); this.world = world; this.nav = buildNav(world);
    this.setCount(this.count);
  }
  clear() { for (const b of this.bots) { this.app.scene.remove(b.model.root); b.model.dispose(); } this.bots = []; }

  limitAt(x, z) {
    const n = this.nav; if (!n) return 0;
    if (n.kind === 'loop') return Math.round(n.lim * 3.6 / 5) * 5;
    let best = null, bd = 1e9; const cx = Math.floor(x / n.C), cz = Math.floor(z / n.C);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = n.grid.get((cx + i) * 20011 + (cz + j)); if (a) for (const q of a) { const d = (q[0] - x) ** 2 + (q[1] - z) ** 2; if (d < bd) { bd = d; best = q[2]; } } }
    return best && bd < 400 ? Math.round(best.lim * 3.6) : 0;
  }

  setCount(n) {
    this.count = n;
    if (!this.nav) return;
    while (this.bots.length > n) { const b = this.bots.pop(); this.app.scene.remove(b.model.root); b.model.dispose(); }
    while (this.bots.length < n) { const b = this.makeBot(); if (!b) break; this.bots.push(b); }
  }

  makeBot() {
    const id = BOT_CARS[(Math.random() * BOT_CARS.length) | 0];
    const cfg = defaultCfg(id); cfg.paint = PAINTS[(Math.random() * PAINTS.length) | 0]; cfg.steerAssist = 0; cfg.esc = false; cfg.trans = 'auto'; cfg.dif = 'lsd2'; cfg.dir = 'lsd2'; if (cfg.drive === 'awd') cfg.dc = 'active'; cfg.wing = 'none'; cfg.finish = Math.random() < 0.5 ? 'gloss' : 'metal';
    const spec = buildSpec(cfg);
    const v = new Vehicle(this.world); v.setSpec(spec); v.noReverse = true; v.trans = 'auto'; v.fuel = v.tank = 1e9;
    const model = new CarModel(spec, cfg); this.app.scene.add(model.root);
    const b = { v, model, cfg, spec, pts: [], pi: 0, cur: null, cleared: new Map(), waitT: 0, stuckT: 0, flipT: 0, sig: 0, steer: 0, hold: false, speedLim: 12, age: 0 };
    if (!this.place(b, true)) { this.app.scene.remove(model.root); model.dispose(); return null; }
    return b;
  }

  // ---------- posicionamento ----------
  place(b, anywhere = false) {
    const n = this.nav, w = this.world, P = this.app.veh.pos;
    const others = [this.app.veh, ...this.bots.filter(q => q !== b).map(q => q.v)];
    for (let tries = 0; tries < 60; tries++) {
      let x, z, tx, tz, state;
      if (n.kind === 'graph') {
        const r = n.roads[(Math.random() * n.roads.length) | 0]; if (r.pts.length < 2) continue;
        const i = (Math.random() * (r.pts.length - 1)) | 0, dir = r.oneway || Math.random() < 0.5 ? 1 : -1;
        const a = r.pts[i], c = r.pts[i + dir] || r.pts[i - dir]; if (!c) continue;
        const L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; tx = (c[0] - a[0]) / L; tz = (c[1] - a[1]) / L;
        const off = Math.min(r.w / 4, 2.3); x = a[0] - tz * off; z = a[1] + tx * off; state = { r, i, dir };
      } else {
        const k = (Math.random() * n.loop.length) | 0, a = n.loop[k], c = n.loop[(k + 1) % n.loop.length], L = Math.hypot(c.x - a.x, c.z - a.z) || 1;
        x = a.x; z = a.z; tx = (c.x - a.x) / L; tz = (c.z - a.z) / L; state = { k };
      }
      const dp = Math.hypot(x - P.x, z - P.z);
      if (dp < (anywhere ? 35 : 150) || dp > (anywhere ? 450 : 420)) continue;
      if (Math.abs(x) > w.bound - 15 || Math.abs(z) > w.bound - 15) continue;
      if (others.some(o => Math.hypot(o.pos.x - x, o.pos.z - z) < 12)) continue;
      const y = w.heightAt(x, z) + b.spec.cgH + 0.1;
      b.v.reset(x, y, z, -Math.atan2(tz, tx));
      b.v.dmgReset(); b.model.repair();
      b.cur = state; b.pts = []; b.pi = 0; b.raw = []; b.done = undefined; b.dead = false; b.cleared.clear(); b.stuckT = 0; b.flipT = 0; b.waitT = 0;
      const sp0 = 6; b.v.vel.set(tx * sp0, 0, tz * sp0); for (const h of b.v.wh) h.omega = sp0 / h.w.R;
      this.extend(b, true);
      return true;
    }
    return false;
  }

  // ---------- geração do caminho ----------
  extend(b, first = false) {
    const n = this.nav; let guard = 0;
    const lenAhead = () => { let s = 0; for (let k = b.pi; k < b.pts.length - 1; k++) s += Math.hypot(b.pts[k + 1].x - b.pts[k].x, b.pts[k + 1].z - b.pts[k].z); return s; };
    if (n.kind === 'loop') {
      while (lenAhead() < 200 && guard++ < 300) { const q = n.loop[b.cur.k % n.loop.length]; b.cur.k++; b.pts.push({ x: q.x, z: q.z, lim: n.lim, turn: 0 }); }
    } else {
      const c = b.cur;
      if (first || !b.raw.length) { const p = c.r.pts[c.i]; b.raw = [{ x: p[0], z: p[1], r: c.r, turn: 0 }]; }
      while (lenAhead() < 200 && guard++ < 80) {
        const r = c.r; let j = c.i + c.dir;
        if (j < 0 || j >= r.pts.length) {
          const opts = []; for (const e of n.vm.get(r.ids[c.i]) || []) { if (e.r === r) continue; if (e.i < e.r.pts.length - 1) opts.push({ r: e.r, i: e.i, dir: 1 }); if (e.i > 0 && !e.r.oneway) opts.push({ r: e.r, i: e.i, dir: -1 }); }
          if (!opts.length) { if (!r.oneway) { c.dir = -c.dir; continue; } b.dead = true; break; }
          const o = opts[(Math.random() * opts.length) | 0]; this.tagTurn(b, c, o); c.r = o.r; c.i = o.i; c.dir = o.dir; j = c.i + c.dir;
        }
        const r2 = c.r, p = r2.pts[j];
        // cruzamento no meio da via: às vezes vira
        const es = (n.vm.get(r2.ids[j]) || []).filter(e => e.r !== r2);
        if (es.length && Math.random() < 0.5) {
          const opts = []; for (const e of es) { if (e.i < e.r.pts.length - 1) opts.push({ r: e.r, i: e.i, dir: 1 }); if (e.i > 0 && !e.r.oneway) opts.push({ r: e.r, i: e.i, dir: -1 }); }
          if (opts.length && Math.random() < 0.6) { const o = opts[(Math.random() * opts.length) | 0]; b.raw.push({ x: p[0], z: p[1], r: r2, turn: 0 }); c.i = j; this.tagTurn(b, c, o); c.r = o.r; c.i = o.i; c.dir = o.dir; this.flushPath(b); continue; }
        }
        const last = b.raw[b.raw.length - 1]; if (Math.hypot(p[0] - last.x, p[1] - last.z) > 0.4) b.raw.push({ x: p[0], z: p[1], r: r2, turn: 0 }); c.i = j;
        this.flushPath(b);
      }
    }
  }
  tagTurn(b, c, o) {
    const r = c.r, a = r.pts[c.i], p = r.pts[Math.max(0, Math.min(r.pts.length - 1, c.i - c.dir))], q = o.r.pts[o.i + o.dir];
    if (!q) return;
    const ix = a[0] - p[0], iz = a[1] - p[1], ox = q[0] - a[0], oz = q[1] - a[1];
    const ang = Math.atan2(iz * ox - ix * oz, ix * ox + iz * oz);   // positivo = esquerda
    const rr = b.raw[b.raw.length - 1]; if (rr && Math.abs(ang) > 0.45) rr.turn = ang;
  }
  flushPath(b) {   // converte pontos centrais em pontos da faixa da direita (com 1 ponto de defasagem)
    const raw = b.raw; let k = b.done === undefined ? 0 : b.done + 1;
    while (k <= raw.length - 2) {
      const a = raw[Math.max(0, k - 1)], c = raw[k + 1], p = raw[k];
      let tx = c.x - a.x, tz = c.z - a.z; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const off = Math.min(p.r.w / 4, 2.3);
      b.pts.push({ x: p.x - tz * off, z: p.z + tx * off, lim: p.r.lim, turn: p.turn });
      b.done = k; k++;
    }
    if (b.pi > 60) { const cut = b.pi - 6; b.pts.splice(0, cut); b.pi -= cut; }
  }

  // ---------- controle ----------
  control(b, dt, now, others) {
    const v = b.v, pts = b.pts; if (pts.length < 2) { this.extend(b); return; }
    const px = v.pos.x, pz = v.pos.z, fl = Math.hypot(v.ax.x, v.ax.z) || 1, hx = v.ax.x / fl, hz = v.ax.z / fl, sp = v.fwdSpeed;
    // ponto mais próximo do caminho
    const d2 = k => (pts[k].x - px) ** 2 + (pts[k].z - pz) ** 2;
    while (b.pi < pts.length - 2 && d2(b.pi + 1) < d2(b.pi)) b.pi++;
    if (pts.length - b.pi < 12) this.extend(b);
    // ponto de mira (pure pursuit)
    const Ld = clamp(4 + Math.abs(sp) * 0.7, 5, 24);
    const along = (dist) => { let k = b.pi, rem = dist, x = pts[k].x, z = pts[k].z; let sx = px, sz = pz;
      // começa no carro até pts[pi+1]
      for (; k < pts.length - 1; k++) { const nx = pts[k + 1].x, nz = pts[k + 1].z, L = Math.hypot(nx - sx, nz - sz); if (L >= rem) { const t = rem / (L || 1); return { x: sx + (nx - sx) * t, z: sz + (nz - sz) * t, k }; } rem -= L; sx = nx; sz = nz; }
      return { x: sx, z: sz, k: pts.length - 1 }; };
    const T = along(Ld), dx = T.x - px, dz = T.z - pz;
    const alpha = Math.atan2(hz * dx - hx * dz, hx * dx + hz * dz);
    const delta = Math.atan2(2 * b.spec.WB * Math.sin(alpha), Math.max(Ld, 3));
    const want = -clamp(delta / b.spec.steerMax, -1, 1);
    b.steer += (want - b.steer) * Math.min(1, dt * 10);
    // ---- velocidade alvo ----
    let vt = (pts[b.pi].lim || 12) * 0.96;
    // curvas à frente
    let prevH = Math.atan2(pts[Math.min(b.pi + 1, pts.length - 1)].z - pts[b.pi].z, pts[Math.min(b.pi + 1, pts.length - 1)].x - pts[b.pi].x);
    for (const s of [10, 22, 40]) { const a = along(s), c = along(s + 3); const hh = Math.atan2(c.z - a.z, c.x - a.x); let dh = Math.abs(hh - prevH); if (dh > Math.PI) dh = 2 * Math.PI - dh; if (dh > 0.06) vt = Math.min(vt, Math.max(3.2, Math.sqrt(2.4 * s / dh))); }
    // sinal de seta para curvas próximas
    let sig = 0, acc = 0; for (let k = b.pi; k < pts.length - 1 && acc < 45; k++) { acc += Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].z - pts[k].z); if (pts[k].turn) { sig = pts[k].turn > 0 ? 1 : 2; break; } }
    b.sig = sig;
    // ---- regras de trânsito (semáforo / PARE / preferencial) ----
    const tr = this.world.traffic; let stopAt = -1, rule = null;
    if (tr) {
      const C = tr.cell, cx = Math.floor(px / C), cz = Math.floor(pz / C);
      let best = 1e9;
      for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { const a = tr.grid.get((cx + i) * 20011 + (cz + j)); if (!a) continue;
        for (const q of a) {
          const rx = q.x - px, rz = q.z - pz, al = rx * hx + rz * hz, lat = Math.abs(-rx * hz + rz * hx);
          if (hx * q.tx + hz * q.tz < 0.8 || al < -1.5 || al > 55 || lat > q.w / 2 + 1.5) continue;
          const cl = b.cleared.get(q.id); if (cl && now - cl < 12) continue;
          if (al < best) { best = al; rule = q; }
        } }
      if (rule) {
        const al = best, near = (x, z, R) => others.some(o => o !== v && Math.hypot(o.pos.x - x, o.pos.z - z) < R && o.vel.length() > 1.5);
        if (rule.type === 'signal') {
          const st = tr.sig(rule.grp, now);
          if (st === 0 || (st === 1 && al > sp * sp / 7 + 3)) stopAt = al;
          else if (al < 1.5) b.cleared.set(rule.id, now);
        } else if (rule.type === 'stop') {
          stopAt = al;
          if (al < 5 && Math.abs(sp) < 0.6) { b.waitT += dt; if (b.waitT > 2 && !near(rule.x + rule.tx * 6, rule.z + rule.tz * 6, 16)) { b.cleared.set(rule.id, now); b.waitT = 0; } } else if (al >= 5) b.waitT = 0;
        } else if (rule.type === 'yield') {
          vt = Math.min(vt, 6);
          if (al < 12 && near(rule.x + rule.tx * 8, rule.z + rule.tz * 8, 22)) stopAt = al; else if (al < 1.5) b.cleared.set(rule.id, now);
        }
      }
    }
    if (stopAt >= 0) { const d = Math.max(0, stopAt - 1.0); vt = Math.min(vt, Math.sqrt(2 * 2.6 * d)); if (stopAt < 1.6 && Math.abs(sp) < 0.8) vt = 0; }
    // ---- carro da frente ----
    for (const o of others) {
      if (o === v) continue;
      const rx = o.pos.x - px, rz = o.pos.z - pz, s = rx * hx + rz * hz, l = Math.abs(-rx * hz + rz * hx);
      if (s > 0 && s < 42 && l < 2.3) {
        const ov = o.vel.x * hx + o.vel.z * hz, gap = s - 4.6, want = Math.max(0, ov + (gap - (4 + Math.abs(sp) * 1.1)) * 0.5);
        vt = Math.min(vt, gap < 2 ? 0 : want);
      }
    }
    b.vt = vt;
    // ---- pedais ----
    const a = clamp((vt - sp) * 0.9, -8, 2.4);
    let thr = 0, brk = 0, hand = 0;
    if (a > 0) thr = clamp(a / 2.6, 0, 1); else brk = clamp(-a / 7, 0, 1);
    if (vt < 0.3 && Math.abs(sp) < 1) { brk = 0.7; hand = 1; thr = 0; }
    v.in.thr = thr; v.in.brk = brk; v.in.hand = hand; v.in.steer = b.steer;
    // ---- travado / capotado ----
    b.stuckT = (Math.abs(sp) < 0.4 && vt > 2.5) ? b.stuckT + dt : 0;
    { const A = pts[b.pi], Bp = pts[b.pi + 1], sx = Bp.x - A.x, sz = Bp.z - A.z, L2 = sx * sx + sz * sz || 1, tt = clamp(((px - A.x) * sx + (pz - A.z) * sz) / L2, 0, 1), dseg = Math.hypot(A.x + sx * tt - px, A.z + sz * tt - pz); b.offT = dseg > 20 ? (b.offT || 0) + dt : 0; }
    b.flipT = v.ay.y < 0.3 ? b.flipT + dt : 0;
  }

  // ---------- por quadro ----------
  update(dt, run) {
    if (!this.bots.length || !this.nav) return;
    const app = this.app, now = performance.now() / 1000, P = app.veh.pos, blink = Math.floor(now * 3) % 2 === 0;
    if (run) {
      this.acc += dt;
      if (this.acc >= 1 / 30) {
        const d = this.acc; this.acc = 0;
        const others = [app.veh, ...this.bots.map(b => b.v)];
        for (const b of this.bots) {
          this.control(b, d, now, others);
          const far = Math.hypot(b.v.pos.x - P.x, b.v.pos.z - P.z) > 520;
          const why = far ? 'far' : b.stuckT > 5 ? 'stuck' : (b.offT || 0) > 4 ? 'off' : b.flipT > 3 ? 'flip' : b.dead ? 'dead' : b.v.speed > 48 ? 'fast' : !isFinite(b.v.pos.x) ? 'nan' : '';
          if (why) { (this.stats = this.stats || {})[why] = (this.stats[why] || 0) + 1; if (why === 'stuck' || why === 'off') (this.log = this.log || []).push({ why, car: b.spec.car.name, x: +b.v.pos.x.toFixed(0), z: +b.v.pos.z.toFixed(0), road: b.pts[b.pi] && b.pts[b.pi].lim, d: b.pts[b.pi] ? +Math.hypot(b.pts[b.pi].x - b.v.pos.x, b.pts[b.pi].z - b.v.pos.z).toFixed(1) : null, steer: +b.steer.toFixed(2), vt: +(b.vt * 3.6).toFixed(0), obs: this.world.queryStatic(b.v.pos.x, b.v.pos.z, 6, []).length }); this.place(b, false) || this.place(b, true); }
        }
      }
    }
    for (const b of this.bots) {
      b.v.events.length = 0;
      for (const im of b.v.impacts) b.model.dentLocal(im.p, im.n, im.v);
      b.v.impacts.length = 0;
      b.model.update(b.v, dt, { lights: app.lightMode > 0, mode: app.night ? 2 : 0, brake: b.v.pedalBrk > 0.05, sigL: b.sig === 1, sigR: b.sig === 2, blink, wipers: 0 });
    }
  }

  step(DT, player) {
    const bots = this.bots; if (!bots.length) return;
    for (const b of bots) b.v.step(DT);
    for (let i = 0; i < bots.length; i++) {
      vehicleCollide(player, bots[i].v);
      for (let j = i + 1; j < bots.length; j++) vehicleCollide(bots[i].v, bots[j].v);
    }
  }
}
