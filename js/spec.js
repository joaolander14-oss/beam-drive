// Config do jogador -> especificação física completa do carro
import * as THREE from 'three';
import { applyFx } from './catalog.js';
import { CARS, ENGINES, GEARBOXES, COMPOUNDS, BRAKES, WHEEL_STYLES, DIFFS, CENTER_DIFFS, tireDims, G, clamp, lerp } from './data.js';

export const WING_STYLES = {
  none: { name: 'Sem aerofólio', cl: 0, cd: 0, mass: 0 },
  lip: { name: 'Lip discreto', cl: 0.04, cd: 0.004, mass: 2 },
  duck: { name: 'Ducktail', cl: 0.10, cd: 0.012, mass: 4 },
  gt: { name: 'Asa GT', cl: 0.34, cd: 0.045, mass: 9 },
  big: { name: 'Asa grande de corrida', cl: 0.70, cd: 0.11, mass: 14 },
};
export const SPLITTERS = {
  none: { name: 'Para-choque original', cl: 0, cd: 0, mass: 0 },
  lip: { name: 'Spoiler dianteiro', cl: 0.04, cd: 0.004, mass: 2 },
  split: { name: 'Splitter', cl: 0.12, cd: 0.012, mass: 5 },
  race: { name: 'Splitter de corrida', cl: 0.26, cd: 0.030, mass: 8 },
};
const DRIVE_MASS = { fwd: 0, rwd: 15, awd: 75 };

export function defaultCfg(id) {
  const c = CARS[id];
  const e = ENGINES[c.eng];
  const gb = GEARBOXES[c.gb];
  const cf = c.cf != null ? c.cf : 0.4;
  return {
    car: id,
    eng: c.eng, boost: 1.0, tune: 0, fly: 1.0,
    gb: c.gb, fin: c.fin, lowRange: false,
    drive: c.drive,
    dif: c.dif || 'open', dir: c.dir || 'open', dc: c.dc || (c.drive === 'awd' ? 'visc' : 'open'), cf,
    tf: c.tf.slice(), tr: c.tr.slice(), compF: c.comp, compR: c.comp, pF: 2.2, pR: 2.2, spF: 0, spR: 0,
    wheel: c.wheel, rimColor: c.rimColor,
    kF: c.spr[0], kR: c.spr[1], bF: c.arb[0], bR: c.arb[1], zb: c.damp[0], zr: c.damp[1], rh: 0,
    camF: c.camber[0], camR: c.camber[1], toeF: c.toe[0], toeR: c.toe[1],
    brk: 'stock', bias: c.brk.bias, ack: c.ack,
    splitter: 'none', wing: c.spoiler || 'none', wingAng: 0.5, diffuser: false,
    ballast: 0, ballastPos: 0, lighten: 0,
    paint: c.color, finish: 'metal', widebody: false, scoop: !!c.shape.scoop, lightbar: false, tint: 0.5,
    nitro: false, parts: {}, stripeColor: '#f2f2f2',
    abs: true, tc: true, esc: true, steerAssist: 1, trans: 'auto',
  };
}

export function wheelMass(w, a, r, style) {
  const d = tireDims(w, a, r);
  const tire = 0.04 * w * Math.pow(d.R / 0.33, 2);
  const st = WHEEL_STYLES[style] || WHEEL_STYLES.five;
  const rim = r * 0.5 * (st.kind === 'steel' ? 1.25 : st.kind === 'mesh' ? 0.9 : 1.0) * (0.8 + 0.2 * w / 225);
  return { tire, rim, total: tire + rim, d };
}

export function buildSpec(cfg) {
  const car = CARS[cfg.car];
  const eng = ENGINES[cfg.eng], gb = GEARBOXES[cfg.gb];
  const sEng = ENGINES[car.eng], sGb = GEARBOXES[car.gb];
  const sp = car.shape;
  const tdF = tireDims(...cfg.tf), tdR = tireDims(...cfg.tr);
  const sdF = tireDims(...car.tf), sdR = tireDims(...car.tr);
  const wmF = wheelMass(...cfg.tf, cfg.wheel), wmR = wheelMass(...cfg.tr, cfg.wheel);
  const smF = wheelMass(...car.tf, car.wheel), smR = wheelMass(...car.tr, car.wheel);
  const WB = car.WB;
  const brk = BRAKES[cfg.brk];
  const sBrk = BRAKES.stock;
  const fx = applyFx(cfg);

  // ---------- massa e centro de gravidade ----------
  const a0 = WB * (1 - car.distF);               // CG -> eixo dianteiro (m)
  let M0 = car.mass;
  const comps = [];                                // [massa, x a partir do eixo dianteiro]
  const add = (m, x) => { comps.push([m, x]); };
  add(M0, a0);
  add((eng.mass + (eng.battery || 0)) - (sEng.mass + (sEng.battery || 0)), eng.kind === 'ev' ? WB * 0.5 : car.engX);
  add(gb.mass - sGb.mass, car.engX + 0.55);
  add(DRIVE_MASS[cfg.drive] - DRIVE_MASS[car.drive], WB * 0.55);
  add(2 * (wmF.total - smF.total), 0); add(2 * (wmR.total - smR.total), WB);
  add(brk.mass - sBrk.mass, WB * 0.5);
  const wing = WING_STYLES[cfg.wing], spl = SPLITTERS[cfg.splitter];
  add(wing.mass * (cfg.wing === (car.spoiler || 'none') ? 0 : 1), WB + 0.8);
  add(spl.mass, -0.7);
  add(cfg.diffuser ? 6 : 0, WB + 0.7);
  add(cfg.widebody ? 24 : 0, WB * 0.5);
  add(cfg.lightbar ? 10 : 0, WB * 0.3);
  add(cfg.ballast, WB * 0.5 + cfg.ballastPos * (WB * 0.5 + 0.7));
  add(-cfg.lighten, WB * 0.5);
  add(fx.mass, WB * 0.5);
  add(75, car.drvX);                               // piloto
  let M = 0, mx = 0;
  for (const [m, x] of comps) { M += m; mx += m * x; }
  const a = mx / M;                                // CG -> eixo dianteiro
  const distF = 1 - a / WB;

  const dR = (tdF.R + tdR.R) / 2, dR0 = (sdF.R + sdR.R) / 2;
  const rhm = cfg.rh / 1000;
  const cgH = car.cgH + rhm + (dR - dR0) + (cfg.ballast > 0 ? -0.0001 * cfg.ballast : 0) + (cfg.lighten > 0 ? 0.00005 * cfg.lighten : 0);
  const Lm = car.L, W = car.W;
  const k = 0.9;
  const I = {
    x: k * M / 12 * (W * W + car.H * car.H),   // rolagem (eixo longitudinal)
    y: k * M / 12 * (Lm * Lm + W * W) * 1.05,   // guinada
    z: k * M / 12 * (Lm * Lm + car.H * car.H),  // arfagem
  };

  // ---------- rodas e suspensão ----------
  const wheels = [];
  const trF = car.tF + 2 * cfg.spF / 1000, trR = car.tR + 2 * cfg.spR / 1000;
  const staticF = M * G * (1 - a / WB) / 2, staticR = M * G * (a / WB) / 2;
  const mk = (idx, axle, side) => {
    const td = axle === 0 ? tdF : tdR, wm = axle === 0 ? wmF : wmR;
    const x = axle === 0 ? a : -(WB - a);
    const z = side * (axle === 0 ? trF : trR) / 2;
    const k = (axle === 0 ? cfg.kF : cfg.kR) * 1000 * fx.spring;
    const Fst = axle === 0 ? staticF : staticR;
    const mc = Fst / G;
    const ccrit = 2 * Math.sqrt(k * mc);
    const [tb, td2] = car.trav;
    const sRest = 0.30, sMin = sRest - tb, sMax = sRest + td2;
    const yWc = td.R - cgH;
    const I_w = 0.8 * wm.tire * td.R * td.R + 0.5 * wm.rim * Math.pow(td.R * 0.72, 2) + 0.12;
    return {
      idx, axle, side, x, y: yWc, z, R: td.R, width: td.w, rim: td.rim, Iw: I_w, mass: wm.total,
      mountL: new THREE.Vector3(x, yWc + sRest, z),
      k, sRest, sMin, sMax, sFree: sRest + Fst / k, Fst,
      cb: cfg.zb * ccrit * fx.damp, cr: cfg.zr * ccrit * fx.damp,
      arb: (axle === 0 ? cfg.bF : cfg.bR) * 1000 * fx.arb,
      camber: (axle === 0 ? cfg.camF : cfg.camR) * Math.PI / 180,
      toe: (axle === 0 ? cfg.toeF : cfg.toeR) * Math.PI / 180 * (side > 0 ? 1 : -1),
      comp: (() => { const b = COMPOUNDS[fx.comp || (axle === 0 ? cfg.compF : cfg.compR)]; return Object.assign({}, b, { mu: b.mu * fx.mu, crr: b.crr + fx.crr }); })(),
      press: axle === 0 ? cfg.pF : cfg.pR,
      tw: axle === 0 ? cfg.tf[0] : cfg.tr[0],
      driven: cfg.drive === 'awd' || (cfg.drive === 'fwd' && axle === 0) || (cfg.drive === 'rwd' && axle === 1),
      Fz0: 3600 * (td.w * 1000 / 225) * Math.sqrt(td.R / 0.32),
    };
  };
  wheels.push(mk(0, 0, -1), mk(1, 0, 1), mk(2, 1, -1), mk(3, 1, 1));

  // freios
  const Tbtot = M * G * dR * brk.k * fx.brk;
  wheels[0].brake = wheels[1].brake = Tbtot * cfg.bias / 2;
  wheels[2].brake = wheels[3].brake = Tbtot * (1 - cfg.bias) / 2;

  // ---------- aerodinâmica ----------
  let cdA = car.cd * car.A;
  let clF = car.dfF, clR = car.dfR;
  cdA += wing.cd * (0.6 + 0.8 * cfg.wingAng) + spl.cd + (cfg.diffuser ? 0.015 : 0) + (cfg.lightbar ? 0.03 : 0) + (cfg.scoop ? 0.004 : 0) + (cfg.widebody ? 0.015 : 0);
  clF += spl.cl;
  clR += wing.cl * (0.35 + 1.3 * cfg.wingAng) + (cfg.diffuser ? 0.10 : 0) - (cfg.wing === 'none' || cfg.wing === 'lip' ? 0 : 0);
  // ride height afeta arrasto
  cdA += fx.cdA; clF += fx.clF; clR += fx.clR;
  cdA = Math.max(0.2, cdA);
  cdA *= 1 + clamp(rhm * 0.4, -0.04, 0.08);

  // ---------- trem de força ----------
  const isEV = eng.kind === 'ev';
  const lowM = cfg.lowRange ? 2.6 : 1;
  const ratios = gb.r.map(r => r * cfg.fin * lowM);
  const gear = {
    ratios, rev: gb.rev * cfg.fin * lowM, type: gb.type, shiftTime: gb.shift * fx.shift, n: ratios.length,
  };
  const tuneT = [1, 1.05, 1.11, 1.18][cfg.tune] || 1;
  const tuneNA = eng.kind === 'turbo' || eng.kind === 'sc' || eng.kind === 'diesel' ? [1, 1.03, 1.06, 1.10][cfg.tune] : tuneT;
  const boostScale = eng.boost ? cfg.boost * [1, 1.12, 1.28, 1.5][cfg.tune] : 0;
  const dfD = DIFFS[cfg.dif], drD = DIFFS[cfg.dir], dcD = CENTER_DIFFS[cfg.dc];
  const driveline = {
    layout: cfg.drive, cf: cfg.drive === 'awd' ? cfg.cf : (cfg.drive === 'fwd' ? 1 : 0),
    difF: dfD, difR: drD, center: dcD, eta: Math.min(0.97, 0.92 + fx.eta),
  };
  const J = eng.J * cfg.fly * fx.J;

  const engine = {
    def: eng, kind: eng.kind, J, rpmT: eng.rpmT || 3000, rpmP: eng.rpmP || 5000, idle: eng.idle, red: eng.red + fx.red, curve: eng.curve, step: eng.step,
    bar: eng.boost ? eng.boost.bar : 0, boostLo: eng.boost ? eng.boost.lo : 0, boostHi: eng.boost ? eng.boost.hi : 0,
    boostScale: boostScale * fx.boost, torqueMult: tuneNA * fx.tq, clutchMult: fx.clutch, peakTq: eng.peakTq, fric: (eng.fric || 0.1) * fx.fric, regen: eng.regen || 0, cyl: eng.cyl,
    sc: eng.kind === 'sc', tqScaleTune: tuneT * fx.tq,
  };

  // ---------- caixas de colisão (em coordenadas locais com origem no CG) ----------
  const ox = -(a + car.fo - 0) ;  // deslocamento do modelo (nariz em x = a + fo) -> ver abaixo
  const noseX = a + car.fo;          // x local do nariz
  const meshOff = new THREE.Vector3(noseX, -car.cgH, 0); // modelo: x_modelo=0 no nariz, apontando para trás (-x local)
  const belt = (sp.belt[0] + sp.belt[1]) / 2;
  const clearance = 0.13 + Math.min(0, 0);
  const xr0 = sp.xc * Lm, xr1 = sp.xt * Lm;
  const hull = [];
  const pushBox = (x0, x1, y0, y1, zh, nx, ny, nz) => {
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      if (i > 0 && i < nx - 1 && j > 0 && j < ny - 1 && k > 0 && k < nz - 1) continue;
      const x = lerp(x0, x1, i / (nx - 1)), y = lerp(y0, y1, j / (ny - 1)), z = lerp(-zh, zh, k / (nz - 1));
      hull.push(new THREE.Vector3(noseX - x, y - car.cgH, z));
    }
  };
  const lowTop = Math.min(belt, 0.95);
  pushBox(0.02, Lm - 0.02, clearance, lowTop, W / 2 - 0.02, 7, 3, 3);
  pushBox(xr0 + 0.1, xr1 - 0.1, belt, car.H - 0.03, sp.roofW * W / 2 * 0.9, 3, 2, 3);
  // rodas (pontos extremos)
  for (const w of wheels) {
    for (const [dx, dz] of [[0, 1], [0.8, 0.5], [-0.8, 0.5]]) {
      hull.push(new THREE.Vector3(w.x + dx * w.R, w.y, w.z + w.side * (dz > 0.9 ? w.width / 2 + 0.03 : w.width / 2 * 0.2)));
    }
  }
  const boxLow = { c: new THREE.Vector3(noseX - Lm / 2, (clearance + lowTop) / 2 - car.cgH, 0), h: new THREE.Vector3(Lm / 2, (lowTop - clearance) / 2, W / 2) };
  const boxCab = { c: new THREE.Vector3(noseX - (xr0 + xr1) / 2, (belt + car.H) / 2 - car.cgH, 0), h: new THREE.Vector3((xr1 - xr0) / 2 * 0.85, (car.H - belt) / 2, sp.roofW * W / 2 * 0.9) };

  // posições para luzes e câmeras (locais, origem no CG)
  const driverEye = new THREE.Vector3(noseX - (sp.xc * Lm + 0.80 - 0.04), 0.46 * car.H + 0.50 - car.cgH, sp.beetle ? -0.34 : -0.37);

  const spec = {
    car, cfg, eng: engine, gearInfo: gear, driveline, wheels, mass: M, a, distF, cgH, I,
    cdA, cdAside: cdA * 2.6, clF, clR, WB, L: Lm, W, H: car.H,
    hull, boxLow, boxCab, noseX, meshOff, driverEye,
    steerMax: car.steer * fx.steer, coolMult: fx.cool, nitroS: fx.nitroS, fx, ack: cfg.ack, rcH: 0.07,
    abs: cfg.abs, tc: cfg.tc, esc: cfg.esc, steerAssist: cfg.steerAssist, trans: cfg.trans,
    isEV, tdF, tdR, clearance: clearance + rhm,
  };
  return spec;
}
