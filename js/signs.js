// ============================================================
//  Catálogo de placas de trânsito (mais de 100 diferentes), desenhadas em canvas.
//  Famílias: ring (proibição, aro vermelho), blue (obrigação), tri (advertência), rect (informação),
//  green (indicação/destino), dia (preferencial), mais PARE / dê a preferência / sentido proibido.
// ============================================================
import * as THREE from 'three';

const RED = '#c4161c', BLUE = '#1b4fa8', GREEN = '#0b5a34', YEL = '#f7c80a';

// [id, família, símbolo, opções]  (s:1 = risco diagonal vermelho; t = texto pequeno embaixo)
const D = [];
const add = (id, f, g, o = {}) => D.push({ id, f, g, ...o });

// ---- limites de velocidade ----
for (const v of [20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) add('v' + v, 'ring', String(v));
// ---- proibições ----
add('noentry', 'noentry', ''); add('nopark', 'nopark', 'E'); add('nostop', 'nostop', '');
add('noovertake', 'ring', '🚗🚙', { sm: 1 }); add('nouturn', 'ring', '↶', { s: 1 }); add('noleft', 'ring', '↰', { s: 1 }); add('noright', 'ring', '↱', { s: 1 });
add('notruck', 'ring', '🚚', { s: 1 }); add('nomoto', 'ring', '🏍', { s: 1 }); add('nobike', 'ring', '🚲', { s: 1 }); add('noped', 'ring', '🚶', { s: 1 });
add('nohorn', 'ring', '📯', { s: 1 }); add('novehicles', 'ring', ''); add('nobus', 'ring', '🚌', { s: 1 }); add('notractor', 'ring', '🚜', { s: 1 });
add('nohazmat', 'ring', '☣', { s: 1 }); add('maxheight', 'ring', '↕3,5m', { sm: 1 }); add('maxwidth', 'ring', '↔2,2m', { sm: 1 }); add('maxweight', 'ring', '5 t', { sm: 1 }); add('noanimals', 'ring', '🐎', { s: 1 });
// ---- obrigação ----
add('ahead', 'blue', '↑'); add('turnL', 'blue', '↰'); add('turnR', 'blue', '↱'); add('keepR', 'blue', '↘'); add('keepL', 'blue', '↙'); add('roundabout', 'blue', '⟳');
add('minspeed', 'blue', '30'); add('bikeonly', 'blue', '🚲'); add('pedonly', 'blue', '🚶'); add('busonly', 'blue', '🚌'); add('chains', 'blue', '⛓'); add('horn', 'blue', '📯');
// ---- advertência ----
const W = [['curveL', '↰'], ['curveR', '↱'], ['curves', '〰'], ['cross', '✚'], ['tjunc', '⊤'], ['sideroad', '⊢'], ['rbAhead', '⟳'], ['signalsAhead', '🚦'], ['pedCross', '🚶'], ['school', '🏫'], ['children', '🧒'], ['cyclists', '🚲'],
  ['cattle', '🐄'], ['deer', '🦌'], ['slippery', '🧊'], ['bumps', '⛰'], ['uneven', '≈'], ['narrow', '⇹'], ['twoway', '⇅'], ['roadworks', '🚧'], ['rocks', '🪨'], ['descent', '↘10%'], ['ascent', '↗10%'], ['merge', '⇈'],
  ['gravel', '⁘'], ['wind', '💨'], ['planes', '✈'], ['railGate', '🚆'], ['railNoGate', '🚂'], ['tunnel', '⌓'], ['queue', '🚗🚗'], ['yieldAhead', '▽'], ['stopAhead', '🛑'], ['fog', '🌫'], ['ice', '❄'], ['tram', '🚊'], ['ferry', '⛴'], ['floods', '🌊'], ['hazard', '!']];
for (const [id, g] of W) add(id, 'tri', g, { sm: g.length > 2 });
// ---- informação ----
const I = [['park', 'P'], ['hospital', '🏥'], ['fuel', '⛽'], ['taxi', '🚕'], ['phone', '☎'], ['hotel', '🛏'], ['food', '🍴'], ['camp', '⛺'], ['bikepath', '🚲'], ['crosswalk', '🚶'], ['oneway', '➡'], ['highway', '🛣'], ['airportInfo', '✈'],
  ['police', '🚓'], ['firstaid', '⛑'], ['charge', '🔌'], ['info', 'i'], ['bus', '🚌']];
for (const [id, g] of I) add(id, 'rect', g, { t: id === 'bus' ? 'ÔNIBUS' : id === 'park' ? 'ESTAC.' : id === 'crosswalk' ? 'PEDESTRES' : id === 'hospital' ? 'HOSPITAL' : '' });
add('deadend', 'rect', '⊥', { t: 'SEM SAÍDA' });
// ---- indicação (verde) e preferência ----
for (const [id, t] of [['g_center', 'CENTRO'], ['g_airport', 'AEROPORTO ✈'], ['g_exit', 'SAÍDA'], ['g_highway', 'RODOVIA'], ['g_city', 'CIDADE'], ['g_port', 'PORTO'], ['g_univ', 'UNIVERSIDADE'], ['g_stadium', 'ESTÁDIO']]) add(id, 'green', t);
add('priority', 'dia', ''); add('endprio', 'dia', '', { end: 1 });
add('stop', 'stop', ''); add('yield', 'yield', '');

export const SIGN_IDS = D.map(d => d.id);
export const SIGN_COUNT = D.length;
const BY = Object.fromEntries(D.map(d => [d.id, d]));
export const isCatalog = id => id in BY;
export const isWide = id => BY[id] && (BY[id].f === 'green');

export function catTex(id, text) {
  const d = BY[id], cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
  g.translate(64, 64); g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = (s, x, y, size, color) => { g.fillStyle = color; g.font = `bold ${size}px "Segoe UI", "Segoe UI Emoji", "Apple Color Emoji", Arial`; g.fillText(s, x, y); };
  const gs = d.g || '', len = [...gs].length, big = /^\d+$/.test(gs) ? (gs.length > 2 ? 40 : 52) : (d.sm || len > 2) ? 30 : 58;
  const circle = (r, c) => { g.beginPath(); g.arc(0, 0, r, 0, 7); g.fillStyle = c; g.fill(); };
  const tri = (k, c) => { g.beginPath(); g.moveTo(0, -60 * k + 0); g.lineTo(60 * k, 48 * k); g.lineTo(-60 * k, 48 * k); g.closePath(); g.fillStyle = c; g.fill(); };
  if (d.f === 'ring') {
    circle(61, RED); circle(47, '#fff');
    if (gs) txt(gs, 0, 3, big, '#111');
    if (d.s) { g.strokeStyle = RED; g.lineWidth = 9; g.beginPath(); g.moveTo(-33, -33); g.lineTo(33, 33); g.stroke(); }
  } else if (d.f === 'noentry') { circle(61, RED); g.fillStyle = '#fff'; g.fillRect(-38, -9, 76, 18);
  } else if (d.f === 'nopark' || d.f === 'nostop') {
    circle(61, RED); circle(49, BLUE); g.strokeStyle = RED; g.lineWidth = 11; g.beginPath(); g.moveTo(-34, -34); g.lineTo(34, 34); if (d.f === 'nostop') { g.moveTo(34, -34); g.lineTo(-34, 34); } g.stroke();
    if (d.f === 'nopark') txt('E', 0, 3, 40, '#fff');
  } else if (d.f === 'blue') { circle(61, '#fff'); circle(58, BLUE); txt(gs, 0, 3, big, '#fff');
  } else if (d.f === 'tri') {
    g.translate(0, 4); tri(1, '#111'); tri(0.97, RED); tri(0.72, '#fff'); g.translate(0, 18); txt(gs, 0, 0, d.sm ? 26 : 40, '#111'); g.translate(0, -22);
  } else if (d.f === 'rect') {
    g.fillStyle = '#fff'; g.fillRect(-60, -60, 120, 120); g.fillStyle = BLUE; g.fillRect(-54, -54, 108, 108);
    txt(gs, 0, d.t ? -14 : 0, d.t ? 54 : 70, '#fff'); if (d.t) txt(d.t, 0, 38, d.t.length > 8 ? 17 : 22, '#fff');
  } else if (d.f === 'green') {
    g.fillStyle = '#fff'; g.fillRect(-62, -34, 124, 68); g.fillStyle = GREEN; g.fillRect(-58, -30, 116, 60);
    const t = text || gs; let sz = 30; g.font = `bold ${sz}px Arial`; while (g.measureText(t).width > 106 && sz > 11) { sz -= 2; g.font = `bold ${sz}px Arial`; } txt(t, 0, 2, sz, '#fff');
  } else if (d.f === 'dia') {
    const dia = (k, c) => { g.beginPath(); g.moveTo(0, -62 * k); g.lineTo(62 * k, 0); g.lineTo(0, 62 * k); g.lineTo(-62 * k, 0); g.closePath(); g.fillStyle = c; g.fill(); };
    dia(1, '#111'); dia(0.95, '#fff'); dia(0.72, d.end ? '#ddd' : YEL);
    if (d.end) { g.strokeStyle = '#555'; g.lineWidth = 5; for (const o of [-14, 0, 14]) { g.beginPath(); g.moveTo(-34 + o, 34 + o); g.lineTo(34 + o, -34 + o); g.stroke(); } }
  } else if (d.f === 'stop') {
    const oct = (r, c) => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fillStyle = c; g.fill(); };
    oct(61, '#fff'); oct(55, RED); txt('PARE', 0, 2, 34, '#fff');
  } else if (d.f === 'yield') {
    g.beginPath(); g.moveTo(-60, -44); g.lineTo(60, -44); g.lineTo(0, 62); g.closePath(); g.fillStyle = RED; g.fill();
    g.beginPath(); g.moveTo(-42, -32); g.lineTo(42, -32); g.lineTo(0, 40); g.closePath(); g.fillStyle = '#fff'; g.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// ---- reconhecimento de placas nos dados do OpenStreetMap (traffic_sign=*, hazard=*, etc.) ----
const RULES = [
  [/stop\b|R-1\b|\b206\b/i, 'stop'], [/give_way|yield|R-2\b|\b205\b/i, 'yield'], [/no_entry|R-3\b|\b267\b/i, 'noentry'],
  [/no_stopping|R-6b|\b283\b/i, 'nostop'], [/no_parking|R-6a|\b286\b/i, 'nopark'], [/no_overtaking|overtak|R-7\b|\b276\b/i, 'noovertake'],
  [/no_u_turn|u-turn|R-5\b/i, 'nouturn'], [/no_left/i, 'noleft'], [/no_right/i, 'noright'], [/no_hgv|no_truck|goods|R-9/i, 'notruck'], [/no_motorcycle|R-11/i, 'nomoto'],
  [/no_bicycle|R-12/i, 'nobike'], [/no_pedestrian|R-13/i, 'noped'], [/no_horn|R-20/i, 'nohorn'], [/maxheight/i, 'maxheight'], [/maxwidth/i, 'maxwidth'], [/maxweight/i, 'maxweight'],
  [/minspeed/i, 'minspeed'], [/roundabout/i, 'rbAhead'], [/traffic_signals|signal/i, 'signalsAhead'], [/crossing|pedestrian|A-32/i, 'pedCross'], [/school|A-33/i, 'school'], [/children/i, 'children'],
  [/cyclist|bicycle|A-30/i, 'cyclists'], [/cattle|cow|livestock/i, 'cattle'], [/deer|animal|wild/i, 'deer'], [/slippery|A-28/i, 'slippery'], [/bump|hump|A-31/i, 'bumps'], [/uneven/i, 'uneven'],
  [/narrow/i, 'narrow'], [/two_way|2way/i, 'twoway'], [/road_works|roadworks|construction|A-26/i, 'roadworks'], [/rock/i, 'rocks'], [/steep_descent|descent|downhill/i, 'descent'], [/steep_ascent|ascent|uphill/i, 'ascent'],
  [/merge/i, 'merge'], [/gravel/i, 'gravel'], [/wind/i, 'wind'], [/aircraft|plane/i, 'planes'], [/level_crossing|railway|rail/i, 'railGate'], [/tunnel/i, 'tunnel'], [/queue|congestion/i, 'queue'],
  [/fog/i, 'fog'], [/ice|snow/i, 'ice'], [/tram/i, 'tram'], [/ferry/i, 'ferry'], [/flood/i, 'floods'], [/curve|bend|A-1[a-b]/i, 'curveR'], [/dangerous|danger|warning|hazard/i, 'hazard'],
  [/city_limit|town_limit/i, 'g_city'], [/priority_road|\b306\b/i, 'priority'], [/priority_road_end|\b307\b/i, 'endprio'], [/parking/i, 'park'], [/hospital/i, 'hospital'], [/fuel|petrol|gas/i, 'fuel'],
  [/hotel/i, 'hotel'], [/taxi/i, 'taxi'], [/camp/i, 'camp'], [/bus_only|bus_lane/i, 'busonly'], [/one_way|oneway/i, 'oneway'], [/dead_end|no_through/i, 'deadend'],
];
export function signFromTags(tags) {
  const s = [tags.traffic_sign, tags['traffic_sign:forward'], tags['traffic_sign:backward'], tags.hazard, tags.traffic_sign_hazard].filter(Boolean).join(';');
  if (!s) return null;
  for (const [re, id] of RULES) if (re.test(s)) return id;
  return null;
}
