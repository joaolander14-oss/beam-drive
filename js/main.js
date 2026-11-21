// ============================================================
//  Beam Drive — aplicação principal
// ============================================================
import * as THREE from 'three';
import './cars2.js';
import './catalog.js';
import { CARS, ENGINES, TIMES, MAPS, SUSP_PRESETS, SURF, clamp, lerp, sstep } from './data.js';
import { defaultCfg, buildSpec } from './spec.js';
import { Vehicle } from './physics.js';
import { CarModel } from './carmodel.js';
import { buildWorld } from './maps.js';
import { CarAudio } from './audio.js';
import { Particles, SkidMarks } from './fx.js';
import { UI } from './ui.js';
import { CATS } from './catalog.js';

const $ = s => document.querySelector(s);
const DT = 1 / 240;

const App = {
  cfg: null, spec: null, mapId: 'campo', world: null, veh: null, model: null,
  opt: { time: 'dia', wet: 0, volume: 0.6, units: 'kmh', shadows: 1, pixel: 1, timeScale: 1, telemetry: false },
  menuOpen: true, paused: false, camMode: 0, camYaw: 0, camPitch: 0.0, camDist: 1, orbitYaw: 0, orbitPitch: 0.16, lookBack: false,
  keys: {}, steerRaw: 0, steerSm: 0, lights: false, acc: 0, simTime: 0,
  meas: { t100: null, brake: null, top: 0, latG: 0, run: null, dist: 0 }, lap: null,
};
window.BD = App;

// ---------------- renderer, cena ----------------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, 1, 0.12, 6000);
scene.add(camera);
App.renderer = renderer; App.scene = scene; App.camera = camera;

// céu
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color(0x3a78c8) }, hor: { value: new THREE.Color(0xbcd8f0) }, sunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() }, sunCol: { value: new THREE.Color(1, 0.95, 0.8) }, night: { value: 0 } },
  vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `varying vec3 vD; uniform vec3 top; uniform vec3 hor; uniform vec3 sunDir; uniform vec3 sunCol; uniform float night;
    float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    void main(){ vec3 d=normalize(vD); float y=d.y;
      vec3 c = mix(hor, top, pow(clamp(y,0.0,1.0),0.55));
      if (y<0.0) c = mix(hor, hor*0.55, clamp(-y*3.0,0.0,1.0));
      float s=max(dot(d,sunDir),0.0); c += sunCol*(pow(s,900.0)*18.0 + pow(s,40.0)*0.35 + pow(s,6.0)*0.10);
      if (night>0.5 && y>0.0) { vec2 g=floor(d.xz/(d.y+0.3)*140.0); float st=step(0.9965,h(g)); c += vec3(st)*0.8*clamp(y*3.0,0.0,1.0); }
      gl_FragColor=vec4(c,1.0); }`,
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 32, 16), skyMat); sky.frustumCulled = false; sky.renderOrder = -10;
scene.add(sky);
const skyScene = new THREE.Scene(); const skyEnv = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); skyScene.add(skyEnv);
const pmrem = new THREE.PMREMGenerator(renderer);
const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3a30, 0.6); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d8, 3); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = -42; sc.right = 42; sc.top = 42; sc.bottom = -42; sc.near = 1; sc.far = 260; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.06;
scene.add(sun); scene.add(sun.target);
let sunDir = new THREE.Vector3(0.5, 0.7, 0.3).normalize();

App.setTime = id => {
  const T = TIMES[id]; App.opt.time = id;
  skyMat.uniforms.top.value.set(T.sky[0]); skyMat.uniforms.hor.value.set(T.sky[1]);
  sunDir = new THREE.Vector3(...T.dir).normalize(); skyMat.uniforms.sunDir.value.copy(sunDir);
  skyMat.uniforms.sunCol.value.setRGB(...T.sun); skyMat.uniforms.night.value = T.night ? 1 : 0;
  sun.color.setRGB(...T.sun); sun.intensity = T.sunI; hemi.intensity = T.amb; hemi.color.set(T.sky[1]); hemi.groundColor.set(0x2a2a24);
  renderer.toneMappingExposure = T.exp;
  scene.fog = new THREE.Fog(T.fog, 120, App.world ? App.world.fogFar * (1 - 0.45 * App.opt.wet) : 2000);
  scene.background = null;
  if (App.envTex) App.envTex.dispose();
  App.envTex = pmrem.fromScene(skyScene, 0.02).texture; scene.environment = App.envTex;
  scene.environmentIntensity = T.night ? 0.25 : id === 'tarde' ? 0.7 : 1.0;
  App.lights = !!T.night;
  App.night = T.night;
};
App.setWet = w => {
  App.opt.wet = w; if (App.world) { App.world.wet = w; if (App.world.roadMat) { App.world.roadMat.roughness = 0.92 - 0.62 * w; App.world.roadMat.color.setScalar(1 - 0.38 * w); } }
  if (scene.fog && App.world) scene.fog.far = App.world.fogFar * (1 - 0.45 * w);
  toast(w ? 'Pista molhada: aderência reduzida' : 'Pista seca');
};
App.setVolume = v => { App.opt.volume = v; audio.setVolume(v); };
App.setShadows = v => { App.opt.shadows = v; renderer.shadowMap.enabled = !!v; sun.castShadow = !!v; scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
App.setPixel = v => { App.opt.pixel = v; renderer.setPixelRatio(Math.min(devicePixelRatio * v, 2)); onResize(); };

function toast(msg, ms = 1800) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), ms); }
App.toast = toast;
function loading(msg, pct) { $('#ldmsg').textContent = msg; $('#ldbar').style.width = pct + '%'; }
const nextFrame = () => new Promise(r => setTimeout(r, 30));

// ---------------- som, efeitos ----------------
const audio = new CarAudio();
let particles, skid;

// ---------------- mapas ----------------
App.loadMap = async function (id) {
  const ld = $('#loading'); ld.classList.remove('hidden'); loading('Gerando mapa: ' + MAPS[id].name + '…', 20); await nextFrame();
  if (App.world) { scene.remove(App.world.group); App.world.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
  const t0 = performance.now();
  const w = buildWorld(id);
  App.world = w; App.mapId = id; w.wet = App.opt.wet;
  scene.add(w.group);
  if (skid) { scene.remove(skid.mesh); }
  skid = new SkidMarks(scene, w);
  if (!particles) particles = new Particles(scene);
  loading('Posicionando o carro…', 80); await nextFrame();
  App.veh.world = w;
  App.setWet(App.opt.wet);
  App.setTime(App.opt.time);
  App.respawn(true);
  ld.classList.add('hidden');
  console.log('mapa', id, 'em', Math.round(performance.now() - t0), 'ms');
  if (App.ui) App.ui.refreshAll();
  App.lap = id === 'autodromo' ? { n: 0, t0: null, best: null, last: null, cp: 0, onLine: false } : null;
  App.meas = { t100: null, brake: null, top: 0, latG: 0, run: null, dist: 0 };
};

App.respawn = function (full) {
  const w = App.world, s = w.spawn, v = App.veh;
  const h = w.heightAt(s.x, s.z);
  v.reset(s.x, h + App.spec.cgH + 0.02, s.z, s.yaw);
  v.vel.set(0, 0, 0);
  if (full) { v.dmgReset(); App.model && App.model.repair(); w.resetProps(); skid && skid.clear(); v.nitroLeft = 12; }
  v.in.thr = v.in.brk = 0;
  App.camYaw = null;
  App.model && App.model.update(v, 0, { lights: App.lights, brake: false, reverse: false });
};

// ---------------- carro / configuração ----------------
App.selectCar = function (id) {
  App.cfg = defaultCfg(id);
  App.rebuildCar(false);
  toast(CARS[id].name);
};
App.rebuildCar = function (keepPose = true, quick = false) {
  const cfg = App.cfg;
  const spec = buildSpec(cfg); App.spec = spec;
  const v = App.veh;
  const keep = keepPose && v.spec ? { p: v.pos.clone(), q: v.quat.clone(), vel: v.vel.clone(), w: v.w.clone() } : null;
  const dmg = v.spec ? JSON.parse(JSON.stringify(v.dmg)) : null;
  v.setSpec(spec); v.trans = cfg.trans;
  if (App.model) { App.scene.remove(App.model.root); App.model.dispose(); }
  App.model = new CarModel(spec, cfg); scene.add(App.model.root);
  if (keep) {
    const yaw = Math.atan2(-new THREE.Vector3(1, 0, 0).applyQuaternion(keep.q).z, new THREE.Vector3(1, 0, 0).applyQuaternion(keep.q).x);
    const w = App.world, gh = w.heightAt(keep.p.x, keep.p.z);
    v.reset(keep.p.x, gh + spec.cgH + 0.03, keep.p.z, yaw);
    if (dmg) v.dmg = dmg;
  } else if (App.world) App.respawn(true);
  v.nitroLeft = 12 + (spec.nitroS || 0);
  audio.setProfile((cfg.parts && cfg.parts.esound) | 0);
  App.model.update(v, 0, { lights: App.lights, brake: false, reverse: false });
  if (App.ui) { App.ui.updateStats && App.ui.tab === 'garage' && App.ui.updateStats(); }
  App.camYaw = null;
};
App.onCfgChanged = function (k, rebuild) {
  App.rebuildCar(true);
  if (k === 'trans') App.veh.trans = App.cfg.trans;
};
App.setPart = function (key, idx) {
  const c = App.cfg; c.parts = c.parts || {}; c.parts[key] = idx;
  const cat = CATS[key], o = cat.opts[idx];
  if (cat.kind === 'preset' && o.set) o.set(c, CARS[c.car]);
  App.rebuildCar(true);
  if (App.ui) App.ui.updateStats();
};
App.quickColor = function (k) {
  if (k === 'paint' && App.model) App.model.setPaint(App.cfg.paint);
};
App.resetCfg = function () { const cur = App.cfg.car; App.cfg = defaultCfg(cur); App.rebuildCar(true); App.ui.renderGarage(); toast('Configuração original restaurada'); };
App.applySuspPreset = function (k) {
  const p = SUSP_PRESETS[k], c = App.cfg;
  Object.assign(c, { kF: p.kF, kR: p.kR, bF: p.bF, bR: p.bR, zb: p.zb, zr: p.zr, rh: p.rh });
  App.rebuildCar(true); toast('Suspensão: ' + p.name);
};
App.garageAction = function (a) {
  if (a === 'copyTire') { App.cfg.tr = App.cfg.tf.slice(); App.cfg.compR = App.cfg.compF; App.cfg.pR = App.cfg.pF; App.rebuildCar(true); }
};

// ---------------- menu ----------------
App.openMenu = function (tab) { App.menuOpen = true; App.ui.open(tab); $('#hud').style.display = 'none'; };
App.closeMenu = function () {
  App.menuOpen = false; App.ui.close(); $('#hud').style.display = ''; App.orbitYaw = 0; App.orbitPitch = 0.16; App.camYaw = null; App.snapCam = true; App.dragged = false;
  audio.start(); camera.clearViewOffset();
  // reposiciona o carro apoiado no chão
  const v = App.veh; if (v.speed < 0.5) { /* mantém */ }
};
App.onTab = function (t) { App.gar = t === 'garage' || t === 'car'; };

// ---------------- entrada ----------------
const KEYMAP = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right', Space: 'hand' };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') && e.code !== 'Escape') { if (!['KeyG', 'KeyM'].includes(e.code)) return; }
  const k = KEYMAP[e.code];
  if (k) { App.keys[k] = true; if (!App.menuOpen) e.preventDefault(); }
  if (e.repeat) return;
  const v = App.veh;
  switch (e.code) {
    case 'Escape': App.menuOpen ? App.closeMenu() : App.openMenu('car'); break;
    case 'KeyG': App.menuOpen && App.ui.tab === 'garage' ? App.closeMenu() : App.openMenu('garage'); break;
    case 'KeyM': App.menuOpen && App.ui.tab === 'map' ? App.closeMenu() : App.openMenu('map'); break;
    case 'F1': e.preventDefault(); App.openMenu('help'); break;
    case 'KeyC': App.camMode = (App.camMode + 1) % CAMS.length; App.camYaw = null; toast('Câmera: ' + CAMS[App.camMode]); break;
    case 'KeyV': App.lookBack = true; break;
    case 'KeyL': App.lights = !App.lights; toast(App.lights ? 'Faróis ligados' : 'Faróis desligados'); break;
    case 'KeyF': App.opt.telemetry = !App.opt.telemetry; break;
    case 'KeyP': App.paused = !App.paused; toast(App.paused ? 'Pausado' : 'Retomado'); break;
    case 'KeyR': if (!App.menuOpen) { v.rightSelf(); toast('Carro desvirado'); } break;
    case 'Backspace': if (!App.menuOpen) { e.preventDefault(); App.respawn(true); toast('Início — carro consertado'); } break;
    case 'Delete': if (!App.menuOpen) { v.dmgReset(); App.model.repair(); toast('Lataria consertada'); } break;
    case 'KeyE': v.in.up = true; break;
    case 'KeyQ': v.in.down = true; break;
    case 'KeyT': App.cfg.trans = App.cfg.trans === 'auto' ? 'manual' : 'auto'; v.trans = App.cfg.trans; v.spec.trans = v.trans; toast('Câmbio: ' + (v.trans === 'auto' ? 'automático' : 'manual (E/Q)')); break;
    case 'KeyN': v.in.nitro = true; break;
    case 'KeyH': audio.horn((App.cfg.parts && App.cfg.parts.horn) | 0, true); break;
    case 'BracketLeft': App.opt.timeScale = clamp(App.opt.timeScale * 0.5, 0.05, 1); toast('Velocidade ' + App.opt.timeScale + '×'); break;
    case 'BracketRight': App.opt.timeScale = clamp(App.opt.timeScale * 2, 0.05, 1); toast('Velocidade ' + App.opt.timeScale + '×'); break;
  }
});
addEventListener('keyup', e => {
  const k = KEYMAP[e.code]; if (k) App.keys[k] = false;
  if (e.code === 'KeyV') App.lookBack = false;
  if (e.code === 'KeyN') App.veh.in.nitro = false;
  if (e.code === 'KeyH') audio.horn(0, false);
});
let drag = null;
canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
addEventListener('pointerup', () => { drag = null; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
  if (App.menuOpen) { App.showYaw = (App.showYaw ?? 0.6) - dx * 0.006; App.showPitch = clamp((App.showPitch ?? 0.2) + dy * 0.004, -0.1, 1.3); App.dragged = true; }
  else if (CAMS[App.camMode] === 'Órbita' || CAMS[App.camMode] === 'Perseguição') { App.orbitYaw -= dx * 0.006; App.orbitPitch = clamp(App.orbitPitch + dy * 0.004, -0.2, 1.3); }
  else { App.headYaw = clamp((App.headYaw || 0) - dx * 0.004, -2.4, 2.4); App.headPitch = clamp((App.headPitch || 0) - dy * 0.004, -0.8, 0.8); }
});
canvas.addEventListener('wheel', e => { App.camDist = clamp(App.camDist * (1 + Math.sign(e.deltaY) * 0.08), 0.5, 3.0); e.preventDefault(); }, { passive: false });

const CAMS = ['Perseguição', 'Capô', 'Cockpit', 'Para-choque', 'Órbita', 'Aérea'];

function gamepadInput() {
  const gp = (navigator.getGamepads && navigator.getGamepads()[0]); if (!gp) return null;
  const dz = v => Math.abs(v) < 0.08 ? 0 : v;
  const g = { steer: dz(gp.axes[0] || 0), thr: gp.buttons[7] ? gp.buttons[7].value : 0, brk: gp.buttons[6] ? gp.buttons[6].value : 0, hand: gp.buttons[0] && gp.buttons[0].pressed ? 1 : 0 };
  const edge = (i, name) => { const p = gp.buttons[i] && gp.buttons[i].pressed; if (p && !App['_gp' + i]) App['_gp' + i] = true, name(); else if (!p) App['_gp' + i] = false; };
  edge(5, () => App.veh.in.up = true); edge(4, () => App.veh.in.down = true); edge(3, () => { App.camMode = (App.camMode + 1) % CAMS.length; App.camYaw = null; }); edge(2, () => App.veh.rightSelf());
  return g;
}

function updateInputs(dt) {
  const k = App.keys, v = App.veh, gp = gamepadInput();
  let thr = (k.up ? 1 : 0), brk = (k.down ? 1 : 0), hand = k.hand ? 1 : 0, target = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  if (gp) { thr = Math.max(thr, gp.thr); brk = Math.max(brk, gp.brk); hand = Math.max(hand, gp.hand); }
  // suavização do esterço de teclado (mais lento em velocidade)
  const sp = Math.abs(v.fwdSpeed);
  if (gp && Math.abs(gp.steer) > 0.02 && !k.left && !k.right) { App.steerSm = gp.steer; }
  else {
    const rate = (target !== 0 && Math.sign(target) === Math.sign(App.steerSm) || App.steerSm === 0) ? (3.2 / (1 + sp / 30)) : 5.5;
    if (target === 0) { const back = 5 * dt; App.steerSm = Math.abs(App.steerSm) < back ? 0 : App.steerSm - Math.sign(App.steerSm) * back; }
    else App.steerSm += clamp(target - App.steerSm, -rate * dt, rate * dt);
  }
  v.in.thr = thr; v.in.brk = brk; v.in.hand = hand; v.in.steer = clamp(App.steerSm, -1, 1);
}

// ---------------- câmeras ----------------
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
let camPos = new THREE.Vector3(), camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const v = App.veh, w = App.world, spec = App.spec, mode = CAMS[App.camMode];
  const fwd = tmpV.set(1, 0, 0).applyQuaternion(v.quat);
  const carYaw = Math.atan2(-fwd.z, fwd.x);
  let fov = 62 + Math.min(14, Math.abs(v.fwdSpeed) * 0.14);
  if (App.menuOpen) {
    // vitrine
    if (!App.dragged) App.showYaw = (App.showYaw ?? 0.6) + dt * 0.25;
    const d = (spec.L * 1.35 + 1.5) * App.camDist;
    const cx = App.showPitch ?? 0.2, sy = App.showYaw;
    camera.position.set(v.pos.x + Math.cos(sy) * Math.cos(cx) * d, v.pos.y - spec.cgH + 0.9 + Math.sin(cx) * d, v.pos.z + Math.sin(sy) * Math.cos(cx) * d);
    camera.lookAt(v.pos.x, v.pos.y - spec.cgH + 0.55, v.pos.z);
    camera.fov = 38; camera.updateProjectionMatrix();
    const W = innerWidth, H = innerHeight; camera.setViewOffset(W, H, -W * 0.2, 0, W, H);
    return;
  }
  if (mode === 'Perseguição' || mode === 'Órbita') {
    // ângulo da câmera segue a direção do carro com atraso
    if (App.camYaw == null) App.camYaw = carYaw;
    const velYaw = v.speed > 4 && v.fwdSpeed > 0 ? Math.atan2(-v.vel.z, v.vel.x) : carYaw;
    let target = mode === 'Perseguição' ? carYaw * 0.6 + lerpAngle(carYaw, velYaw, 0.4) * 0.4 : App.camYaw;
    if (mode === 'Perseguição') {
      const dyaw = angDiff(target, App.camYaw);
      App.camYaw += dyaw * Math.min(1, dt * 3.2);
      if (!drag) { App.orbitYaw *= 1 - Math.min(1, dt * 2.5); App.orbitPitch += (0.16 - App.orbitPitch) * Math.min(1, dt * 2); }
    }
    const yaw = App.camYaw + (mode === 'Perseguição' ? App.orbitYaw : App.orbitYaw - carYaw) + (App.lookBack ? Math.PI : 0);
    const d = (spec.L * 1.1 + 2.4) * App.camDist, pit = mode === 'Perseguição' ? App.orbitPitch + 0.10 : App.orbitPitch;
    const tx = v.pos.x, ty = v.pos.y + 0.35, tz = v.pos.z;
    // câmera atrás: direção oposta à frente
    const ax = -Math.cos(yaw), az = Math.sin(yaw);
    const px = tx + ax * Math.cos(pit) * d, pz = tz + az * Math.cos(pit) * d;
    let py = ty + Math.sin(pit) * d + 0.5;
    py = Math.max(py, w.heightAt(px, pz) + 0.6);
    camPos.set(px, py, pz);
    camera.position.lerp(camPos, App.snapCam ? 1 : Math.min(1, dt * 14)); App.snapCam = false;
    camera.lookAt(tx, ty + 0.35, tz);
  } else if (mode === 'Aérea') {
    camPos.set(v.pos.x - Math.cos(carYaw) * 6, v.pos.y + 28 * App.camDist, v.pos.z + Math.sin(carYaw) * 6);
    camera.position.lerp(camPos, Math.min(1, dt * 5)); camera.lookAt(v.pos);
    fov = 55;
  } else {
    // câmeras presas ao carro
    let local;
    if (mode === 'Capô') local = new THREE.Vector3(spec.noseX - spec.car.shape.xc * spec.L - 0.1, spec.car.H - spec.cgH + 0.02 - (spec.car.H - spec.car.shape.belt[0]) * 0.5, 0);
    else if (mode === 'Para-choque') local = new THREE.Vector3(spec.noseX + 0.15, 0.32 - spec.cgH, 0);
    else local = spec.driverEye.clone();
    const worldP = local.applyQuaternion(v.quat).add(v.pos);
    camera.position.copy(worldP);
    tmpQ.copy(v.quat);
    const hy = (App.headYaw || 0) + (App.lookBack ? Math.PI : 0), hp = App.headPitch || 0;
    // direção da câmera: eixo +X do carro girado
    const base = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); // câmera olha -Z -> +X do carro
    const head = new THREE.Quaternion().setFromEuler(new THREE.Euler(hp, hy, 0, 'YXZ'));
    camera.quaternion.copy(tmpQ).multiply(base).multiply(head);
    if (!drag) { App.headYaw = (App.headYaw || 0) * (1 - Math.min(1, dt * 3)); App.headPitch = (App.headPitch || 0) * (1 - Math.min(1, dt * 3)); }
    fov = mode === 'Cockpit' ? 70 : 78;
  }
  if (camera.fov !== fov) { camera.fov = fov; camera.updateProjectionMatrix(); }
}
function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; }
function lerpAngle(a, b, t) { return a + angDiff(b, a) * t; }

// ---------------- efeitos por frame ----------------
function emitFx(dt) {
  const v = App.veh, w = App.world;
  let squeal = 0, rough = false;
  for (let i = 0; i < 4; i++) {
    const h = v.wh[i];
    if (!h.contact) { skid.add(i, 0, 0, 0, 0, 0, false); continue; }
    const surf = SURF[h.surf];
    const slipv = Math.hypot(h.vx - h.omega * h.w.R, h.vy);  // m/s de derrapagem
    const sl = h.slip;
    if (surf.hard) {
      if (sl > 1.05 && Math.abs(h.vx) + Math.abs(h.vy) > 3) {
        const a = clamp((sl - 1.0) * 0.6, 0, 1);
        squeal = Math.max(squeal, a);
        skid.add(i, h.cp.x, h.cp.z, 0, 0, h.w.width * 0.9, true);
        if (Math.random() < dt * 28 * a) particles.emit(h.cp.x + (Math.random() - 0.5) * 0.3, h.cp.y + 0.15, h.cp.z + (Math.random() - 0.5) * 0.3, v.vel.x * 0.15 + (Math.random() - 0.5) * 0.7, 0.7 + Math.random() * 0.6, v.vel.z * 0.15 + (Math.random() - 0.5) * 0.7, 0.55 + 0.5 * a, 1.3 + a * 0.6, 0.85, 0.85, 0.88, 0.16 * a + 0.05, 1.7, 0.1);
      } else skid.add(i, 0, 0, 0, 0, 0, false);
    } else {
      skid.add(i, 0, 0, 0, 0, 0, false);
      rough = true;
      const sp = Math.hypot(h.vx, h.vy);
      if (sp > 3 && Math.random() < dt * 45 * Math.min(1, (slipv + sp * 0.15) / 8)) {
        const c = SURF[h.surf].col; const k = h.surf === 6 ? 0.55 : 1.15;
        particles.emit(h.cp.x + (Math.random() - 0.5) * 0.4, h.cp.y + 0.1, h.cp.z + (Math.random() - 0.5) * 0.4, v.vel.x * 0.12 + (Math.random() - 0.5), 1 + Math.random() * 1.6, v.vel.z * 0.12 + (Math.random() - 0.5), 1.0 + Math.random() * 0.8, 1.8, c[0] * k, c[1] * k, c[2] * k, 0.5, 1.6, -0.5);
      }
      if (sl > 1.2) squeal = Math.max(squeal, 0.35);
    }
  }
  // fumaça do motor/vapor/batida de limitador
  if (v.dmg.engine > 0.3 || v.temp > 112) {
    const mp = App.model.pf; const loc = new THREE.Vector3(App.spec.noseX - 0.9, App.spec.car.shape.hf - App.spec.car.cgH, 0).applyQuaternion(v.quat).add(v.pos);
    if (Math.random() < dt * 25) { const hot = v.temp > 112; particles.emit(loc.x, loc.y, loc.z, (Math.random() - 0.5) * 0.4, 1.4, (Math.random() - 0.5) * 0.4, 0.8, 2.2, hot ? 0.95 : 0.12, hot ? 0.95 : 0.12, hot ? 0.95 : 0.12, hot ? 0.4 : 0.5, 2.5, 0.4); }
  }
  // chamas de lançamento (limitador/nitro)
  if ((v.cutT > 0 && v.pedalThr > 0.8 && v.spec.eng.kind !== 'ev') || v.nitroOn) {
    const loc = new THREE.Vector3(-(App.spec.WB - App.spec.a) - App.spec.car.fo * 0 - (App.spec.L - App.spec.car.fo - App.spec.WB) - 0.05, 0.28 - App.spec.cgH, 0.3).applyQuaternion(v.quat).add(v.pos);
    const bk = new THREE.Vector3(-1, 0.1, 0).applyQuaternion(v.quat).multiplyScalar(5).add(v.vel);
    particles.emit(loc.x, loc.y, loc.z, bk.x, bk.y, bk.z, 0.5, 0.18, 1.0, 0.55, 0.15, 0.9, 0.6, 0);
  }
  for (const ev of v.events) {
    if (ev.type === 'hit') { audio.thump(ev.v); for (let k = 0; k < Math.min(14, ev.v); k++) particles.emit(ev.p.x, ev.p.y, ev.p.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.18, 0.5, 1, 0.75, 0.25, 0.9, 0.2, -9); if (ev.v > 8) toast('Colisão! ' + Math.round(ev.v * 3.6) + ' km/h', 900); }
    else if (ev.type === 'scrape') { audio.scrape(ev.v); for (let k = 0; k < 3; k++) particles.emit(ev.p.x, ev.p.y, ev.p.z, (Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3, 0.14, 0.4, 1, 0.8, 0.3, 0.9, 0.2, -9); }
  }
  v.events.length = 0;
  for (const im of v.impacts) App.model.dentLocal(im.p, im.n, im.v);
  v.impacts.length = 0;
  App.squeal = squeal; App.rough = rough;
}

// ---------------- medições ----------------
function updateMeasure(dt) {
  const v = App.veh, m = App.meas, sp = Math.abs(v.fwdSpeed);
  m.top = Math.max(m.top, sp);
  m.latG = Math.max(m.latG, Math.abs(v.accL.z) / 9.81);
  // 0-100
  if (!m.run && sp < 0.6 && v.pedalThr > 0.6) m.run = { t: 0, d: 0, kind: 'acc' };
  if (m.run && m.run.kind === 'acc') { m.run.t += dt; m.run.d += sp * dt; if (sp >= 100 / 3.6) { m.t100 = m.run.t; m.run = null; } else if (v.pedalThr < 0.3 && sp > 2) m.run = null; if (m.run && sp < 0.2 && m.run.t > 1.5) m.run = null; }
  // 100-0
  if (!m.bk && sp >= 99 / 3.6 && v.pedalBrk > 0.7) m.bk = { d: 0, t: 0, v0: sp };
  if (m.bk) { m.bk.d += sp * dt; m.bk.t += dt; if (v.pedalBrk < 0.3) m.bk = null; else if (sp < 0.5) { m.brake = { d: m.bk.d, t: m.bk.t, v0: m.bk.v0 }; m.bk = null; } }
  // voltas
  if (App.lap && App.world.road) {
    const L = App.lap, r = App.world.road, nr = r.nearest(v.pos.x, v.pos.z, 40);
    if (nr) {
      const f = nr.i / r.n;
      if (L.t0 != null) L.cur = App.simTime - L.t0;
      if (f > 0.2 && f < 0.3) L.cp |= 1; if (f > 0.45 && f < 0.55) L.cp |= 2; if (f > 0.7 && f < 0.8) L.cp |= 4;
      const cross = L.prev != null && L.prev > 0.9 && f < 0.1;
      if (cross) { if (L.t0 != null && L.cp === 7) { L.last = App.simTime - L.t0; L.best = L.best == null ? L.last : Math.min(L.best, L.last); L.n++; toast('Volta ' + L.n + ': ' + fmtTime(L.last), 2500); } L.t0 = App.simTime; L.cp = 0; }
      L.prev = f;
    }
  }
}
const fmtTime = t => { const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + s.toFixed(2).padStart(5, '0'); };

// ---------------- HUD ----------------
const hudC = $('#hud'), hx = hudC.getContext('2d');
function resizeHud() { const r = Math.min(devicePixelRatio, 2); hudC.width = innerWidth * r; hudC.height = innerHeight * r; hx.setTransform(r, 0, 0, r, 0, 0); }
function drawHud() {
  const W = innerWidth, H = innerHeight; hx.clearRect(0, 0, W, H);
  if (App.menuOpen) return;
  const v = App.veh, s = App.spec, E = s.eng, u = Math.min(W, H) / 820;
  const mph = App.opt.units === 'mph', spd = Math.abs(v.fwdSpeed) * (mph ? 2.23694 : 3.6);
  // ---- conta-giros ----
  const cx = W - 180 * u - 18, cy = H - 170 * u - 14, R = 150 * u;
  hx.save(); hx.translate(cx, cy);
  const grd = hx.createRadialGradient(0, 0, R * 0.2, 0, 0, R); grd.addColorStop(0, 'rgba(14,18,28,.9)'); grd.addColorStop(1, 'rgba(6,8,14,.85)');
  hx.fillStyle = grd; hx.beginPath(); hx.arc(0, 0, R, 0, 7); hx.fill(); hx.strokeStyle = '#2b3b5c'; hx.lineWidth = 3 * u; hx.stroke();
  const maxRpm = Math.ceil((E.red + 300) / 1000) * 1000, a0 = Math.PI * 0.78, a1 = Math.PI * 2.22, ang = r => a0 + (a1 - a0) * r / maxRpm;
  const ev = E.kind === 'ev';
  hx.font = `${15 * u}px Segoe UI`; hx.textAlign = 'center'; hx.textBaseline = 'middle';
  const step = ev ? 2000 : 1000;
  for (let r = 0; r <= maxRpm; r += step / 2) {
    const a = ang(r), major = r % step === 0, rr = R * (major ? 0.86 : 0.92);
    hx.strokeStyle = r >= E.red ? '#ff4a3a' : '#9fb0d0'; hx.lineWidth = (major ? 3 : 1.5) * u;
    hx.beginPath(); hx.moveTo(Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97); hx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); hx.stroke();
    if (major) { hx.fillStyle = r >= E.red ? '#ff6a5a' : '#d8e2f5'; hx.fillText(ev ? r / 1000 : r / 1000, Math.cos(a) * R * 0.74, Math.sin(a) * R * 0.74); }
  }
  hx.lineWidth = 8 * u; hx.strokeStyle = '#d02a22'; hx.beginPath(); hx.arc(0, 0, R * 0.95, ang(E.red), ang(maxRpm)); hx.stroke();
  const rpm = clamp(v.rpm, 0, maxRpm * 1.02);
  hx.strokeStyle = v.cutT > 0 ? '#ff3030' : '#ff8a2a'; hx.lineWidth = 5 * u; hx.lineCap = 'round';
  hx.beginPath(); hx.moveTo(Math.cos(ang(rpm)) * R * 0.45, Math.sin(ang(rpm)) * R * 0.45); hx.lineTo(Math.cos(ang(rpm)) * R * 0.93, Math.sin(ang(rpm)) * R * 0.93); hx.stroke();
  hx.fillStyle = '#fff'; hx.font = `bold ${46 * u}px Segoe UI`; hx.fillText(Math.round(spd), 0, 6 * u);
  hx.font = `${14 * u}px Segoe UI`; hx.fillStyle = '#8fa2c4'; hx.fillText(mph ? 'mph' : 'km/h', 0, 38 * u);
  hx.fillStyle = '#8fa2c4'; hx.fillText(ev ? 'x1000 rpm' : '×1000 rpm', 0, -R * 0.45);
  // marcha
  const gname = v.shiftT > 0 && v.pendingGear != null ? v.pendingGear : v.gear;
  const gi = s.gearInfo; const gtxt = gi.type === 'cvt' ? (v.gear === -1 ? 'R' : v.gear === 0 ? 'N' : 'D') : gname === -1 ? 'R' : gname === 0 ? 'N' : (gi.type === 'ev' ? (v.gear === -1 ? 'R' : 'D') : gname);
  hx.font = `bold ${44 * u}px Segoe UI`; hx.fillStyle = v.trans === 'manual' ? '#34b4ff' : '#ffb347'; hx.fillText(gtxt, 0, R * 0.62);
  hx.font = `${12 * u}px Segoe UI`; hx.fillStyle = '#8fa2c4'; hx.fillText(v.trans === 'manual' ? 'MANUAL' : 'AUTO', 0, R * 0.80);
  // turbo arc
  if (E.bar > 0) { hx.lineWidth = 6 * u; hx.strokeStyle = '#1c2a44'; hx.beginPath(); hx.arc(0, 0, R * 1.07, Math.PI * 0.55, Math.PI * 0.97); hx.stroke(); hx.strokeStyle = '#34b4ff'; hx.beginPath(); hx.arc(0, 0, R * 1.07, Math.PI * 0.55, Math.PI * (0.55 + 0.42 * v.fill)); hx.stroke(); hx.fillStyle = '#7fd0ff'; hx.font = `${11 * u}px Segoe UI`; hx.fillText((E.bar * E.boostScale * v.fill).toFixed(2) + ' bar', -R * 1.18, R * 0.58); }
  hx.restore();
  // ---- indicadores ----
  const pill = (x, y, txt, on, col) => { hx.font = `bold ${13 * u}px Segoe UI`; const w = hx.measureText(txt).width + 14 * u; hx.fillStyle = on ? col : 'rgba(20,28,44,.8)'; hx.beginPath(); hx.roundRect(x, y, w, 22 * u, 5 * u); hx.fill(); hx.fillStyle = on ? '#000' : '#4f6188'; hx.textAlign = 'left'; hx.textBaseline = 'middle'; hx.fillText(txt, x + 7 * u, y + 11.5 * u); return w + 6 * u; };
  let px = cx - R, py = cy + R + 8 * u;
  px += pill(px, py, 'ABS', v.absAct, '#ffd23a'); px += pill(px, py, 'TC', v.tcAct, '#ffd23a'); px += pill(px, py, 'ESC', v.escAct, '#ffb03a');
  if (App.spec.cfg.nitro) px += pill(px, py, 'N₂O ' + Math.max(0, v.nitroLeft).toFixed(0) + 's', v.nitroOn, '#58e0ff');
  px += pill(px, py, '💡', App.lights, '#fff3b0');
  // temperatura e dano
  const bar = (x, y, w, frac, col, label) => { hx.fillStyle = 'rgba(10,14,24,.8)'; hx.fillRect(x, y, w, 9 * u); hx.fillStyle = col; hx.fillRect(x, y, w * clamp(frac, 0, 1), 9 * u); hx.fillStyle = '#9fb0d0'; hx.font = `${11 * u}px Segoe UI`; hx.textAlign = 'left'; hx.textBaseline = 'alphabetic'; hx.fillText(label, x, y - 3 * u); };
  const bx = cx - R, by = cy - R - 12 * u - 80 * u;
  const tcol = v.temp > 112 ? '#ff4a3a' : v.temp > 100 ? '#ffb03a' : '#4cdc8a';
  bar(bx, by + 0 * u, 120 * u, (v.temp - 40) / 100, tcol, `Temperatura ${Math.round(v.temp)}°C`);
  const dtot = clamp(v.dmg.body * 0.7 + v.dmg.engine * 0.3, 0, 1);
  bar(bx, by + 28 * u, 120 * u, dtot, dtot > 0.6 ? '#ff4a3a' : '#ffb03a', `Dano ${Math.round(dtot * 100)}%` + (v.dmg.rad > 0.4 ? ' · radiador' : '') + (v.dmg.engine > 0.4 ? ' · motor' : ''));
  // ---- G-meter / telemetria ----
  const gx = 120 * u, gy = H - 130 * u, gr = 70 * u;
  hx.save(); hx.translate(gx, gy);
  hx.fillStyle = 'rgba(10,14,24,.75)'; hx.beginPath(); hx.arc(0, 0, gr, 0, 7); hx.fill(); hx.strokeStyle = '#2b3b5c'; hx.lineWidth = 2 * u; hx.stroke();
  hx.beginPath(); hx.arc(0, 0, gr * 0.5, 0, 7); hx.stroke(); hx.beginPath(); hx.moveTo(-gr, 0); hx.lineTo(gr, 0); hx.moveTo(0, -gr); hx.lineTo(0, gr); hx.stroke();
  const gxv = v.accL.z / 9.81, gyv = v.accL.x / 9.81;
  hx.fillStyle = '#ff7a1a'; hx.beginPath(); hx.arc(clamp(gxv, -1.6, 1.6) / 1.6 * gr, clamp(-gyv, -1.6, 1.6) / 1.6 * gr, 6 * u, 0, 7); hx.fill();
  hx.fillStyle = '#9fb0d0'; hx.font = `${11 * u}px Segoe UI`; hx.textAlign = 'center'; hx.fillText('G', 0, -gr - 6 * u); hx.fillText(Math.hypot(gxv, gyv).toFixed(2) + ' g', 0, gr + 14 * u);
  hx.restore();
  if (App.opt.telemetry) drawTelemetry(u, gx + gr + 30 * u, gy - gr);
  // ---- medições ----
  const m = App.meas; let ty = 16 * u; hx.textAlign = 'left'; hx.textBaseline = 'alphabetic'; hx.font = `${14 * u}px Segoe UI`;
  const line = (t, c = '#d8e2f5') => { hx.fillStyle = c; hx.fillText(t, 16 * u, ty += 20 * u); };
  hx.fillStyle = 'rgba(8,12,20,.55)'; hx.fillRect(8 * u, 8 * u, 250 * u, (App.lap ? 150 : 120) * u);
  line(`${App.world.name} · ${App.spec.car.name}`, '#ffb347');
  line(`0–100: ${m.run && m.run.kind === 'acc' ? m.run.t.toFixed(2) + ' s…' : m.t100 ? m.t100.toFixed(2) + ' s' : '—'}   Vmáx: ${Math.round(m.top * (mph ? 2.237 : 3.6))}`);
  line(`100–0: ${m.bk ? 'frenando… ' + m.bk.d.toFixed(0) + ' m' : m.brake ? m.brake.d.toFixed(1) + ' m (' + m.brake.t.toFixed(1) + ' s)' : '—'}`);
  line(`Lateral máx: ${m.latG.toFixed(2)} g · Piso: ${SURF[v.wh[0].surf].name}${App.world.wet && SURF[v.wh[0].surf].hard ? ' (molhado)' : ''}`);
  if (App.lap) line(`Volta ${App.lap.n + 1}: ${App.lap.cur != null ? fmtTime(App.lap.cur) : '—'} · melhor ${App.lap.best ? fmtTime(App.lap.best) : '—'}`, '#7fe0ff');
  if (App.paused) { hx.fillStyle = '#fff'; hx.font = `bold ${40 * u}px Segoe UI`; hx.textAlign = 'center'; hx.fillText('PAUSADO', W / 2, H / 2); }
  if (App.opt.timeScale < 1) { hx.fillStyle = '#ffd23a'; hx.font = `bold ${16 * u}px Segoe UI`; hx.textAlign = 'center'; hx.fillText('CÂMERA LENTA ' + App.opt.timeScale + '×', W / 2, 24 * u); }
  hx.textAlign = 'right'; hx.fillStyle = 'rgba(200,215,240,.6)'; hx.font = `${12 * u}px Segoe UI`; hx.fillText('G garagem · M mapas · C câmera · F1 ajuda', W - 14 * u, 20 * u);
}
function drawTelemetry(u, x0, y0) {
  const v = App.veh, s = App.spec;
  hx.save(); hx.translate(x0, y0);
  hx.fillStyle = 'rgba(10,14,24,.72)'; hx.fillRect(0, 0, 210 * u, 150 * u);
  const pos = [[-1, 0], [1, 0], [-1, 1], [1, 1]]; // [lado, eixo]
  for (let i = 0; i < 4; i++) {
    const h = v.wh[i], w = s.wheels[i];
    const x = 105 * u + w.side * 55 * u, y = (w.axle === 0 ? 30 : 100) * u;
    const sl = h.contact ? clamp(h.slip, 0, 2) : 0;
    hx.fillStyle = !h.contact ? '#333' : sl < 0.7 ? `rgb(${Math.round(80 + sl * 150)},220,100)` : sl < 1.05 ? '#ffd23a' : '#ff4a3a';
    hx.fillRect(x - 12 * u, y - 20 * u, 24 * u, 40 * u);
    hx.fillStyle = '#4fa0ff'; const lf = clamp(h.Fz / (s.mass * 9.81 * 0.5), 0, 1.2); hx.fillRect(x + w.side * 16 * u - 3 * u, y + 20 * u - 40 * u * lf, 6 * u, 40 * u * lf);
    hx.fillStyle = '#fff'; hx.font = `${10 * u}px Segoe UI`; hx.textAlign = 'center'; hx.fillText(Math.round(h.Fz) + ' N', x, y + 32 * u);
  }
  hx.fillStyle = '#9fb0d0'; hx.textAlign = 'left'; hx.fillText(`β ${(Math.atan2(v.localVy, Math.abs(v.localVx)) * 57.3).toFixed(1)}°  yaw ${(v.yawRate * 57.3).toFixed(0)}°/s`, 6 * u, 144 * u);
  hx.restore();
}

// ---------------- laço principal ----------------
let last = performance.now(), fpsT = 0, frames = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  App.step(dt);
}
App.step = function (dt, render = true) {
  const v = App.veh, w = App.world;
  if (!w) return;
  const run = !App.menuOpen && !App.paused;
  if (run) {
    updateInputs(dt);
    App.acc += dt * App.opt.timeScale;
    let n = 0;
    while (App.acc >= DT && n < 40) { v.step(DT); App.acc -= DT; App.simTime += DT; n++; }
    if (n === 40) App.acc = 0;
    w.updateProps(dt * App.opt.timeScale, v);
    emitFx(dt);
    updateMeasure(dt * App.opt.timeScale);
  }
  // luzes
  const reversing = v.gear === -1 && v.pedalThr > 0.05;
  App.model.update(v, dt, { lights: App.lights, brake: v.pedalBrk > 0.05 || v.in.hand > 0.3, reverse: reversing });
  App.model.swSpin.rotation.x = -v.steerAng * 4.5;
  // sol segue o carro (sombra)
  sun.position.set(v.pos.x + sunDir.x * 120, v.pos.y + sunDir.y * 120, v.pos.z + sunDir.z * 120); sun.target.position.copy(v.pos);
  if (render) {
    if (!App.staticCam) updateCamera(dt);
    sky.position.copy(camera.position); skyEnv.position.set(0, 0, 0);
    if (particles) particles.update(dt * (run ? 1 : 0), camera);
    // áudio
    const E = v.spec.eng;
    audio.update({ paused: App.menuOpen || App.paused, rpm: v.rpm, thr: v.thrEff, ev: E.kind === 'ev', cyl: E.cyl || 4, kind: E.kind, rotary: E.def.rotary, boost: E.bar > 0 ? v.fill * (v.pedalThr > 0.3 ? 1 : 0.4) : 0, squeal: App.squeal || 0, speed: v.speed, rough: App.rough, limiter: v.cutT > 0 });
    renderer.render(scene, camera);
    drawHud();
    frames++; fpsT += dt; if (fpsT > 1) { App.fps = Math.round(frames / fpsT); frames = 0; fpsT = 0; }
  }
};
function onResize() {
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); resizeHud();
}
addEventListener('resize', onResize);

// ---------------- inicialização ----------------
(async function init() {
  loading('Montando o carro…', 10);
  App.veh = new Vehicle(null);
  App.cfg = defaultCfg('hatchgt');
  App.ui = new UI(App);
  App.ui.init();
  onResize();
  // carro provisório (mundo ainda não existe)
  App.spec = buildSpec(App.cfg); App.veh.world = { heightAt: () => 0, normalAt: (x, z, o) => o.set(0, 1, 0), surfAt: () => 0, queryStatic: (x, z, r, o) => { o.length = 0; return o; }, clampBounds() { }, wet: 0 };
  App.veh.setSpec(App.spec);
  App.model = new CarModel(App.spec, App.cfg); scene.add(App.model.root);
  await App.loadMap('campo');
  App.rebuildCar(false);
  App.setTime('dia');
  App.openMenu('car');
  requestAnimationFrame(t => { last = t; frame(t); });
})();

// API para testes
App.fastForward = function (sec) { const n = Math.round(sec / DT); for (let i = 0; i < n; i++) { App.veh.step(DT); App.simTime += DT; } emitFx(0); };

App.view = function (yaw, pitch = 0.15, dist = null) {
  if (yaw == null) { App.staticCam = false; return; }
  App.staticCam = true;
  // câmera estática ao redor do carro, para inspeção (yaw em rad a partir do nariz)
  const v = App.veh, sp = App.spec, d = dist || sp.L * 1.4 + 1;
  const fwd = new THREE.Vector3(1, 0, 0).applyQuaternion(v.quat), cy = Math.atan2(-fwd.z, fwd.x);
  const a = -cy + Math.PI + yaw;   // yaw 0 = atrás do carro
  camera.position.set(v.pos.x + Math.cos(a) * Math.cos(pitch) * d * -1, v.pos.y - sp.cgH + 0.7 + Math.sin(pitch) * d, v.pos.z + Math.sin(a) * Math.cos(pitch) * d * -1);
  camera.lookAt(v.pos.x, v.pos.y - sp.cgH + 0.6, v.pos.z); camera.fov = 40; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
};
