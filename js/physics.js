// ============================================================
//  Física do veículo: corpo rígido 6-DOF, suspensão, pneu (Pacejka simplificado
//  com escorregamento combinado), motor, embreagem, câmbio, diferenciais.
// ============================================================
import * as THREE from 'three';
import { G, RHO, SURF, clamp, lerp, sstep, smooth, COMPOUNDS } from './data.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const t1 = V(), t2 = V(), t3 = V(), t4 = V(), t5 = V(), t6 = V(), t7 = V();
const RAD2RPM = 30 / Math.PI;

export function engTorqueWOT(E, rpm, fill) {
  if (rpm < 0) rpm = 0;
  const f = rpm / E.step; let i = Math.floor(f); if (i > E.curve.length - 2) i = E.curve.length - 2;
  const t = f - i;
  let T = E.curve[i] * (1 - t) + E.curve[i + 1] * t;
  if (E.kind === 'ev') return T * E.tqScaleTune;
  if (E.bar > 0) T *= (1 + E.bar * E.boostScale * fill) / (1 + E.bar);
  return T * E.torqueMult;
}

// resolve sistema linear 5x5 (eliminação de Gauss com pivoteamento)
function solve5(A, b, x) {
  const n = 5, M = A.slice(), r = b.slice();
  for (let c = 0; c < n; c++) {
    let p = c, mx = Math.abs(M[c * n + c]);
    for (let i = c + 1; i < n; i++) { const v = Math.abs(M[i * n + c]); if (v > mx) { mx = v; p = i; } }
    if (mx < 1e-12) { x[c] = 0; continue; }
    if (p !== c) { for (let j = 0; j < n; j++) { const tmp = M[c * n + j]; M[c * n + j] = M[p * n + j]; M[p * n + j] = tmp; } const tr = r[c]; r[c] = r[p]; r[p] = tr; }
    for (let i = c + 1; i < n; i++) {
      const f = M[i * n + c] / M[c * n + c]; if (f === 0) continue;
      for (let j = c; j < n; j++) M[i * n + j] -= f * M[c * n + j];
      r[i] -= f * r[c];
    }
  }
  for (let i = n - 1; i >= 0; i--) {
    let s = r[i]; for (let j = i + 1; j < n; j++) s -= M[i * n + j] * x[j];
    x[i] = Math.abs(M[i * n + i]) < 1e-12 ? 0 : s / M[i * n + i];
  }
}

// ---------- modelo de pneu ----------
// força combinada normalizada (aderência elíptica). Devolve em out[0]=Fx, out[1]=Fy (Fy ao longo de +direita)
function tireModel(kap, alp, Fz, mu, kp, ap, C, out) {
  const B = Math.tan(Math.PI / (2 * C));
  const kn = kap / kp, an = alp / ap;
  const s = Math.hypot(kn, an);
  if (s < 1e-6) { out[0] = 0; out[1] = 0; return; }
  const F = mu * Fz * Math.sin(C * Math.atan(B * s));
  out[0] = F * kn / s;
  out[1] = -F * an / s;
}

export class Vehicle {
  constructor(world) {
    this.world = world;
    this.pos = V(); this.quat = new THREE.Quaternion(); this.vel = V(); this.w = V();
    this.ax = V(1, 0, 0); this.ay = V(0, 1, 0); this.az = V(0, 0, 1);
    this.Mrot = new THREE.Matrix4();
    this.in = { thr: 0, brk: 0, steer: 0, hand: 0, up: false, down: false, nitro: false };
    this.impacts = [];
    this.events = [];
    this.tmpA = new Float64Array(25); this.tmpB = new Float64Array(5); this.tmpX = new Float64Array(5);
    this.tf = [0, 0];
    this.obs = [];
    this.dmg = { engine: 0, rad: 0, body: 0, wheel: [0, 0, 0, 0], broken: {} }; this.brokenVer = 0;
    this.localV = V(); this.accL = V(); this.prevVel = V();
    this.stats = { t: 0 };
    this.noReverse = false; this.airbag = false; this.brakeHeat = 0;
  }

  setSpec(spec) {
    this.spec = spec;
    this.wh = spec.wheels.map(w => ({
      w, omega: 0, s: w.sRest, sPrev: w.sRest, vcF: 0, contact: false, Fz: 0, n: V(0, 1, 0), cp: V(), c: V(), f: V(1, 0, 0), r: V(0, 0, 1),
      surf: 0, kappa: 0, alpha: 0, alphaF: 0, Fx: 0, Fy: 0, Fx0: 0, kt: 0, mu: 1, steer: 0, spin: 0, slip: 0, vx: 0, vy: 0, pen: 0,
      absF: 1, absAct: false, brkMax: 0, brkMode: 0, brkSgn: 1, camber: 0, comp: 0, tireDmg: 0, load: 0,
    }));
    this.E = spec.eng;
    { const frac = this.tank ? this.fuel / this.tank : 1; this.tank = spec.tank; this.fuel = this.tank * frac; if (this.engineOn === undefined) { this.engineOn = true; this.cruise = 0; this.cruiseI = 0; } }
    this.we = this.E.idle * Math.PI / 30;
    this.fill = 0;
    this.gear = 1; this.pendingGear = null; this.shiftT = 0; this.shiftTotal = 0; this.sinceShift = 1;
    this.cvtR = spec.gearInfo.ratios[0];
    this.trans = spec.trans;
    this.mClutch = 1; this.mDiff = [0, 0]; this.mCenter = 0; this.Tc = 0; this.Taxle = [0, 0];
    this.steerCmd = 0; this.steerAng = 0;
    this.cutT = 0; this.temp = 60; this.nitroLeft = 12; this.nitroOn = false;
    this.thrEff = 0; this.Te = 0; this.rpm = this.E.idle; this.speed = 0; this.fwdSpeed = 0;
    this.absAct = false; this.tcAct = false; this.escAct = false;
    this.Iinv = V(1 / spec.I.x, 1 / spec.I.y, 1 / spec.I.z);
    this.gTot = 0;
    this.camberStatic = spec.wheels.map(w => w.camber);
    this.dmgReset();
    this.updateAxes();
  }

  refuel() { this.fuel = this.tank; }
  dmgReset() { this.dmg = { engine: 0, rad: 0, body: 0, wheel: [0, 0, 0, 0], broken: {} }; this.brokenVer = (this.brokenVer || 0) + 1; this.temp = 60; this.airbag = false; this.brakeHeat = 0; }

  reset(x, y, z, yaw) {
    const s = this.spec;
    this.pos.set(x, y, z);
    this.quat.setFromAxisAngle(V(0, 1, 0), yaw);
    this.vel.set(0, 0, 0); this.w.set(0, 0, 0);
    for (const h of this.wh) { h.omega = 0; h.s = h.w.sRest; h.sPrev = h.w.sRest; h.alphaF = 0; h.contact = false; }
    this.we = this.E.idle * Math.PI / 30; this.fill = 0; this.gear = 1; this.shiftT = 0; this.pendingGear = null;
    this.steerCmd = 0; this.cl = null; this.fallen = false; this.lean = 0; this.updateAxes();
  }

  // põe o carro de pé no lugar atual
  rightSelf() {
    const fwd = V(1, 0, 0).applyQuaternion(this.quat); fwd.y = 0;
    const yaw = Math.atan2(-fwd.z, fwd.x);
    const x = this.pos.x, z = this.pos.z;
    const h = this.world.heightAt(x, z);
    this.quat.setFromAxisAngle(V(0, 1, 0), yaw);
    this.pos.set(x, h + this.spec.cgH + 0.45, z);
    this.vel.set(0, 0, 0); this.w.set(0, 0, 0);
    for (const hh of this.wh) hh.omega = 0;
    this.fallen = false;
    this.updateAxes();
  }

  updateAxes() {
    this.Mrot.makeRotationFromQuaternion(this.quat);
    const e = this.Mrot.elements;
    this.ax.set(e[0], e[1], e[2]); this.ay.set(e[4], e[5], e[6]); this.az.set(e[8], e[9], e[10]);
  }

  toWorld(local, out) { return out.copy(local).applyQuaternion(this.quat).add(this.pos); }
  _qi(q) { this._qinv = this._qinv || new THREE.Quaternion(); return this._qinv.copy(q).invert(); }

  invIworld(v, out) { // I^-1 em coordenadas mundo
    const qi = this._qi(this.quat);
    out.copy(v).applyQuaternion(qi);
    out.set(out.x * this.Iinv.x, out.y * this.Iinv.y, out.z * this.Iinv.z);
    return out.applyQuaternion(this.quat);
  }

  // =====================================================================
  step(dt) {
    const s = this.spec, world = this.world;
    this.stats.t += dt;
    this.updateAxes();
    this.prevVel.copy(this.vel);
    this.fwdSpeed = this.vel.dot(this.ax);
    this.speed = this.vel.length();
    this.updateControls(dt);
    this.updateTransmission(dt);
    this.updateEngine(dt);
    this.suspension(dt);
    this.tires(dt);
    this.driveline(dt);
    this.integrate(dt);
    this.collisions(dt);
    this.thermal(dt);
    // aceleração em g (local) para o HUD
    const acc = t1.copy(this.vel).sub(this.prevVel).divideScalar(dt).applyQuaternion(this._qi(this.quat));
    this.accL.lerp(acc, Math.min(1, dt * 12));
  }

  // ---------- comandos do piloto ----------
  updateControls(dt) {
    const s = this.spec, inp = this.in;
    // pedais
    let thr = clamp(inp.thr, 0, 1), brk = clamp(inp.brk, 0, 1);
    const fs = this.fwdSpeed;
    if (this.trans === 'auto' && !s.isEV || (s.isEV && this.trans === 'auto')) {
      // lógica D/R automática
      if (this.gear === -1) {
        // em ré, pedal "frente" freia e "trás" acelera
        if (inp.thr > 0.05 && fs < -0.8) { brk = Math.max(brk, inp.thr); thr = 0; }
        else if (inp.thr > 0.05 && Math.abs(fs) <= 0.8) { this.requestGear(1); thr = 0; }
        else { thr = clamp(inp.brk, 0, 1); brk = 0; if (inp.brk > 0.05 && fs > 0.5) { brk = inp.brk; thr = 0; } }
      } else {
        if (!this.noReverse && inp.brk > 0.05 && inp.thr < 0.05 && Math.abs(fs) < 0.9 && this.speedLow()) { this.requestGear(-1); thr = 0; brk = 0; }
      }
    } else if (this.gear === -1) {
      // manual: pedal freio fica freio
    }
    if (this.cruise > 0) {
      if (brk > 0.05 || inp.hand > 0.2 || this.gear <= 0 || fs < 3) this.cruise = 0;
      else { const e = this.cruise - fs; this.cruiseI = clamp(this.cruiseI + e * dt * 0.06, -0.3, 0.6); thr = Math.max(thr, clamp(0.18 + e * 0.25 + this.cruiseI, 0, 1)); }
    } else this.cruiseI = 0;
    this.pedalThr = thr; this.pedalBrk = brk;
    // direção: velocidade limita ângulo
    const v = Math.abs(fs);
    let lim = 1;
    if (s.steerAssist > 0) {
      const k = [0, 0.55, 1.0][s.steerAssist] ?? 0.55;
      lim = 1 / (1 + k * Math.pow(v / 22, 2));
      // contra-esterço: permite mais ângulo quando derrapando
      const slipAng = Math.abs(Math.atan2(this.localVy || 0, Math.max(Math.abs(fs), 2)));
      lim = Math.max(lim, Math.min(1, slipAng * 1.6 / s.steerMax * 1.0));
    }
    if (s.bike) lim = 1 / (1 + Math.pow(v / 11, 2)) + 0.02;
    // Ackermann
    this.steerLim = lim;
    const d = -clamp(inp.steer, -1, 1) * s.steerMax * lim; // + = esquerda
    this.steerAng = d;
    const L = s.WB, tF = s.car.tF;
    const td = Math.tan(Math.abs(d));
    const inner = Math.atan2(L * td, L - s.ack * tF / 2 * td);
    const outer = Math.atan2(L * td, L + s.ack * tF / 2 * td);
    const sg = Math.sign(d);
    // d>0 (esquerda): roda esquerda (0) é interna
    const dl = sg >= 0 ? inner * sg : -outer * 1, dr = sg >= 0 ? outer * sg : -inner * 1;
    this.wh[0].steer = (sg >= 0 ? inner : -outer) + this.wh[0].w.toe;
    this.wh[1].steer = (sg >= 0 ? outer : -inner) + this.wh[1].w.toe;
    this.wh[2].steer = this.wh[2].w.toe; this.wh[3].steer = this.wh[3].w.toe;
    for (let i = 0; i < 4; i++) this.wh[i].steer += (this.dmg.wheel[i] || 0) * 0.06 * (i % 2 ? 1 : -1);
  }
  speedLow() { return true; }

  requestGear(g) {
    if (this.gear === g || this.pendingGear === g) return;
    const gi = this.spec.gearInfo;
    this.pendingGear = g;
    this.shiftTotal = (gi.type === 'ev' || gi.type === 'cvt') ? 0.05 : Math.max(0.06, gi.shiftTime);
    if (this.gear === 0 || this.gear === -1 || g <= 0) this.shiftTotal = 0.15;
    this.shiftT = this.shiftTotal;
    this.sinceShift = 0;
  }

  // ---------- transmissão ----------
  updateTransmission(dt) {
    const s = this.spec, gi = s.gearInfo, inp = this.in;
    this.sinceShift += dt;
    if (this.shiftT > 0) {
      this.shiftT = Math.max(0, this.shiftT - dt);
      if (this.pendingGear != null && this.shiftT <= this.shiftTotal * 0.5) { this.gear = this.pendingGear; this.pendingGear = null; }
    }
    const rpm = this.we * RAD2RPM;
    const E = this.E;
    // roda de entrada (rpm que o motor teria se acoplado)
    if (this.gear >= 1 && this.shiftT === 0) {
      if (gi.type === 'cvt') {
        const thr = this.pedalThr;
        const wc = this.shaftSpeed() * 1.0; // rad/s no eixo de entrada do diferencial
        const rpmT = lerp(E.idle * 1.35, E.rpmP * 0.92, Math.pow(thr, 0.75));
        let rt = wc > 1 ? (rpmT / RAD2RPM) / wc : gi.ratios[0];
        rt = clamp(rt, gi.ratios[1], gi.ratios[0]);
        this.cvtR += (rt - this.cvtR) * Math.min(1, dt * (rt < this.cvtR ? 3.5 : 6));
        this.cvtR = clamp(this.cvtR, gi.ratios[1], gi.ratios[0]);
      } else if (this.trans === 'auto' && gi.n > 1) {
        const thr = this.pedalThr;
        const up = lerp(E.idle + (E.red - E.idle) * 0.33, E.red * 0.955, clamp(thr * 1.15, 0, 1));
        const dn = E.idle * 1.15 + (E.red - E.idle) * (0.16 + 0.14 * thr);
        const g = this.gear, n = gi.n;
        const rNext = g < n ? gi.ratios[g] / gi.ratios[g - 1] : 1;
        const rPrev = g > 1 ? gi.ratios[g - 2] / gi.ratios[g - 1] : 1;
        const minGap = gi.type === 'dct' || gi.type === 'seq' ? 0.25 : 0.55;
        if (this.sinceShift > minGap) {
          if (g < n && rpm > up && rpm * rNext > E.idle * 1.35) this.requestGear(g + 1);
          else if (g > 1 && rpm < dn && rpm * rPrev < E.red * 0.9) this.requestGear(g - 1);
          else if (g > 1 && thr > 0.88 && rpm < E.rpmP * 0.62 && rpm * rPrev < E.red * 0.88) this.requestGear(g - 1); // kickdown
        }
      }
    }
    // marchas manuais
    if (inp.up) { inp.up = false; this.manualShift(1); }
    if (inp.down) { inp.down = false; this.manualShift(-1); }
    // relação total
    let g = 0;
    if (this.shiftT > 0 && this.pendingGear != null && this.shiftT > this.shiftTotal * 0.5) g = this.currentRatio(this.gear);
    else g = this.currentRatio(this.gear);
    this.gTot = g;
  }

  manualShift(d) {
    const gi = this.spec.gearInfo;
    if (gi.type === 'cvt' || gi.type === 'ev') {
      if (d > 0 && this.gear <= 0) this.requestGear(this.gear + 1);
      else if (d < 0 && this.gear >= 1) this.requestGear(this.gear - 1 <= 0 ? 0 : 1);
      if (d < 0 && this.gear === 0) this.requestGear(-1);
      return;
    }
    let tgt = (this.pendingGear != null ? this.pendingGear : this.gear) + d;
    tgt = clamp(tgt, -1, gi.n);
    if (tgt === 0 && d !== 0) { /* neutra */ }
    this.requestGear(tgt);
  }

  currentRatio(g) {
    const gi = this.spec.gearInfo;
    if (g === 0) return 0;
    if (g < 0) return -gi.rev;
    if (gi.type === 'cvt') return this.cvtR;
    return gi.ratios[Math.min(g, gi.n) - 1];
  }

  shaftSpeed() { // velocidade angular (rad/s) na entrada do diferencial, ponderada
    const dl = this.spec.driveline, W = this.wh;
    if (dl.layout === 'fwd') return (W[0].omega + W[1].omega) / 2;
    if (dl.layout === 'rwd') return (W[2].omega + W[3].omega) / 2;
    return dl.cf * (W[0].omega + W[1].omega) / 2 + (1 - dl.cf) * (W[2].omega + W[3].omega) / 2;
  }

  // ---------- motor ----------
  updateEngine(dt) {
    const s = this.spec, E = this.E, inp = this.in;
    const rpm = this.we * RAD2RPM; this.rpm = rpm;
    let thr = this.pedalThr;
    // controle de tração
    this.tcAct = false;
    if (s.tc) {
      let ks = 0;
      for (const h of this.wh) if (h.w.driven && h.contact) ks = Math.max(ks, h.kappa);
      const thres = 0.17;
      if (ks > thres) { thr *= clamp(1 - (ks - thres) * 6, 0.12, 1); this.tcAct = true; }
    }
    // ESC: reduz acelerador em subviragem/sobreviragem forte
    if (this.escCut > 0) { thr *= 1 - this.escCut; }
    const running = this.engineOn && this.fuel > 0;
    this.running = running;
    if (!running) thr = 0;
    if (E.kind !== 'ev' && running) {
      const idleThr = 0.07 + clamp((E.idle - rpm) / 200, 0, 0.6);
      thr = Math.max(thr, idleThr);
    }
    // limitador
    if (rpm > E.red) this.cutT = 0.07;
    if (this.cutT > 0) { this.cutT -= dt; if (E.kind !== 'ev') thr = 0; else thr *= 0.0; }
    this.thrEff = thr;
    // turbo / compressor
    if (E.bar > 0) {
      const lo = E.boostLo, hi = E.boostHi;
      let target = sstep(lo, hi, rpm) * (E.sc ? (0.55 + 0.45 * thr) : (0.10 + 0.90 * thr));
      let tau = E.sc ? 0.12 : (0.95 - 0.7 * sstep(lo, hi * 1.5, rpm));
      if (target < this.fill) tau = 0.22;
      this.fill += (target - this.fill) * (1 - Math.exp(-dt / Math.max(0.05, tau)));
    }
    // nitro
    this.nitroOn = false;
    if (inp.nitro && this.nitroLeft > 0 && s.cfg.nitro && thr > 0.5) { this.nitroOn = true; this.nitroLeft -= dt; }
    const health = 1 - 0.55 * this.dmg.engine;
    const hot = 1 - clamp((this.temp - 108) / 40, 0, 0.6);
    let Twot = engTorqueWOT(E, rpm, this.fill) * health * hot * (this.nitroOn ? 1.32 : 1);
    let Te;
    if (E.kind === 'ev') {
      const reg = E.regen * E.def.Tmax * sstep(80, 600, rpm) * (1 - thr) * 0.8 + E.def.Tmax * 0.35 * this.pedalBrk * sstep(80, 600, rpm);
      Te = Twot * thr - reg;
    } else {
      const fr = E.fric * E.peakTq * (0.6 + rpm / E.red) * (E.kind === 'diesel' ? 1.35 : 1);
      Te = Twot * thr - fr * (1 - thr);
    }
    if (!running && E.kind === 'ev') Te = 0;
    this.Te = Te; this.Twot = Twot;
    this.powerKw = Math.max(0, Te * this.we / 1000);
    // consumo de combustível / bateria
    if (running) {
      const Pk = Te * this.we / 1000;
      if (E.kind === 'ev') { this.fuel = Math.min(this.tank, Math.max(0, this.fuel - (Pk > 0 ? Pk : Pk * 0.6) * dt / 3600)); }
      else { const eq = Pk > 0 ? Pk + 1.2 : (rpm > 1400 ? 0.15 : 0.6); const gps = eq * (E.kind === 'diesel' ? 210 : 260) / 3600; this.fuel = Math.max(0, this.fuel - gps / (E.kind === 'diesel' ? 830 : 745) * dt); }
    }
  }

  // ---------- suspensão e contato com o solo ----------
  suspension(dt) {
    const s = this.spec, world = this.world;
    const ay = this.ay, ax = this.ax;
    const hx = ax.x, hz = ax.z, hl = Math.hypot(hx, hz) || 1;
    const dxh = hx / hl, dzh = hz / hl;
    const offs = [-0.75, -0.4, 0, 0.4, 0.75];
    for (let i = 0; i < 4; i++) {
      const h = this.wh[i], w = h.w, R = w.R;
      const m = this.toWorld(w.mountL, t1); // posição do ponto de fixação
      let sCur = h.s, bh = 0, bpx = 0, bpz = 0, bk = 2;
      const uy = Math.max(ay.y, 0.12);
      for (let it = 0; it < 2; it++) {
        const cx = m.x - ay.x * sCur, cy = m.y - ay.y * sCur, cz = m.z - ay.z * sCur;
        let best = -1e9;
        for (let k = 0; k < 5; k++) {
          const d = offs[k] * R;
          const px = cx + dxh * d, pz = cz + dzh * d;
          const hh = world.heightAt(px, pz);
          const need = hh + Math.sqrt(R * R - d * d) * (s.bike ? 0.25 + 0.75 * Math.max(ay.y, 0.2) : 1);
          if (need > best) { best = need; bh = hh; bpx = px; bpz = pz; bk = k; }
        }
        sCur = (m.y - best) / uy;
      }
      const prevContact = h.contact;
      let contact = ay.y > 0.3 && sCur <= w.sMax + 0.002;
      let pen = 0;
      if (sCur < w.sMin) { pen = (w.sMin - sCur) * uy; sCur = w.sMin; }
      if (sCur > w.sMax) sCur = w.sMax;
      h.pen = Math.min(pen, 0.12);
      const vc = (h.s - sCur) / dt;   // velocidade de compressão
      h.vcF += (clamp(vc, -6, 6) - h.vcF) * Math.min(1, dt * 90);
      h.sPrev = h.s; h.s = sCur;
      h.contact = contact;
      h.comp = w.sRest - sCur;
      if (!contact) { h.Fz = 0; h.n.set(0, 1, 0); continue; }
      // posição do centro da roda e ponto de contato
      h.c.set(m.x - ay.x * sCur, m.y - ay.y * sCur, m.z - ay.z * sCur);
      h.cp.set(bpx, bh, bpz);
      world.normalAt(bpx, bpz, t2);
      if (bk === 2) h.n.copy(t2);
      else { t3.copy(h.c).sub(h.cp).divideScalar(R); h.n.copy(t2).multiplyScalar(0.5).addScaledVector(t3, 0.5).normalize(); }
      if (h.n.y < 0.3) { h.n.y = 0.3; h.n.normalize(); }
      h.surf = world.surfAt(bpx, bpz);
      h.surfBump = bk;
    }
    // barras estabilizadoras + molas
    for (let a = 0; a < 2; a++) {
      const L = this.wh[a * 2], Rr = this.wh[a * 2 + 1];
      const dcmp = L.comp - Rr.comp;
      const arb = L.w.arb;
      for (const [h, sg] of [[L, 1], [Rr, -1]]) {
        if (!h.contact) continue;
        const w = h.w;
        let F = Math.max(0, w.k * (w.sFree - h.s));
        const vc = h.vcF;
        const knee = 0.12;
        const c = vc > 0 ? w.cb : w.cr;
        const av = Math.abs(vc);
        const dF = c * (av < knee ? av : knee + 0.45 * (av - knee)) * Math.sign(vc);
        F += dF;
        F += sg * arb * dcmp;
        const stop = w.sMin + 0.03;
        if (h.s < stop) F += 350000 * (stop - h.s);
        if (h.pen > 0) F += 250000 * h.pen + 0 * h.vcF;
        F = Math.max(0, F) * smooth((this.ay.y - 0.3) / 0.25);
        h.Fz = Math.min(F, 4.5 * this.spec.mass * G);
        h.load = h.Fz;
      }
    }
  }

  // ---------- pneus ----------
  tires(dt) {
    const s = this.spec, world = this.world;
    const wet = world.wet || 0;
    // inclinação lateral do carro (para câmber dinâmico)
    this.localVy = 0;
    const bodyV = this._qi(this.quat);
    t7.copy(this.vel).applyQuaternion(bodyV); this.localVy = t7.z; this.localVx = t7.x;
    let fzSum = 0;
    for (const h of this.wh) fzSum += h.Fz;
    // velocidade de guinada
    this.yawRate = this.w.dot(this.ay);
    for (let i = 0; i < 4; i++) {
      const h = this.wh[i], w = h.w;
      h.Fx = 0; h.Fy = 0; h.Fx0 = 0; h.kt = 0; h.slip = 0; h.absAct = false;
      if (!h.contact) continue;
      const n = h.n;
      // direção da roda
      const st = h.steer;
      const cs = Math.cos(st), sn = Math.sin(st);
      // forward' = ax*cos + (ay x ax)*sin  ; ay x ax = -az
      t2.copy(this.ax).multiplyScalar(cs).addScaledVector(this.az, -sn);
      t2.addScaledVector(n, -t2.dot(n)).normalize();
      h.f.copy(t2);
      h.r.copy(t3.copy(t2).cross(n));
      // velocidade do ponto de contato
      t4.copy(h.cp).sub(this.pos);
      t5.copy(this.w).cross(t4).add(this.vel);
      const vx = t5.dot(h.f), vy = t5.dot(h.r);
      h.vx = vx; h.vy = vy;
      const R = w.R;
      const den = Math.max(Math.abs(vx), 3.0);
      const denk = Math.max(Math.abs(vx), 1.6);
      // lag de relaxação do ângulo de deriva
      const a0 = Math.atan2(vy, den);
      const lagK = clamp(Math.abs(vx) * dt / 0.30, 0.05, 1);
      h.alphaF += (a0 - h.alphaF) * lagK;
      const alpha = h.alphaF;
      const kappa = (h.omega * R - vx) / denk;
      h.alpha = alpha; h.kappa = kappa;
      // coeficiente de atrito
      const surf = SURF[h.surf];
      const cm = w.comp;
      let mu = cm.mu;
      let sm = surf.mu;
      if (surf.hard) { if (surf.id === 0 || surf.id === 1 || surf.id === 8) sm *= (1 - 0.34 * wet); }
      else { mu *= cm.loose / cm.mu * 0.0 + 1; sm *= cm.loose * (1 - 0.22 * wet); }
      // pressão (peso maior em solo mole: pressão baixa ajuda)
      const popt = 2.2;
      const pf = surf.hard ? 1 - 0.30 * Math.pow((w.press - popt) / popt, 2) : 1 + 0.10 * clamp((popt - w.press) / 1.2, -1, 1);
      // largura
      const wf = Math.pow(w.tw / 225, 0.16);
      // câmber
      const lean = Math.asin(clamp(this.ay.dot(h.r), -1, 1));
      let gam = w.camber + 0.55 * lean * (w.side > 0 ? 1 : -1);
      const cf = Math.max(0.75, 1 - 5 * Math.pow(gam + 0.045, 2));
      // sensibilidade à carga
      const Fz = h.Fz;
      const lf = clamp(1 - cm.ls * (Fz / w.Fz0 - 1), 0.55, 1.3);
      const dmgF = 1 - 0.3 * (this.dmg.wheel[i] || 0);
      mu = cm.mu * sm * pf * wf * cf * lf * dmgF;
      h.mu = mu;
      const ap = cm.ap * clamp(1 + 0.18 * (Fz / w.Fz0 - 1), 0.75, 1.4);
      // dois cálculos para obter dFx/dκ
      tireModel(kappa, alpha, Fz, mu, cm.kp, ap, cm.C, this.tf);
      let Fx0 = this.tf[0], Fy = this.tf[1];
      const dk = 0.02;
      tireModel(kappa + dk, alpha, Fz, mu, cm.kp, ap, cm.C, this.tf);
      let kt = Math.max(0, (this.tf[0] - Fx0) / dk) * R / denk; // dFx/dω
      // baixa velocidade: amortecimento lateral viscoso para não vibrar
      const vlow = 1.5;
      if (Math.abs(vx) < vlow) {
        const mEff = this.spec.mass * 0.25;
        const Fv = clamp(-mEff * vy / dt * 0.3, -mu * Fz, mu * Fz);
        const bl = Math.abs(vx) / vlow;
        Fy = Fy * bl + Fv * (1 - bl);
      }
      // resistência ao rolamento e solo mole
      const crr = cm.crr * (surf.hard ? 1 : 0.5) + surf.crr;
      const rr = -crr * Fz * clamp(vx / 1.0, -1, 1);
      h.Fx0 = Fx0 + rr; h.Fy = Fy; h.kt = kt;
      h.slip = Math.hypot(kappa / cm.kp, alpha / ap);
    }
  }

  // ---------- trem de força ----------
  driveline(dt) {
    const s = this.spec, E = this.E, dl = s.driveline, W = this.wh;
    const inp = this.in;
    const g = this.gTot;
    const eta = dl.eta;
    const idt = 1 / dt;
    // ----- freios + ABS + ESC -----
    const bp = this.pedalBrk;
    this.absAct = false;
    // ESC
    this.escAct = false; this.escCut = 0;
    const escB = [0, 0, 0, 0];
    if (s.esc && Math.abs(this.fwdSpeed) > 8 && this.wh.every(h => h.contact || true)) {
      const delta = this.steerAng;
      const vch = 20;
      const des = this.fwdSpeed * Math.tan(delta) / (s.WB * (1 + Math.pow(this.fwdSpeed / vch, 2) * 0.35));
      const err = this.yawRate - des;
      const over = Math.sign(des || err) * err; // >0 = sobrevira
      const beta = Math.atan2(this.localVy, Math.abs(this.fwdSpeed) + 0.5);
      if (over > 0.22 + 0.1 * Math.abs(des)) {
        // sobreesterço: freia roda dianteira externa
        const outer = (this.yawRate > 0) ? 1 : 0; // girando p/ esquerda -> externa = direita (1)
        escB[outer] = clamp((over - 0.2) * 2.2, 0, 1); this.escCut = clamp((over - 0.2) * 1.5, 0, 0.8); this.escAct = true;
      } else if (over < -0.18 && Math.abs(des) > 0.12 && Math.abs(this.fwdSpeed) > 12) {
        const inner = (des > 0) ? 2 : 3;
        escB[inner] = clamp((-over - 0.15) * 1.6, 0, 0.7); this.escCut = clamp((-over - 0.15) * 1.2, 0, 0.6); this.escAct = true;
      }
    }
    for (let i = 0; i < 4; i++) {
      const h = W[i], w = h.w;
      let p = bp;
      if (s.abs && bp > 0.02 && h.contact) {
        const kk = h.kappa;
        if (kk < -0.13 && Math.abs(h.vx) > 1.5) {
          h.absF = clamp(1 - (-kk - 0.13) / 0.05, 0, 1) * 0.98; h.absAct = true; this.absAct = true;
        } else h.absF += (1 - h.absF) * 0.25;
      } else h.absF = 1;
      let Tb = w.brake * p * (s.abs ? h.absF : 1);
      if (i >= 2) Tb += inp.hand * w.brake * 2.6;
      Tb += w.brake * escB[i] * 0.9;
      // freio-motor de roda travada em velocidade zero
      h.brkMax = Tb;
    }
    // ----- embreagem -----
    const rpm = this.we * RAD2RPM;
    const gi = s.gearInfo;
    let eng = 1;
    if (E.kind === 'ev') eng = 1;
    else {
      const rpmIn = Math.abs(g * this.shaftSpeed()) * RAD2RPM;
      const rpmL = E.idle * 1.3 + (Math.min(E.rpmT * 0.72, 4300) - E.idle * 1.3) * Math.pow(this.pedalThr, 0.8);
      const capMax = Math.max(E.peakTq * 1.7, 120) * (E.clutchMult || 1);
      const eLaunch = clamp((Math.max(0, this.Te) * 0.95 + 0.22 * (rpm - rpmL) + 6) / capMax, 0, 1);
      const mism = Math.abs(rpm - rpmIn);
      const eSpeed = rpmIn > E.idle * 0.9 ? clamp((480 - mism) / 160, 0, 1) : 0;
      let tgt = Math.max(eLaunch, eSpeed);
      if (gi.type === 'auto' || gi.type === 'cvt') tgt = Math.max(tgt, this.pedalBrk > 0.1 ? 0.0 : 0.045); // fluência (creep)
      if (rpm < E.idle * 0.7) tgt *= 0.5;
      this.cl = this.cl == null ? tgt : this.cl + (tgt - this.cl) * Math.min(1, dt / 0.05);
      eng = this.cl;
    }
    if (this.shiftT > 0) {
      const ph = this.shiftT / Math.max(this.shiftTotal, 1e-3);
      eng *= Math.pow(Math.abs(2 * ph - 1), 1.4);
    }
    if (g === 0) eng = 0;
    const Tcap = eng * Math.max(E.peakTq * 1.7, 120) * (E.clutchMult || 1) * (E.kind === 'ev' ? 3 : 1);
    this.Tcap = Tcap;
    const kc = Tcap / 9;
    // frações
    let cC, frac;
    if (dl.layout === 'fwd') { cC = [0.5, 0.5, 0, 0]; frac = cC; }
    else if (dl.layout === 'rwd') { cC = [0, 0, 0.5, 0.5]; frac = cC; }
    else { const cf = dl.cf; cC = [cf / 2, cf / 2, (1 - cf) / 2, (1 - cf) / 2]; frac = cC; }
    // acoplamentos de diferencial
    const difs = [dl.difF, dl.difR];
    const kd = [0, 0], capd = [0, 0];
    for (let a = 0; a < 2; a++) {
      const d = difs[a];
      const driven = (a === 0 && dl.layout !== 'rwd') || (a === 1 && dl.layout !== 'fwd');
      if (!driven || d.preload === 0 && d.pw === 0 && d.co === 0) continue;
      if (d.preload > 1e5) { kd[a] = 4000; capd[a] = 1e9; }
      else { kd[a] = 140; capd[a] = d.preload + (this.Taxle[a] >= 0 ? d.pw : d.co) * Math.abs(this.Taxle[a]); }
    }
    let kcen = 0, capc = 0;
    if (dl.layout === 'awd' && dl.center.cap > 0) { kcen = dl.center.cap > 1e5 ? 6000 : 60; capc = dl.center.cap; }

    const A = this.tmpA, B = this.tmpB, X = this.tmpX;
    const w0 = this.shaftSpeed();
    let Tcs = (Math.sign(this.we - g * w0) || 1) * Tcap; const diffSg = [Math.sign(W[0].omega - W[1].omega) || 1, Math.sign(W[2].omega - W[3].omega) || 1];
    let cenSg = Math.sign((W[0].omega + W[1].omega) - (W[2].omega + W[3].omega)) || 1;
    let mClutch = (Tcap < 1 || g === 0) ? 0 : this.mClutch === 0 ? 1 : this.mClutch;
    let mDiff = this.mDiff.slice(); let mCen = this.mCenter;
    const brkMode = W.map(h => h.brkMode), brkSgn = W.map(h => h.brkSgn);
    const wOmega = W.map(h => h.omega);
    let sol = [0, 0, 0, 0, 0];
    for (let pass = 0; pass < 3; pass++) {
      A.fill(0); B.fill(0);
      // linha do motor
      A[0] = E.J * idt; B[0] = E.J * idt * this.we + this.Te;
      if (mClutch === 1) {
        A[0] += kc;
        for (let j = 0; j < 4; j++) A[1 + j] -= kc * g * cC[j];
      } else if (mClutch === 2) B[0] -= Tcs;
      for (let i = 0; i < 4; i++) {
        const h = W[i], row = (1 + i) * 5, R = h.w.R;
        A[row + 1 + i] += h.w.Iw * idt + R * h.kt;
        B[1 + i] = h.w.Iw * idt * wOmega[i] - R * h.Fx0 + R * h.kt * wOmega[i];
        // freio
        if (h.brkMax > 0) {
          if (brkMode[i] === 0) A[row + 1 + i] += h.brkMax / 0.5;
          else B[1 + i] -= brkSgn[i] * h.brkMax;
        }
        // torque do motor
        const fr = frac[i];
        if (fr > 0 && mClutch) {
          if (mClutch === 1) {
            A[row + 0] -= fr * eta * g * kc;
            for (let j = 0; j < 4; j++) A[row + 1 + j] += fr * eta * g * g * kc * cC[j];
          } else B[1 + i] += fr * eta * g * Tcs;
        }
      }
      // diferenciais (par 0-1 dianteiro, 2-3 traseiro)
      for (let a = 0; a < 2; a++) {
        if (kd[a] <= 0) continue;
        const L = a * 2, Rr = a * 2 + 1;
        if (mDiff[a] === 0) {
          A[(1 + L) * 5 + 1 + L] += kd[a]; A[(1 + L) * 5 + 1 + Rr] -= kd[a];
          A[(1 + Rr) * 5 + 1 + L] -= kd[a]; A[(1 + Rr) * 5 + 1 + Rr] += kd[a];
        } else { B[1 + L] -= diffSg[a] * capd[a]; B[1 + Rr] += diffSg[a] * capd[a]; }
      }
      // acoplamento central
      if (kcen > 0) {
        const q = kcen / 4;
        if (mCen === 0) {
          for (let i = 0; i < 4; i++) {
            const sg = i < 2 ? 1 : -1;
            for (let j = 0; j < 4; j++) A[(1 + i) * 5 + 1 + j] += sg * q * (j < 2 ? 1 : -1);
          }
        } else {
          for (let i = 0; i < 4; i++) B[1 + i] += (i < 2 ? -1 : 1) * cenSg * capc / 2;
        }
      }
      solve5(A, B, X);
      sol = [X[0], X[1], X[2], X[3], X[4]];
      // avalia modos
      let changed = false;
      if (mClutch) {
        let wc = 0; for (let j = 0; j < 4; j++) wc += cC[j] * X[1 + j];
        const Tl = kc * (X[0] - g * wc);
        const nm = Math.abs(Tl) > Tcap ? 2 : 1;
        if (nm !== mClutch) { mClutch = nm; changed = true; }
        const nTcs = (Math.sign(Tl) || 1) * Tcap;
        if (nm === 2 && Math.sign(nTcs) !== Math.sign(Tcs)) changed = true;
        Tcs = nTcs;
        this.Tc = nm === 1 ? Tl : Tcs;
      } else this.Tc = 0;
      for (let a = 0; a < 2; a++) {
        if (kd[a] <= 0) continue;
        const Tl = kd[a] * (X[1 + a * 2] - X[2 + a * 2]);
        const nm = Math.abs(Tl) > capd[a] ? 1 : 0;
        if (nm !== mDiff[a]) { mDiff[a] = nm; changed = true; }
        diffSg[a] = Math.sign(Tl) || 1;
      }
      if (kcen > 0) {
        const Tl = kcen * ((X[1] + X[2]) / 2 - (X[3] + X[4]) / 2);
        const nm = Math.abs(Tl) > capc ? 1 : 0;
        if (nm !== mCen) { mCen = nm; changed = true; }
        cenSg = Math.sign(Tl) || 1;
      }
      for (let i = 0; i < 4; i++) {
        const h = W[i];
        if (h.brkMax <= 0) continue;
        const Tb = h.brkMax / 0.5 * X[1 + i];
        const nm = Math.abs(Tb) > h.brkMax ? 1 : 0;
        if (nm !== brkMode[i]) { brkMode[i] = nm; changed = true; }
        brkSgn[i] = Math.sign(X[1 + i]) || 1;
      }
      if (!changed) break;
    }
    this.mClutch = mClutch; this.mDiff = mDiff; this.mCenter = mCen;
    for (let i = 0; i < 4; i++) { W[i].brkMode = brkMode[i]; W[i].brkSgn = brkSgn[i]; }
    // aplica
    this.we = Math.max(0, sol[0]);
    if (E.kind !== 'ev' && this.we < 0.15 * E.idle * Math.PI / 30) this.we = 0.15 * E.idle * Math.PI / 30;
    for (let i = 0; i < 4; i++) {
      const h = W[i];
      const om = sol[1 + i];
      const dOm = om - h.omega;
      if (h.contact) {
        let Fx = h.Fx0 + h.kt * dOm;
        const lim = h.mu * h.Fz * 1.35 + 1;
        h.Fx = clamp(Fx, -lim, lim);
      } else h.Fx = 0;
      h.omega = om;
      h.spin += om * dt;
    }
    // torques de eixo (para LSD) a partir da embreagem
    const Tin = eta * g * this.Tc;
    this.Taxle[0] = Tin * (dl.layout === 'fwd' ? 1 : dl.layout === 'awd' ? dl.cf : 0);
    this.Taxle[1] = Tin * (dl.layout === 'rwd' ? 1 : dl.layout === 'awd' ? 1 - dl.cf : 0);
  }

  // ---------- integra o corpo ----------
  integrate(dt) {
    const s = this.spec, M = s.mass;
    const F = t1.set(0, -M * G, 0);
    const T = t2.set(0, 0, 0);
    for (let i = 0; i < 4; i++) {
      const h = this.wh[i];
      if (!h.contact) continue;
      // ponto de aplicação elevado (centro de rolagem)
      t3.copy(h.cp).addScaledVector(this.ay, s.rcH);
      t4.copy(h.n).multiplyScalar(h.Fz).addScaledVector(h.f, h.Fx).addScaledVector(h.r, h.Fy);
      F.add(t4);
      t5.copy(t3).sub(this.pos).cross(t4);
      T.add(t5);
    }
    // aerodinâmica (referencial local)
    const q = this._qi(this.quat);
    const vl = t3.copy(this.vel).applyQuaternion(q);
    const sp = vl.length();
    const fl = t4.set(-0.5 * RHO * s.cdA * sp * vl.x, -0.5 * RHO * s.cdA * 1.4 * sp * vl.y * 0.6, -0.5 * RHO * s.cdAside * sp * vl.z);
    const qd = 0.5 * RHO * vl.x * Math.abs(vl.x);
    let clF = s.clF, clR = s.clR; { const bk = this.dmg.broken, pa = s.partAero; if (pa) { if (bk.wing) clR -= pa.wing.cl; if (bk.split) clF -= pa.split.cl; if (bk.diff) clR -= pa.diff.cl; } }
    const dfF = clF * qd, dfR = clR * qd; // downforce (para baixo)
    fl.y -= dfF + dfR;
    const Fa = t5.copy(fl).applyQuaternion(this.quat);
    F.add(Fa);
    // torque aerodinâmico (downforce nos eixos): x_front=+a, x_rear=-(WB-a)
    const Tl = t6.set(0, 0, 0);
    // momento de arfagem: força para baixo na frente (x=+a) gera giro nariz-para-baixo
    // F=(0,-dfF,0) em r=(a,0,0): torque = r x F = (0,0, a*(-dfF)) ; traseira r=(-(WB-a),0,0): (0,0,(WB-a)*dfR)
    Tl.set(0, 0, -s.a * dfF + (s.WB - s.a) * dfR);
    T.add(Tl.applyQuaternion(this.quat));
    if (s.bike) this.riderBalance(T, dt);
    // nitro/empuxo direto já está no motor
    this.vel.addScaledVector(F, dt / M);
    // dinâmica angular
    const Tloc = t6.copy(T).applyQuaternion(q);
    const wl = t7.copy(this.w).applyQuaternion(q);
    const Iw = (this._Iw || (this._Iw = V())).set(s.I.x * wl.x, s.I.y * wl.y, s.I.z * wl.z);
    const gyro = (this._gy || (this._gy = V())).copy(wl).cross(Iw);
    Tloc.sub(gyro);
    Tloc.set(Tloc.x * this.Iinv.x, Tloc.y * this.Iinv.y, Tloc.z * this.Iinv.z).applyQuaternion(this.quat);
    this.w.addScaledVector(Tloc, dt);
    { const wl = this.w.length(); if (wl > 32) this.w.multiplyScalar(32 / wl); const vl = this.vel.length(); if (vl > 110) this.vel.multiplyScalar(110 / vl); }
    // atrito de pivô/estacionado: segura o carro em pouca velocidade
    this.holdAtRest(dt);
    this.pos.addScaledVector(this.vel, dt);
    // quaternion
    const wq = (this._wq || (this._wq = new THREE.Quaternion())).set(this.w.x * dt * 0.5, this.w.y * dt * 0.5, this.w.z * dt * 0.5, 0).multiply(this.quat);
    this.quat.set(this.quat.x + wq.x, this.quat.y + wq.y, this.quat.z + wq.z, this.quat.w + wq.w).normalize();
  }

  // Piloto virtual da moto: mantém o ângulo de inclinação em equilíbrio com a curva (a = v·ω) e segura a moto parada.
  riderBalance(T, dt) {
    const s = this.spec, ax = this.ax, ay = this.ay, az = this.az;
    const hl = Math.hypot(ax.x, ax.z) || 1, hx = ax.x / hl, hz = ax.z / hl;
    const rx = az.x, rz = az.z, rl = Math.hypot(rx, rz) || 1;
    const lean = Math.atan2((ay.x * rx + ay.z * rz) / rl, ay.y);          // + = inclinada para a direita
    const roll = this.w.x * hx + this.w.z * hz;   // velocidade de rolagem em torno do eixo longitudinal
    if (this.fallen) return;
    if (Math.abs(lean) > 1.12 || (ay.y < 0.25)) { this.fallen = true; this.events.push({ type: 'hit', v: 8, p: this.pos.clone() }); return; }
    const v = this.fwdSpeed, M = s.mass, h = s.cgH, g = 9.81;
    const om = -this.w.y;                                                  // taxa de curva para a direita
    let tgt = Math.atan((v * om) / g);
    const sp = Math.abs(v), slow = 1 - clamp(sp / 2.5, 0, 1);              // parada: pé no chão
    tgt = tgt * (1 - slow);
    tgt = clamp(tgt, -0.95, 0.95);
    const ref = this.wh[0].contact || this.wh[2].contact;
    const Kp = 6.0 * M * g * h * (1 + 1.0 * slow), Kd = 1.7 * Math.sqrt(Kp * (s.I.x + M * h * h));
    let tau = Kp * (tgt - lean) - Kd * roll;
    const lim = 3.5 * M * g * h; tau = clamp(tau, -lim, lim);
    if (!ref) tau *= 0.15;
    // eixo longitudinal horizontal (mundo)
    T.x += hx * tau; T.z += hz * tau;
    this.lean = lean;
  }

  holdAtRest(dt) {
    const sp = this.vel.length();
    const nc = this.wh.reduce((n, h) => n + (h.contact ? 1 : 0), 0);
    if (nc >= 3 && sp < 0.35 && this.pedalThr < 0.04 && this.Tc * Math.abs(this.gTot) < 400) {
      const f = this.in.hand > 0.1 || this.pedalBrk > 0.1 ? 0.8 : 0.93;
      this.vel.multiplyScalar(f);
      this.w.multiplyScalar(0.8);
      if (sp < 0.03) { this.vel.set(0, 0, 0); }
    }
  }

  // ---------- colisões ----------
  collisions(dt) {
    const s = this.spec, world = this.world;
    const n = s.hull.length;
    if (!this._hp) this._hp = Array.from({ length: n }, () => V());
    for (let i = 0; i < n; i++) this.toWorld(s.hull[i], this._hp[i]);
    const bk = this.dmg.broken, ht = s.hullTag;
    // chão: teto de altura do terreno sob o carro (5 amostras); pontos bem acima disso nem consultam o terreno
    let gmax = world.heightAt(this.pos.x, this.pos.z);
    { const hl = s.L * 0.5, hwid = s.W * 0.5, ax = this.ax, az = this.az; for (const [dx, dz] of [[hl, hwid], [hl, -hwid], [-hl, hwid], [-hl, -hwid]]) { const hh = world.heightAt(this.pos.x + ax.x * dx + az.x * dz, this.pos.z + ax.z * dx + az.z * dz); if (hh > gmax) gmax = hh; } gmax += 0.25; }
    for (let i = 0; i < n; i++) {
      if (ht && ht[i] && bk[ht[i]]) continue;
      const p = this._hp[i];
      if (p.y > gmax) continue;
      const h = world.heightAt(p.x, p.z);
      if (p.y < h) {
        world.normalAt(p.x, p.z, t2);
        this.contact(p, t2, h - p.y, 0.5, 0.08, 0);
      }
    }
    // obstáculos estáticos
    const R = s.L * 0.55 + 1;
    const obs = world.queryStatic(this.pos.x, this.pos.z, R, this.obs);
    for (let k = 0; k < obs.length; k++) {
      const o = obs[k];
      for (let i = 0; i < n; i++) {
        const p = this._hp[i];
        if (this.pointVsObs(p, o)) this.contact(p, this.cn, this.cpen, 0.4, 0.15, 1);
      }
      if (o.t === 0) this.boxCornersVsCar(o);
      else this.roundVsCar(o);
    }
    // limites do mapa
    world.clampBounds(this);
  }

  pointVsObs(p, o) {
    const n = this.cn || (this.cn = V());
    if (o.t === 0) {
      const dx = p.x - o.cx, dy = p.y - o.cy, dz = p.z - o.cz;
      const lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c;
      const px = o.hx - Math.abs(lx), pz = o.hz - Math.abs(lz), py = o.hy - Math.abs(dy);
      if (px <= 0 || pz <= 0 || py <= 0) return false;
      if (py < px && py < pz) { n.set(0, Math.sign(dy) || 1, 0); this.cpen = py; }
      else if (px < pz) { const sg = Math.sign(lx) || 1; n.set(o.c * sg, 0, o.s * sg); this.cpen = px; }
      else { const sg = Math.sign(lz) || 1; n.set(-o.s * sg, 0, o.c * sg); this.cpen = pz; }
      return true;
    }
    if (o.t === 1) {
      if (p.y < o.y0 || p.y > o.y1) return false;
      const dx = p.x - o.cx, dz = p.z - o.cz, d = Math.hypot(dx, dz);
      if (d >= o.r) return false;
      const pr = o.r - d, pt = o.y1 - p.y;
      if (pt < pr) { n.set(0, 1, 0); this.cpen = pt; }
      else { if (d < 1e-4) n.set(1, 0, 0); else n.set(dx / d, 0, dz / d); this.cpen = pr; }
      return true;
    }
    const dx = p.x - o.cx, dy = p.y - o.cy, dz = p.z - o.cz, d = Math.hypot(dx, dy, dz);
    if (d >= o.r) return false;
    if (d < 1e-4) n.set(0, 1, 0); else n.set(dx / d, dy / d, dz / d);
    this.cpen = o.r - d;
    return true;
  }

  // pontos do obstáculo (cantos de caixa) dentro do carro
  boxCornersVsCar(o) {
    const q = this._qi(this.quat);
    for (let ix = -1; ix <= 1; ix += 2) for (let iy = -1; iy <= 1; iy += 2) for (let iz = -1; iz <= 1; iz += 2) {
      const lx = ix * o.hx, lz = iz * o.hz;
      const wx = o.cx + lx * o.c - lz * o.s, wz = o.cz + lx * o.s + lz * o.c, wy = o.cy + iy * o.hy;
      t5.set(wx, wy, wz).sub(this.pos).applyQuaternion(q);
      for (const b of [this.spec.boxLow, this.spec.boxCab]) {
        const dx = t5.x - b.c.x, dy = t5.y - b.c.y, dz = t5.z - b.c.z;
        const px = b.h.x - Math.abs(dx), py = b.h.y - Math.abs(dy), pz = b.h.z - Math.abs(dz);
        if (px > 0 && py > 0 && pz > 0) {
          // a normal (do obstáculo p/ o carro) é o oposto da saída mais curta do ponto
          if (px <= py && px <= pz) t6.set(-Math.sign(dx), 0, 0);
          else if (pz <= py) t6.set(0, 0, -Math.sign(dz));
          else t6.set(0, -Math.sign(dy), 0);
          const pen = Math.min(px, py, pz);
          t6.applyQuaternion(this.quat);
          t3.set(wx, wy, wz);
          this.contact(t3, t6, pen, 0.4, 0.12, 1);
          return;
        }
      }
    }
  }

  roundVsCar(o) {
    // cilindro vertical (aproximado por esfera à altura útil) ou esfera
    const cy = o.t === 1 ? clamp(this.pos.y, o.y0, o.y1) : o.cy;
    const q = this._qi(this.quat);
    t5.set(o.cx, cy, o.cz).sub(this.pos).applyQuaternion(q);
    for (const b of [this.spec.boxLow, this.spec.boxCab]) {
      const cx = clamp(t5.x, b.c.x - b.h.x, b.c.x + b.h.x), cyy = clamp(t5.y, b.c.y - b.h.y, b.c.y + b.h.y), cz = clamp(t5.z, b.c.z - b.h.z, b.c.z + b.h.z);
      let dx = t5.x - cx, dy = t5.y - cyy, dz = t5.z - cz;
      if (o.t === 1) dy = 0;
      const d = Math.hypot(dx, dy, dz);
      if (d < o.r) {
        if (d < 1e-4) { dx = 1; dy = 0; dz = 0; }
        t6.set(-dx, -dy, -dz).normalize().applyQuaternion(this.quat); // obstáculo -> carro
        t3.set(cx, cyy, cz).applyQuaternion(this.quat).add(this.pos);
        this.contact(t3, t6, o.r - d, 0.4, 0.2, 1);
        return;
      }
    }
  }

  // impulso de contato (obstáculo estático). n aponta do obstáculo para o carro
  contact(p0, n0, pen, mu, e, kind) {
    const M = this.spec.mass;
    this._cP = this._cP || V(); this._cN = this._cN || V();
    const p = this._cP.copy(p0), n = this._cN.copy(n0);
    const r = t1.copy(p).sub(this.pos);
    const vrel = t2.copy(this.w).cross(r).add(this.vel);
    const vn = vrel.dot(n);
    if (vn < 0) {
      const rn = t3.copy(r).cross(n);
      const iw = this.invIworld(rn, t4);
      const kN = 1 / M + t5.copy(iw).cross(r).dot(n);
      const ee = vn > -1.2 ? 0 : e;
      const j = Math.min(-(1 + ee) * vn / kN, M * 45);
      this.vel.addScaledVector(n, j / M);
      t6.copy(r).cross(t7.copy(n).multiplyScalar(j));
      this.w.add(this.invIworld(t6, t4));
      // atrito
      const vt = t6.copy(vrel).addScaledVector(n, -vn);
      const vtl = vt.length();
      if (vtl > 1e-4) {
        vt.divideScalar(vtl);
        const rt = t7.copy(r).cross(vt);
        const iw2 = this.invIworld(rt, t4);
        const kT = 1 / M + t5.copy(iw2).cross(r).dot(vt);
        let jt = -vtl / kT;
        jt = clamp(jt, -mu * j, mu * j);
        this.vel.addScaledVector(vt, jt / M);
        t7.copy(r).cross(t5.copy(vt).multiplyScalar(jt));
        this.w.add(this.invIworld(t7, t4));
      }
      if (kind === 1 && -vn > 1.0) this.registerImpact(p, n, -vn);
      else if (kind === 0 && -vn > 2.5) { this.events.push({ type: 'scrape', v: -vn, p: p.clone() }); if (-vn > 4.5) this.registerImpact(p, n, (-vn - 2.5) * 0.7); }
    }
    // correção de posição
    if (pen > 0) this.pos.addScaledVector(n, Math.min(pen, 0.25) * 0.28);
  }

  registerImpact(p, n, v) {
    // converte para coordenadas locais do carro
    const q = this._qi(this.quat);
    const lp = V().copy(p).sub(this.pos).applyQuaternion(q);
    const ln = V().copy(n).applyQuaternion(q);
    this.impacts.push({ p: lp, n: ln, v });
    { // peças externas quebram: a mais próxima do ponto de impacto
      const an = this.spec.anchors; if (an) { const thr = { wing: 5, split: 5, diff: 6, skirt: 5, roof: 6, spare: 6, bull: 13 };
        let bt = null, bd = 0.55; for (const k in an) { if (this.dmg.broken[k]) continue; for (const q of an[k]) { const d = q.distanceTo(lp); if (d < bd) { bd = d; bt = k; } } }
        if (bt && v > thr[bt]) { this.dmg.broken[bt] = true; this.brokenVer++; this.events.push({ type: 'break', part: bt, p: p.clone(), v }); } } }
    if (v > 12) this.airbag = true;
    this.events.push({ type: 'hit', v, p: p.clone() });
    // dano mecânico
    const s = this.spec;
    const front = lp.x > s.a + s.car.fo - 1.4;
    const d = Math.pow(Math.max(0, v - 4), 1.3) * 0.0105;
    this.dmg.body = Math.min(1, this.dmg.body + Math.max(0, v - 2) * 0.012);
    // batida forte: a suspensão dianteira/traseira empena (rodas desalinhadas)
    if (v > 9) { const fr = lp.x > 0 ? [0, 1] : [2, 3]; for (const i of fr) this.dmg.wheel[i] = Math.min(1, this.dmg.wheel[i] + (v - 8) * 0.012 * (0.5 + Math.random())); }
    if (front) { this.dmg.engine = Math.min(1, this.dmg.engine + d * 0.9); this.dmg.rad = Math.min(1, this.dmg.rad + d * 1.4); }
    for (let i = 0; i < 4; i++) {
      const w = s.wheels[i];
      const dx = lp.x - w.x, dz = lp.z - w.z;
      if (Math.hypot(dx, dz) < w.R + 0.35 && v > 4) this.dmg.wheel[i] = Math.min(1, this.dmg.wheel[i] + (v - 3) * 0.03);
    }
  }

  // colisão com uma esfera dinâmica (props). Devolve true se houve contato. vel é alterado.
  sphereImpact(c, vel, r, m, e = 0.35) {
    const q = this._qi(this.quat);
    t5.copy(c).sub(this.pos).applyQuaternion(q);
    for (const b of [this.spec.boxLow, this.spec.boxCab]) {
      const cx = clamp(t5.x, b.c.x - b.h.x, b.c.x + b.h.x), cy = clamp(t5.y, b.c.y - b.h.y, b.c.y + b.h.y), cz = clamp(t5.z, b.c.z - b.h.z, b.c.z + b.h.z);
      const dx = t5.x - cx, dy = t5.y - cy, dz = t5.z - cz;
      const d = Math.hypot(dx, dy, dz);
      if (d >= r) continue;
      const nloc = d < 1e-4 ? t6.set(0, 1, 0) : t6.set(dx, dy, dz).divideScalar(d);
      const n = V().copy(nloc).applyQuaternion(this.quat); // carro -> prop
      const pc = V(cx, cy, cz).applyQuaternion(this.quat).add(this.pos);
      const rr = t1.copy(pc).sub(this.pos);
      const vcar = t2.copy(this.w).cross(rr).add(this.vel);
      const vrel = t3.copy(vel).sub(vcar);
      const vn = vrel.dot(n);
      c.addScaledVector(n, r - d);
      if (vn < 0) {
        const rn = t4.copy(rr).cross(n);
        const iw = this.invIworld(rn, t7);
        const kN = 1 / this.spec.mass + t5.copy(iw).cross(rr).dot(n) + 1 / m;
        const j = -(1 + e) * vn / kN;
        vel.addScaledVector(n, j / m);
        this.vel.addScaledVector(n, -j / this.spec.mass);
        t6.copy(rr).cross(t4.copy(n).multiplyScalar(-j));
        this.w.add(this.invIworld(t6, t7));
        if (-vn > 3 && m > 10) { const nn = n.clone().negate(); this.registerImpact(pc, nn, -vn * 0.45); }
        return true;
      }
      return true;
    }
    return false;
  }

  // ---------- temperatura ----------
  thermal(dt) {
    { const spd = Math.abs(this.fwdSpeed); this.brakeHeat += this.pedalBrk * spd * dt * 0.012; this.brakeHeat -= this.brakeHeat * dt * 0.05 * (1 + spd / 15); this.brakeHeat = clamp(this.brakeHeat, 0, 1.3); }
    const E = this.E;
    const P = Math.max(0, this.Te * this.we / 1000) * (E.kind === 'ev' ? 0.12 : 0.62) + (E.kind === 'ev' ? 0.2 : 1.2) * (this.we / Math.max(E.red * Math.PI / 30, 1));
    const air = Math.abs(this.fwdSpeed);
    const rad = (1 - this.dmg.rad * 0.9);
    const th = sstep(78, 96, this.temp);
    const cool = 0.34 * (this.spec.coolMult || 1) * (this.temp - 28) * (1 + air / 14) * rad * (0.15 + 0.85 * th) * (E.kind === 'ev' ? 1.6 : 1);
    this.temp += (P - cool) / 75 * dt;
    this.temp = clamp(this.temp, 20, 160);
  }
}

// ------------------------------------------------------------
//  estimativa de desempenho em linha reta (para o painel da garagem)
// ------------------------------------------------------------
export function quickPerf(spec) {
  const E = spec.eng, gi = spec.gearInfo, M = spec.mass;
  const Rw = (spec.wheels[0].R + spec.wheels[2].R) / 2;
  const driven = spec.wheels.filter(w => w.driven);
  const Rd = driven.reduce((a, w) => a + w.R, 0) / driven.length;
  const dl = spec.driveline;
  const Jw = spec.wheels.reduce((a, w) => a + w.Iw, 0);
  let v = 0, t = 0, x = 0, gear = 1, fill = 0;
  const out = { t100: null, t200: null, q: null, top: 0, v400: 0, rpmAtTop: 0, gearTop: 1 };
  const dt = 0.01;
  const mu = spec.wheels[2].comp.mu;
  const dist = [];
  for (let k = 0; k < 6000; k++) {
    // escolhe a melhor marcha
    let best = 0, bg = gear, brpm = 0;
    const n = gi.n;
    for (let g = 1; g <= n; g++) {
      const r = gi.type === 'cvt' ? (g === 1 ? gi.ratios[0] : gi.ratios[1]) : gi.ratios[g - 1];
      let rpm = Math.abs(v) / Rd * r * 30 / Math.PI;
      if (gi.type === 'cvt') {
        const rr = clamp((E.rpmP * 0.95 * Math.PI / 30) / Math.max(v / Rd, 0.01), gi.ratios[1], gi.ratios[0]);
        rpm = Math.abs(v) / Rd * rr * 30 / Math.PI;
        const T = engTorqueWOT(E, Math.max(rpm, E.idle * 1.6), 1);
        const F = T * rr * dl.eta / Rd;
        if (F > best) { best = F; bg = 1; brpm = Math.max(rpm, E.idle * 1.6); }
        break;
      }
      if (rpm > E.red) continue;
      const rpm2 = Math.max(rpm, E.idle * 1.5 + (v < 3 && g === 1 ? E.rpmP * 0.3 : 0));
      const T = engTorqueWOT(E, rpm2, 1);
      const F = T * r * dl.eta / Rd;
      if (F > best) { best = F; bg = g; brpm = rpm2; }
    }
    gear = bg;
    const q = 0.5 * RHO * v * v;
    const drag = q * spec.cdA + 0.011 * M * G;
    const Fdown = q * (spec.clF + spec.clR);
    // limite de tração (distribuição de carga com transferência)
    const ltr = (Math.min(best, mu * M * G * 0.8) / (M * G)) * spec.cgH / spec.WB;   // transferência de carga longitudinal
    const driveShare = dl.layout === 'awd' ? 1 : dl.layout === 'rwd' ? clamp(1 - spec.distF + ltr, 0.3, 0.9) : clamp(spec.distF - ltr, 0.25, 0.9);
    const Ftrac = mu * (M * G + Fdown) * driveShare * 0.92;
    const Fd = Math.min(best, Ftrac);
    const Jeq = (E.J * Math.pow(gi.ratios[Math.max(0, gear - 1)] || 1, 2) * 0.9 + Jw) / (Rw * Rw);
    const a = (Fd - drag) / (M + Jeq);
    if (a <= 0.01 && v > 10) { out.top = v; out.rpmAtTop = brpm; out.gearTop = gear; break; }
    v += a * dt; t += dt; x += v * dt;
    if (out.t100 == null && v >= 100 / 3.6) out.t100 = t;
    if (out.t200 == null && v >= 200 / 3.6) out.t200 = t;
    if (out.q == null && x >= 402.3) { out.q = t; out.v400 = v; }
    out.top = v;
  }
  return out;
}


// ---------------------------------------------------------------
//  Colisão veículo x veículo (corpo rígido dos dois lados)
// ---------------------------------------------------------------
const _l = V(), _n = V(), _rA = V(), _rB = V(), _vr = V(), _c1 = V(), _c2 = V(), _c3 = V(), _c4 = V(), _iA = V(), _iB = V(), _j = V();
function pointInBoxes(Q, p, out) {
  _l.copy(p).sub(Q.pos).applyQuaternion(Q._qi(Q.quat));
  for (const b of [Q.spec.boxLow, Q.spec.boxCab]) {
    const dx = _l.x - b.c.x, dy = _l.y - b.c.y, dz = _l.z - b.c.z;
    const px = b.h.x - Math.abs(dx), py = b.h.y - Math.abs(dy), pz = b.h.z - Math.abs(dz);
    if (px > 0 && py > 0 && pz > 0) {
      if (px <= py && px <= pz) out.set(Math.sign(dx) || 1, 0, 0); else if (pz <= py) out.set(0, 0, Math.sign(dz) || 1); else out.set(0, Math.sign(dy) || 1, 0);
      out.applyQuaternion(Q.quat);
      return Math.min(px, py, pz);
    }
  }
  return 0;
}
function twoBody(A, B, p, n, pen) {   // n aponta de B para A
  const mA = A.spec.mass, mB = B.spec.mass;
  _rA.copy(p).sub(A.pos); _rB.copy(p).sub(B.pos);
  _vr.copy(A.w).cross(_rA).add(A.vel).sub(_c1.copy(B.w).cross(_rB).add(B.vel));
  const vn = _vr.dot(n);
  if (vn < 0) {
    A.invIworld(_c2.copy(_rA).cross(n), _iA); B.invIworld(_c3.copy(_rB).cross(n), _iB);
    const kN = 1 / mA + 1 / mB + _c4.copy(_iA).cross(_rA).dot(n) + _c4.copy(_iB).cross(_rB).dot(n);
    const j = Math.min(-(1.12) * vn / kN, Math.min(mA, mB) * 40);
    _j.copy(n).multiplyScalar(j);
    A.vel.addScaledVector(_j, 1 / mA); B.vel.addScaledVector(_j, -1 / mB);
    A.w.add(A.invIworld(_c2.copy(_rA).cross(_j), _iA)); B.w.sub(B.invIworld(_c3.copy(_rB).cross(_j), _iB));
    // atrito tangencial leve
    const vt = _c1.copy(_vr).addScaledVector(n, -vn), vtl = vt.length();
    if (vtl > 1e-3) { vt.divideScalar(vtl); const jt = Math.min(vtl / (1 / mA + 1 / mB), 0.35 * j); A.vel.addScaledVector(vt, -jt / mA); B.vel.addScaledVector(vt, jt / mB); }
    if (-vn > 1.2) { A.registerImpact(p, n, -vn * 0.7); _c1.copy(n).negate(); B.registerImpact(p, _c1, -vn * 0.7); }
  }
  const c = Math.min(pen, 0.2);
  A.pos.addScaledVector(n, c * 0.5 * mB / (mA + mB) * 1.2); B.pos.addScaledVector(n, -c * 0.5 * mA / (mA + mB) * 1.2);
}
export function vehicleCollide(A, B) {
  if (A.pos.distanceToSquared(B.pos) > 49) return;
  for (const [P, Q] of [[A, B], [B, A]]) {
    const hp = P._hp; if (!hp) continue;
    const ht = P.spec.hullTag, bk = P.dmg.broken;
    for (let i = 0; i < hp.length; i++) {
      if (ht && ht[i] && bk[ht[i]]) continue;
      const pen = pointInBoxes(Q, hp[i], _n);
      if (pen > 0) { if (P === A) twoBody(A, B, hp[i], _n, pen); else twoBody(B, A, hp[i], _n, pen); }
    }
  }
}
