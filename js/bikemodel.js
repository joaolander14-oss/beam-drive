// ============================================================
//  Modelo 3D de moto (garfo telescópico com direção, balança traseira, motor, tanque, carenagem por estilo, piloto)
//  Mesma interface do CarModel usada pelo jogo: root, update, dentLocal, repair, setPaint, dispose, lampOut, swSpin.
// ============================================================
import * as THREE from 'three';

const V3 = THREE.Vector3;
const UP = new V3(0, 1, 0);
const _a = new V3(), _b = new V3(), _q = new THREE.Quaternion();

// parâmetros por estilo: assento (m), inclinação do tronco (rad), rake (rad), carenagem, tanque, escapamento
const STY = {
  sport:   { seat: 0.82, torso: 1.0, rake: 0.42, fair: 'full', tank: 1.0, ex: 'under', legs: 'tuck' },
  naked:   { seat: 0.81, torso: 0.45, rake: 0.44, fair: 'none', tank: 1.0, ex: 'side', legs: 'mid' },
  adv:     { seat: 0.88, torso: 0.28, rake: 0.46, fair: 'beak', tank: 1.1, ex: 'side', legs: 'up' },
  cruiser: { seat: 0.69, torso: 0.15, rake: 0.55, fair: 'none', tank: 0.9, ex: 'dual', legs: 'fwd' },
  tour:    { seat: 0.78, torso: 0.15, rake: 0.50, fair: 'tour', tank: 1.0, ex: 'dual', legs: 'fwd' },
  classic: { seat: 0.79, torso: 0.30, rake: 0.46, fair: 'none', tank: 1.0, ex: 'dual', legs: 'mid' },
  street:  { seat: 0.77, torso: 0.25, rake: 0.46, fair: 'none', tank: 0.7, ex: 'side', legs: 'mid' },
  scooter: { seat: 0.78, torso: 0.08, rake: 0.40, fair: 'scoot', tank: 0.0, ex: 'side', legs: 'fwd' },
  moto:    { seat: 0.92, torso: 0.50, rake: 0.44, fair: 'mx', tank: 0.9, ex: 'high', legs: 'up' },
  mini:    { seat: 0.72, torso: 0.25, rake: 0.46, fair: 'none', tank: 0.6, ex: 'side', legs: 'mid' },
  ev:      { seat: 0.80, torso: 0.40, rake: 0.44, fair: 'none', tank: 0.0, ex: 'none', legs: 'mid' },
};

export class BikeModel {
  constructor(spec, cfg) {
    this.spec = spec; this.cfg = cfg; this.car = spec.car; this.details = [];
    this.root = new THREE.Group();
    this.swSpin = new THREE.Object3D();
    this.build();
  }

  // cilindro entre dois pontos (coordenadas do grupo pai)
  tube(parent, p1, p2, r, mat, seg = 8) {
    const d = _a.copy(p2).sub(p1), L = d.length() || 1e-3;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, seg), mat);
    m.position.copy(p1).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(UP, d.normalize()); m.scale.y = L; m.castShadow = true;
    parent.add(m); return m;
  }
  box(parent, sx, sy, sz, x, y, z, mat, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = true; parent.add(m); return m; }
  ell(parent, sx, sy, sz, x, y, z, mat, rz = 0) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.z = rz; m.castShadow = true; parent.add(m); return m; }
  det(m) { this.details.push({ mesh: m, p0: m.position.clone(), r0: m.rotation.clone(), acc: 0 }); return m; }

  wheel(R, width, style, rimColor) {
    const g = new THREE.Group(), spin = new THREE.Group(); g.add(spin);
    const tr = Math.min(width * 0.5, R * 0.42);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(R - tr, tr, 10, 40), this.mTire); tire.scale.z = Math.max(0.6, (width / 2) / tr); tire.castShadow = true; spin.add(tire);
    const rimR = R - tr * 1.7;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.012, 6, 32), this.mRim); spin.add(rim);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, width * 0.7, 10), this.mRim); hub.rotation.x = Math.PI / 2; spin.add(hub);
    if (style === 'spoke') { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2, o = (i % 2 ? 1 : -1) * 0.012; const p1 = new V3(0.03 * Math.cos(a), 0.03 * Math.sin(a), o), p2 = new V3(rimR * Math.cos(a + 0.18), rimR * Math.sin(a + 0.18), -o); const t = this.tube(spin, p1, p2, 0.0035, this.mChrome, 4); t.castShadow = false; } }
    else { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + 0.3, p1 = new V3(0.03 * Math.cos(a), 0.03 * Math.sin(a), 0), p2 = new V3(rimR * Math.cos(a + 0.1), rimR * Math.sin(a + 0.1), 0); this.tube(spin, p1, p2, 0.02, this.mRim, 5); } }
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.55, R * 0.55, 0.006, 24), this.mDisc); disc.rotation.x = Math.PI / 2; disc.position.z = width * 0.32; spin.add(disc);
    const cal = this.box(g, 0.06, 0.1, 0.03, R * 0.12, R * 0.5, width * 0.36, this.mDark);
    return { group: g, spin };
  }

  build() {
    const { spec, cfg, car } = this, st = STY[car.bikeStyle] || STY.naked, WB = spec.WB, a = spec.a;
    const fx = a, rx = a - WB;                       // eixos (x a partir do CG)
    const Rf = spec.wheels[0].R, Rr = spec.wheels[2].R, wf = spec.wheels[0].width, wr = spec.wheels[2].width;
    this.fx = fx; this.rx = rx; this.Rf = Rf; this.Rr = Rr;
    const body = this.body = new THREE.Group(); body.position.y = -spec.cgH; this.root.add(body);
    // ---- materiais ----
    const paint = this.paintColor = new THREE.Color(cfg.paint);
    this.mPaint = new THREE.MeshPhysicalMaterial({ color: paint, roughness: 0.3, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.mDark = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.6, metalness: 0.5 });
    this.mEngine = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.5, metalness: 0.8 });
    this.mChrome = new THREE.MeshStandardMaterial({ color: 0xd8dade, roughness: 0.18, metalness: 1 });
    this.mTire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
    this.mRim = new THREE.MeshStandardMaterial({ color: cfg.rimColor || '#b8bcc4', roughness: 0.35, metalness: 0.8 });
    this.mDisc = new THREE.MeshStandardMaterial({ color: 0x9a9ea5, roughness: 0.4, metalness: 0.9 });
    this.mSeat = new THREE.MeshStandardMaterial({ color: 0x1b1b1e, roughness: 0.85 });
    this.mSuit = new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.75 });
    this.mSuit2 = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.paint).multiplyScalar(0.9), roughness: 0.6 });
    this.mHelm = new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.25, metalness: 0.2, clearcoat: 1 });
    this.mVisor = new THREE.MeshPhysicalMaterial({ color: 0x14181d, roughness: 0.05, metalness: 0.4, transparent: true, opacity: 0.85 });
    this.lensMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff2d0, emissiveIntensity: 0, roughness: 0.1 });
    this.tailMat = new THREE.MeshStandardMaterial({ color: 0x7a0a0a, emissive: 0xff1010, emissiveIntensity: 0.2, roughness: 0.3 });
    this.revMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 });
    const amber = () => new THREE.MeshStandardMaterial({ color: 0xffa000, emissive: 0xff9000, emissiveIntensity: 0, roughness: 0.3 });
    this.sigMat = [amber(), amber()];

    // ---- geometria do garfo ----
    const r = st.rake, u = new V3(-Math.sin(r), Math.cos(r), 0);
    const forkLen = Rf * (car.bikeStyle === 'moto' || car.bikeStyle === 'adv' ? 3.0 : car.bikeStyle === 'cruiser' ? 2.6 : 2.5);
    const headPos = new V3(fx, Rf, 0).addScaledVector(u, forkLen);
    this.forkLen = forkLen; this.u = u;
    const seatY = st.seat, wRear = new V3(rx, Rr, 0);
    const pivot = new V3(rx + WB * 0.30, Rr + (seatY - Rr) * 0.28, 0);
    this.pivot = pivot;

    // ---- rodas ----
    const style = car.bikeStyle === 'moto' || car.bikeStyle === 'adv' || car.bikeStyle === 'classic' || car.bikeStyle === 'cruiser' ? 'spoke' : 'cast';
    this.fw = this.wheel(Rf, wf, style, cfg.rimColor); this.rw = this.wheel(Rr, wr, style, cfg.rimColor);
    body.add(this.rw.group);

    // ---- conjunto dianteiro (direção) ----
    const head = this.head = new THREE.Group(); head.position.copy(headPos); head.rotation.z = r; body.add(head);
    const steer = this.steerG = new THREE.Group(); head.add(steer);
    for (const s of [-1, 1]) { const t = this.tube(steer, new V3(0, 0.05, s * 0.095), new V3(0, -forkLen, s * 0.095), 0.021, this.mChrome, 8); const lo = this.tube(steer, new V3(0, -forkLen * 0.55, s * 0.095), new V3(0, -forkLen, s * 0.095), 0.026, this.mDark, 8); }
    this.box(steer, 0.07, 0.04, 0.26, 0, -0.04, 0, this.mDark);                         // mesa do garfo
    const wheelHold = this.fwHold = new THREE.Group(); wheelHold.position.y = -forkLen; steer.add(wheelHold); wheelHold.add(this.fw.group);
    // guidão
    const hy = 0.10, hw = Math.min(0.46, car.W * 0.5);
    const bars = new THREE.Group(); bars.position.set(-0.03, hy, 0); steer.add(bars);
    const lowBars = car.bikeStyle === 'sport';
    this.tube(bars, new V3(0, lowBars ? -0.04 : 0.02, -hw), new V3(0, lowBars ? -0.04 : 0.02, hw), 0.012, this.mDark, 6);
    if (!lowBars) for (const s of [-1, 1]) this.tube(bars, new V3(0, 0.02, s * hw), new V3(-0.03, car.bikeStyle === 'cruiser' ? 0.08 : 0.05, s * (hw + 0.05)), 0.012, this.mDark, 6);
    for (const s of [-1, 1]) this.tube(bars, new V3(0, lowBars ? -0.04 : 0.02, s * hw * 0.82), new V3(0, lowBars ? -0.04 : 0.02, s * (hw + 0.05)), 0.017, this.mSeat, 6);
    this.gripY = headPos.y + hy; this.gripX = headPos.x - 0.03 - 0.02;
    // farol (+ carenagem frontal / bico)
    const hl = this.ell(steer, 0.09, 0.09, 0.11, 0.14, 0.02, 0, this.lensMat); this.det(hl);
    if (st.fair === 'full' || st.fair === 'tour' || st.fair === 'beak' || st.fair === 'scoot' || st.fair === 'mx') {
      const big = st.fair === 'full' || st.fair === 'tour';
      const f = this.ell(steer, big ? 0.28 : 0.16, big ? 0.17 : 0.12, big ? 0.24 : 0.16, 0.09, big ? 0.0 : 0.04, 0, this.mPaint, 0.2); this.det(f);
      if (big || st.fair === 'beak') { const ws = this.box(steer, 0.01, big ? 0.30 : 0.18, 0.30, -0.06, 0.20, 0, this.mVisor, 0, 0, 0.55); this.det(ws); }
      if (st.fair === 'beak') { const bk = this.box(this.body, 0.30, 0.04, 0.16, fx + 0.1, Rf + 0.58, 0, this.mPaint, 0, 0, -0.35); this.det(bk); }
    }
    const fend = this.box(steer, 0.34, 0.025, Math.max(0.12, wf * 0.9), 0, -forkLen + Rf * 1.12, 0, this.mPaint); fend.position.x = 0.0; this.det(fend);
    for (const s of [-1, 1]) { const m = this.tube(steer, new V3(0.02, 0.12, s * (hw * 0.55)), new V3(-0.05, 0.32, s * (hw * 0.75)), 0.008, this.mDark, 5); const mm = this.box(steer, 0.015, 0.07, 0.11, -0.05, 0.33, s * (hw * 0.78), this.mDark, 0, 0, 0); this.det(mm); const sg = this.ell(steer, 0.025, 0.025, 0.03, 0.10, 0.0, s * (hw * 0.75), this.sigMat[s > 0 ? 1 : 0]); }

    // ---- quadro, motor, tanque ----
    const xe = rx + WB * 0.50, ye = Rf + 0.20 + (car.bikeStyle === 'moto' ? 0.1 : 0);
    const big = Math.min(1.4, 0.7 + (spec.eng.def.disp || 0.5) * 0.45), isEV = spec.isEV;
    if (st.fair === 'scoot') {
      // scooter: plataforma + carenagem lateral + assento longo, motor no braço oscilante
      this.box(body, WB * 0.52, 0.05, 0.36, fx - WB * 0.30, 0.28, 0, this.mDark);
      const cov = this.box(body, WB * 0.36, 0.30, 0.30, rx + WB * 0.30, 0.45, 0, this.mPaint); this.det(cov);
      const leg = this.box(body, 0.14, 0.58, 0.34, fx - 0.2, 0.52, 0, this.mPaint, 0, 0, 0.18); this.det(leg);
    } else {
      this.box(body, 0.46 * big, 0.36 * big, 0.28, xe, ye, 0, this.mEngine);                            // bloco
      for (let i = 0; i < Math.min(4, Math.max(1, spec.eng.def.cyl || 1)); i++) { const cz = ((spec.eng.def.cyl || 1) > 2 ? (i - (Math.min(4, spec.eng.def.cyl) - 1) / 2) * 0.095 : (spec.eng.def.cyl === 2 ? (i - 0.5) * 0.15 : 0)); this.box(body, 0.2 * big, 0.17, 0.085, xe + 0.07, ye + 0.26 * big, cz, this.mEngine, 0, 0, -0.12); }
      if (isEV) this.box(body, 0.5, 0.26, 0.24, xe, ye + 0.06, 0, this.mDark);
      // trelica / viga principal
      for (const s of [-1, 1]) {
        this.tube(body, headPos.clone().add(new V3(0.0, -0.06, s * 0.05)), new V3(pivot.x, pivot.y + 0.05, s * 0.10), 0.017, this.mDark, 6);
        this.tube(body, headPos.clone().add(new V3(0.0, -0.18, s * 0.05)), new V3(xe - 0.05, ye - 0.04, s * 0.12), 0.015, this.mDark, 6);
        this.tube(body, new V3(pivot.x, pivot.y, s * 0.11), new V3(rx + WB * 0.55, seatY - 0.06, s * 0.08), 0.014, this.mDark, 6);
      }
    }
    // balança + amortecedor (atualizados por quadro)
    this.swing = [-1, 1].map(s => this.tube(body, pivot.clone().setZ(s * 0.10), wRear.clone().setZ(s * 0.10), 0.02, this.mDark, 6));
    this.shock = this.tube(body, new V3(pivot.x + 0.05, pivot.y + 0.25, 0), new V3(pivot.x - 0.18, pivot.y, 0), 0.022, this.mChrome, 6);
    // tanque / assento / rabeta
    const tankX = headPos.x - 0.30 * (car.bikeStyle === 'cruiser' ? 1.0 : 1), tankY = seatY + 0.10;
    if (st.tank > 0) { const tk = this.ell(body, 0.27 * st.tank, 0.11 + 0.03 * st.tank, 0.17, tankX - 0.02, tankY, 0, this.mPaint, car.bikeStyle === 'sport' ? 0.12 : -0.03); this.det(tk); this.tankM = tk; }
    const seatX = rx + WB * 0.40, seatL = car.bikeStyle === 'sport' ? 0.45 : car.bikeStyle === 'scooter' ? WB * 0.5 : 0.55;
    this.det(this.box(body, seatL, 0.075, 0.27, seatX, seatY - 0.01, 0, this.mSeat));
    if (car.bikeStyle === 'sport' || car.bikeStyle === 'naked' || car.bikeStyle === 'classic') { const tail = this.box(body, 0.42, 0.10, 0.20, rx + WB * 0.20, seatY + 0.03, 0, this.mPaint, 0, 0, 0.18); this.det(tail); }
    if (car.bikeStyle === 'tour') { for (const s of [-1, 1]) { const b = this.box(body, 0.42, 0.34, 0.24, rx + 0.1, 0.70, s * 0.36, this.mPaint); this.det(b); } this.box(body, 0.4, 0.32, 0.34, rx - 0.05, seatY + 0.2, 0, this.mPaint); }
    if (car.bikeStyle === 'adv' || car.bikeStyle === 'moto') { const rf = this.box(body, 0.5, 0.025, 0.22, rx + 0.1, Rr + 0.35, 0, this.mPaint, 0, 0, 0.30); this.det(rf); }
    else { const rf = this.box(body, 0.5, 0.025, Math.max(0.14, wr), rx + 0.02, Rr + 0.10 + Rr * 0.9, 0, this.mDark); }
    // luz traseira + placa
    this.det(this.box(body, 0.05, 0.05, 0.14, rx - Rr * 0.8 - 0.05, seatY + 0.07, 0, this.tailMat));
    this.box(body, 0.012, 0.13, 0.2, rx - Rr - 0.04, Rr + 0.25, 0, new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 }));
    for (const s of [-1, 1]) this.ell(body, 0.025, 0.025, 0.03, rx - Rr * 0.9, seatY + 0.02, s * 0.13, this.sigMat[s > 0 ? 1 : 0]);
    // escapamento
    if (st.ex !== 'none') {
      const mf = (z) => { const p0 = new V3(fx - 0.18, ye - 0.10, z), p1 = new V3(xe, ye - 0.22, z), p2 = new V3(rx + 0.3, st.ex === 'high' ? seatY - 0.05 : Rr + (st.ex === 'under' ? 0.18 : 0.14), z); this.tube(body, p0, p1, 0.022, this.mChrome, 6); const m = this.tube(body, p1, p2, 0.05, this.mChrome, 8); this.det(m); };
      if (st.ex === 'dual') { mf(0.20); mf(-0.20); } else mf(st.ex === 'under' ? 0.0 : 0.20);
    }
    // ---- piloto ----
    this.buildRider(st, headPos, seatX, seatY, xe, ye);
    // ---- luzes ----
    this.beams = [];
    const sl = new THREE.SpotLight(0xfff2dc, 0, 130, 0.5, 0.6, 1.1); sl.position.set(fx + 0.2, spec.cgH * 0 + Rf + 0.55 - spec.cgH, 0); sl.target.position.set(fx + 25, 0.2 - spec.cgH, 0); this.root.add(sl); this.root.add(sl.target); this.beams.push(sl);
    this.fogBeams = [];
    // zera deslocamento
    this.hullRef = { x: 0 };
  }

  buildRider(st, headPos, seatX, seatY, xe, ye) {
    const R = this.rider = new THREE.Group(); this.body.add(R);
    const hip = new V3(seatX - 0.02, seatY + 0.10, 0), th = st.torso, tl = 0.56;
    const sh = hip.clone().add(new V3(Math.sin(th) * tl, Math.cos(th) * tl, 0));
    this.tube(R, hip, sh, 0.12, this.mSuit, 10);
    this.ell(R, 0.19, 0.12, 0.17, hip.x, hip.y - 0.02, 0, this.mSuit);                                   // quadril
    const neck = sh.clone().add(new V3(0.07 * Math.sin(th), 0.06, 0));
    const head = this.ell(R, 0.15, 0.16, 0.15, neck.x + 0.10 * Math.sin(th) + 0.03, neck.y + 0.15, 0, this.mHelm);
    this.ell(R, 0.10, 0.07, 0.13, head.position.x + 0.09, head.position.y + 0.0, 0, this.mVisor);
    const pegZ = 0.19, peg = new V3(xe - 0.05, 0.38, 0);
    for (const s of [-1, 1]) {
      const grip = new V3(this.gripX, this.gripY, s * 0.40), shl = sh.clone().add(new V3(0, 0, s * 0.18));
      this.tube(R, shl, grip.clone().lerp(shl, 0.0).add(new V3(0, 0.0, 0)).setZ(s * 0.33), 0.05, this.mSuit2, 8);
      const knee = new V3(xe + 0.12 + (st.legs === 'fwd' ? 0.35 : st.legs === 'tuck' ? 0.05 : 0.15), seatY - (st.legs === 'tuck' ? 0.05 : 0.22) + (st.legs === 'up' ? 0.1 : 0), s * 0.20);
      const foot = new V3(st.legs === 'fwd' ? peg.x + 0.45 : peg.x, st.legs === 'fwd' ? 0.30 : peg.y, s * pegZ);
      this.tube(R, hip.clone().setZ(s * 0.12), knee, 0.075, this.mSuit, 8);
      this.tube(R, knee, foot, 0.055, this.mSuit, 8);
      this.box(R, 0.24, 0.06, 0.10, foot.x + 0.06, foot.y - 0.02, foot.z, this.mSeat);
    }
  }

  setLights(on, brake, reverse, mode = on ? 2 : 0) {
    this.lensMat.emissiveIntensity = [0, 0.7, 2.2, 3.4][mode];
    this.tailMat.emissiveIntensity = brake ? 4.0 : (mode >= 1 ? 1.2 : 0.2);
    for (const b of this.beams) { b.intensity = mode === 2 ? 2200 : mode === 3 ? 5500 : 0; b.angle = mode === 3 ? 0.34 : 0.5; b.distance = mode === 3 ? 200 : 120; }
  }
  setPaint(hex) { this.cfg.paint = hex; this.mPaint.color.set(hex); this.mSuit2.color.set(hex).multiplyScalar(0.9); }
  lampOut() { return false; }

  dentLocal(lp, ln, speed) {
    const p = _b.set(lp.x, lp.y + this.spec.cgH, lp.z);
    for (const d of this.details) {
      const dd = d.mesh.getWorldPosition ? 0 : 0; const dist = d.p0.distanceTo(p);
      if (dist > 0.55) continue;
      const k = 1 - dist / 0.55;
      d.mesh.position.addScaledVector(ln, -Math.min(0.12, 0.015 * speed) * k);
      d.mesh.rotation.x += (Math.random() - 0.5) * 0.4 * k; d.mesh.rotation.z += (Math.random() - 0.5) * 0.4 * k;
      d.acc += speed * k; if (d.acc > 12 && d.mesh.geometry) { d.mesh.visible = false; d.hidden = true; }
    }
    if (speed > 8) this.rider.rotation.z = Math.min(0.5, this.rider.rotation.z + 0.04 * speed);
  }
  repair() { for (const d of this.details) { d.mesh.position.copy(d.p0); d.mesh.rotation.copy(d.r0); d.mesh.visible = true; d.acc = 0; d.hidden = false; } this.rider.rotation.z = 0; }

  update(v, dt, extras) {
    const spec = this.spec, cg = spec.cgH;
    this.root.position.copy(v.pos); this.root.quaternion.copy(v.quat);
    // roda dianteira: compressão do garfo e direção
    const hF = v.wh[0], hR = v.wh[2], wF = spec.wheels[0], wR = spec.wheels[2];
    const compF = Math.max(-0.05, Math.min(0.2, wF.sRest - (hF.s + v.wh[1].s) / 2));
    this.fwHold.position.y = -this.forkLen + compF;
    this.steerG.rotation.y = (hF.steer + v.wh[1].steer) / 2 * 1.0;
    this.fw.spin.rotation.z = -(hF.spin + v.wh[1].spin) / 2;
    // roda traseira + balança
    const yw = (wR.mountL.y - (hR.s + v.wh[3].s) / 2) + cg;
    this.rw.group.position.set(this.rx, yw, 0);
    this.rw.spin.rotation.z = -(hR.spin + v.wh[3].spin) / 2;
    const wp = _a.set(this.rx, yw, 0);
    for (const sw of this.swing) { const z = sw.position.z; const p1 = _b.set(this.pivot.x, this.pivot.y, z), d = _q; const dir = new V3(wp.x - p1.x, wp.y - p1.y, 0), L = dir.length(); sw.position.set((p1.x + wp.x) / 2, (p1.y + wp.y) / 2, z); sw.quaternion.setFromUnitVectors(UP, dir.normalize()); sw.scale.y = L; }
    { const p1 = new V3(this.pivot.x + 0.05, this.pivot.y + 0.25, 0), mid = new V3((this.pivot.x + wp.x) / 2 + 0.05, (this.pivot.y + wp.y) / 2, 0), dir = mid.clone().sub(p1), L = dir.length(); this.shock.position.copy(p1).addScaledVector(dir, 0.5); this.shock.quaternion.setFromUnitVectors(UP, dir.normalize()); this.shock.scale.y = L; }
    if (extras) {
      this.setLights(extras.lights, extras.brake, extras.reverse, extras.mode);
      const bl = extras.blink;
      this.sigMat[0].emissiveIntensity = ((extras.sigL || extras.haz) && bl) ? 4 : 0; this.sigMat[1].emissiveIntensity = ((extras.sigR || extras.haz) && bl) ? 4 : 0;
    }
    // piloto: acompanha a frenagem/aceleração (inclina o tronco levemente)
    const ax = v.accL ? v.accL.x : 0; this.rider.rotation.z += ((-ax * 0.012) - this.rider.rotation.z + (this._r0 || 0)) * Math.min(1, dt * 6) * (v.fallen ? 0 : 1);
    if (v.fallen) this.rider.rotation.x += (0.9 * (v.lean >= 0 ? 1 : -1) - this.rider.rotation.x) * Math.min(1, dt * 4);
    else this.rider.rotation.x *= Math.max(0, 1 - dt * 6);
  }

  dispose() { this.root.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
}
