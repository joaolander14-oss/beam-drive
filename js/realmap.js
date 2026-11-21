// Seletor de área (Leaflet + OpenStreetMap) e busca de dados gratuitos (Overpass + elevação AWS Terrain)
const MAXSIDE = 30000;   // metros (área total escolhida; só ~2 km ao redor do carro são carregados)
const WIN = 1000;   // meia-largura da janela carregada (janela de 2 km)
const STEP = 500;   // as janelas ficam numa grade de 500 m (reaproveita o cache)
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'];
const cacheQ = new Map();
let leafletReady;

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletReady) return leafletReady;
  return (leafletReady = new Promise((res, rej) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.append(l);
    const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; s.onload = res; s.onerror = () => { leafletReady = null; rej(new Error('Sem internet para carregar o mapa')); }; document.head.append(s);
  }));
}

export async function openRealPicker(app) {
  const root = document.createElement('div');
  root.id = 'rm';
  root.innerHTML = `<div class="rmbar">
      <b>🌍 Mundo Real</b>
      <input id="rmq" type="text" placeholder="Buscar lugar (ex.: Avenida Paulista, Monaco, Interlagos…)" />
      <button id="rmgo" class="sm">Buscar</button>
      <button id="rmdraw" class="sm">▭ Redesenhar retângulo</button>
      <button id="rmpin" class="sm">📍 Ponto de partida</button>
      <span id="rminfo" class="hint"></span>
      <label class="rmopt"><input type="checkbox" id="rmov" checked> casas do Overture Maps</label>
      <label class="rmopt"><input type="checkbox" id="rmgn" checked> casas genéricas nos lotes vazios</label>
      <label class="rmopt"><input type="checkbox" id="rmgs" checked> sinalização genérica (sem dados)</label>
      <label class="rmopt">bots <input type="range" id="rmbots" min="0" max="200" value="6" style="width:90px"> <b id="rmbn">6</b></label>
      <button id="rmgen" class="primary">Gerar mapa 3D</button>
      <button id="rmx" class="sm">Cancelar</button>
    </div>
    <div class="rmhelp">Arraste no mapa para desenhar o retângulo da área (até ${MAXSIDE / 1000} km de lado — o jogo carrega só 2 km ao redor do carro e vai carregando mais conforme você dirige). Clique em <b>📍 Ponto de partida</b> e depois no mapa para escolher onde começar. Dados: © OpenStreetMap, elevação AWS Terrain — gratuito, sem chave.</div>
    <div id="rmmap"></div><div id="rmstat"></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s), stat = t => { $('#rmstat').textContent = t; $('#rmstat').style.display = t ? 'block' : 'none'; };
  $('#rmx').onclick = () => root.remove();
  $('#rmbots').value = app.opt.bots; $('#rmbn').textContent = app.opt.bots; $('#rmbots').oninput = () => { $('#rmbn').textContent = $('#rmbots').value; app.opt.bots = +$('#rmbots').value; };
  try { await loadLeaflet(); } catch (e) { stat(e.message); return; }
  const L = window.L;
  const map = L.map('rmmap', { zoomControl: true }).setView([-23.5614, -46.6559], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  let rect = null, drawing = false, a = null, name = 'área escolhida', pin = null, pinning = false;
  const dims = b => { const lat0 = (b.getSouth() + b.getNorth()) / 2; return [(b.getEast() - b.getWest()) * 111320 * Math.cos(lat0 * Math.PI / 180), (b.getNorth() - b.getSouth()) * 110574]; };
  const setPin = ll => { if (pin) pin.setLatLng(ll); else { pin = L.marker(ll, { draggable: true }).addTo(map); } };
  const centerPin = () => { const b = rect.getBounds(); setPin(b.getCenter()); };
  const show = () => { const [w, h] = dims(rect.getBounds()); $('#rminfo').textContent = `${(w / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} km`; };
  const defRect = () => { const c = map.getCenter(), dLat = 2000 / 110574, dLon = 2000 / (111320 * Math.cos(c.lat * Math.PI / 180)); if (rect) rect.remove(); rect = L.rectangle([[c.lat - dLat, c.lng - dLon], [c.lat + dLat, c.lng + dLon]], { color: '#ff7a1a', weight: 2, fillOpacity: 0.12 }).addTo(map); show(); centerPin(); };
  defRect();
  $('#rmpin').onclick = () => { pinning = true; map.getContainer().style.cursor = 'crosshair'; $('#rminfo').textContent = 'clique no mapa para o ponto de partida'; };
  map.on('click', e => { if (!pinning) return; pinning = false; map.getContainer().style.cursor = ''; setPin(e.latlng); show(); });
  $('#rmdraw').onclick = () => { drawing = true; map.dragging.disable(); map.getContainer().style.cursor = 'crosshair'; $('#rminfo').textContent = 'arraste no mapa…'; };
  map.on('mousedown', e => { if (!drawing) return; a = e.latlng; if (rect) rect.remove(); rect = L.rectangle([a, a], { color: '#ff7a1a', weight: 2, fillOpacity: 0.12 }).addTo(map); });
  map.on('mousemove', e => {
    if (!drawing || !a) return;
    let p = e.latlng; const lat0 = a.lat, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
    const dx = (p.lng - a.lng) * mLon, dz = (p.lat - a.lat) * 110574;
    if (Math.abs(dx) > MAXSIDE) p = L.latLng(p.lat, a.lng + Math.sign(dx) * MAXSIDE / mLon);
    if (Math.abs(dz) > MAXSIDE) p = L.latLng(a.lat + Math.sign(dz) * MAXSIDE / 110574, p.lng);
    rect.setBounds([a, p]); show();
  });
  const end = () => { if (!drawing || !a) return; drawing = false; a = null; map.dragging.enable(); map.getContainer().style.cursor = ''; show(); centerPin(); };
  map.on('mouseup', end); document.addEventListener('mouseup', end);
  const search = async () => {
    const q = $('#rmq').value.trim(); if (!q) return;
    stat('Buscando lugar…');
    try { const r = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q))).json(); if (!r.length) { stat('Lugar não encontrado'); return; } name = r[0].display_name.split(',')[0]; map.setView([+r[0].lat, +r[0].lon], 16); setTimeout(defRect, 300); stat(''); }
    catch (e) { stat('Falha na busca: ' + e.message); }
  };
  $('#rmgo').onclick = search; $('#rmq').addEventListener('keydown', e => { if (e.key === 'Enter') search(); e.stopPropagation(); }); $('#rmq').addEventListener('keyup', e => e.stopPropagation());
  $('#rmgen').onclick = async () => {
    const b = rect.getBounds(); const [w, h] = dims(b);
    if (w < 150 || h < 150) { stat('Área muito pequena (mínimo ~150 m).'); return; }
    const st = pin.getLatLng(); if (!b.contains(st)) { stat('O ponto de partida precisa ficar dentro do retângulo.'); return; }
    $('#rmgen').disabled = true;
    try { const opts = { overture: $('#rmov').checked, generic: $('#rmgn').checked, genericSigns: $('#rmgs').checked };
      app.real = { rect: { s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }, opts, name, lat0: st.lat, lon0: st.lng, mLon: 111320 * Math.cos(st.lat * Math.PI / 180), busy: false };
      const D = await fetchRealData(windowBounds(st.lat, st.lng), stat, name, opts); stat('Construindo o mapa 3D…'); await new Promise(r => setTimeout(r, 50)); document.removeEventListener('mouseup', end); root.remove(); await app.loadRealMap(D); }
    catch (e) { console.error(e); stat('Erro: ' + e.message + ' — tente de novo ou reduza a área.'); $('#rmgen').disabled = false; }
  };
  setTimeout(() => map.invalidateSize(), 100);
}

// cache persistente (IndexedDB, 24 h): repetir uma área é instantâneo e poupa os servidores públicos
const idb = () => new Promise((res, rej) => { try { const r = indexedDB.open('beamdrive-osm', 1); r.onupgradeneeded = () => r.result.createObjectStore('q'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); } });
async function idbGet(k) { try { const db = await idb(); return await new Promise(res => { const g = db.transaction('q').objectStore('q').get(k); g.onsuccess = () => res(g.result); g.onerror = () => res(null); }); } catch (e) { return null; } }
async function idbPut(k, v) { try { const db = await idb(); db.transaction('q', 'readwrite').objectStore('q').put(v, k); } catch (e) { /* sem cache */ } }
async function overpass(q, stat) {
  if (cacheQ.has(q)) return cacheQ.get(q);
  { const c = await idbGet(q); if (c && Date.now() - c.t < 86400000) { stat('Usando dados em cache deste local…'); cacheQ.set(q, c.j); return c.j; } }
  let err;
  for (let round = 1; round <= 3; round++) {
    stat(`Baixando ruas e prédios — tentando ${OVERPASS.length} servidores gratuitos (tentativa ${round}/3)…`);
    const ctls = OVERPASS.map(() => new AbortController());
    const tasks = OVERPASS.map((url, i) => fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctls[i].signal })
      .then(async r => { if (!r.ok) throw new Error(new URL(url).host + ' HTTP ' + r.status); const j = await r.json(); if (!j.elements) throw new Error('resposta vazia'); return j; }));
    const timer = setTimeout(() => ctls.forEach(c => c.abort()), 60000);
    try { const j = await Promise.any(tasks); clearTimeout(timer); ctls.forEach(c => c.abort()); cacheQ.set(q, j); idbPut(q, { t: Date.now(), j }); return j; }
    catch (e) { clearTimeout(timer); err = e.errors ? e.errors.map(x => x.message).join('; ') : e.message; await new Promise(r => setTimeout(r, 2500)); }
  }
  throw new Error('os servidores públicos do OpenStreetMap estão sobrecarregados agora (' + err + '). Tente novamente em alguns minutos ou use uma área menor');
}

async function loadElevation(b, stat) {
  const lat0 = (b.s + b.n) / 2, wide = (b.e - b.w) * 111320 * Math.cos(lat0 * Math.PI / 180), z = wide > 1500 ? 13 : 14;
  const tx = lon => (lon + 180) / 360 * 2 ** z, ty = lat => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
  const x0 = Math.floor(tx(b.w)) - 1, x1 = Math.floor(tx(b.e)) + 1, y0 = Math.floor(ty(b.n)) - 1, y1 = Math.floor(ty(b.s)) + 1;
  const W = (x1 - x0 + 1) * 256, H = (y1 - y0 + 1) * 256;
  if (W * H > 4096 * 4096) throw new Error('área grande demais');
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d', { willReadFrequently: true });
  stat('Baixando relevo…');
  let ok = 0;
  await Promise.all((() => { const ps = []; for (let X = x0; X <= x1; X++) for (let Y = y0; Y <= y1; Y++) ps.push(new Promise(res => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => { g.drawImage(im, (X - x0) * 256, (Y - y0) * 256); ok++; res(); }; im.onerror = () => res(); im.src = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${X}/${Y}.png`; })); return ps; })());
  if (!ok) return null;
  const px = g.getImageData(0, 0, W, H).data, hm = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) hm[i] = ok ? (px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768) : 0;
  return (lat, lon) => {
    const X = clamp((tx(lon) - x0) * 256 - 0.5, 0, W - 1.001), Y = clamp((ty(lat) - y0) * 256 - 0.5, 0, H - 1.001), i = X | 0, j = Y | 0, fx = X - i, fy = Y - j;
    const a = hm[j * W + i], c = hm[j * W + i + 1], d = hm[(j + 1) * W + i], e = hm[(j + 1) * W + i + 1];
    return a + (c - a) * fx + (d - a) * fy + (a - c - d + e) * fx * fy;
  };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

export function windowBounds(lat, lon) {
  const dLat = WIN / 110574, dLon = WIN / (111320 * Math.cos(lat * Math.PI / 180));
  return { s: lat - dLat, n: lat + dLat, w: lon - dLon, e: lon + dLon };
}

// carregamento contínuo: quando o carro se afasta do centro da janela de 2 km, carrega a próxima janela e troca
export function streamTick(app) {
  const R = app.real, D = app.realData, v = app.veh;
  if (!R || !D || !D.geo || app.mapId !== 'real' || R.busy || performance.now() < (R.retry || 0)) return;
  const G = D.geo, x = v.pos.x, z = v.pos.z;
  if (Math.max(Math.abs(x), Math.abs(z)) < 250) return;
  const px = x + v.vel.x * 10, pz = z + v.vel.z * 10;
  const lat = G.lat0 - pz / G.mLat, lon = G.lon0 + px / G.mLon;
  const gi = Math.round((lon - R.lon0) * R.mLon / STEP), gj = Math.round((lat - R.lat0) * 110574 / STEP);
  const cLat = R.lat0 + gj * STEP / 110574, cLon = R.lon0 + gi * STEP / R.mLon;
  if (Math.abs(cLat - G.lat0) < 1e-7 && Math.abs(cLon - G.lon0) < 1e-7) return;
  const r = R.rect;
  if (!(cLat > r.s && cLat < r.n && cLon > r.w && cLon < r.e)) { if (!R.edgeToast || performance.now() - R.edgeToast > 20000) { R.edgeToast = performance.now(); app.toast('Limite da área escolhida'); } return; }
  R.busy = true; app.toast('Carregando a região à frente…', 2500);
  (async () => {
    try { const D2 = await fetchRealData(windowBounds(cLat, cLon), () => {}, R.name, R.opts); await app.swapRealWorld(D2); }
    catch (e) { console.warn('stream:', e); R.retry = performance.now() + 15000; app.toast('Não foi possível carregar a próxima região (tentando de novo)…'); }
    R.busy = false;
  })();
}

export async function fetchRealData(b, stat, name, opts = {}) {
  const lat0 = (b.s + b.n) / 2, lon0 = (b.w + b.e) / 2, mLat = 110574, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const P = g => [(g.lon - lon0) * mLon, (lat0 - g.lat) * mLat];
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  const q = `[out:json][timeout:40];(way["highway"](${bb});node["highway"~"traffic_signals|stop|give_way|crossing|street_lamp|bus_stop|speed_camera"](${bb});node["traffic_sign"](${bb});node["traffic_calming"](${bb});node["hazard"](${bb});node["railway"~"level_crossing|crossing"](${bb});node["amenity"~"^(hospital|fuel|parking|taxi|charging_station|police)$"](${bb});way["building"](${bb});relation["building"](${bb});node["natural"="tree"](${bb});way["natural"~"water|wood|scrub|grassland|sand|beach"](${bb});way["waterway"~"river|stream|canal|riverbank"](${bb});way["leisure"~"park|garden|pitch|playground|golf_course"](${bb});way["landuse"~"grass|forest|meadow|recreation_ground|village_green"](${bb}););out geom;`;
  const j = await overpass(q, stat);
  const D = { roads: [], buildings: [], waters: [], greens: [], trees: [], nodes: [], name, size: { w: (b.e - b.w) * mLon, h: (b.n - b.s) * mLat } };
  const bh = (t, id) => { let h = parseFloat(t.height); if (isNaN(h)) { const lv = parseFloat(t['building:levels']); h = !isNaN(lv) ? lv * 3.2 + 1 : 6 + (id % 7); } return clamp(h, 3, 250); };
  for (const el of j.elements) {
    if (el.type === 'node' && el.tags && el.tags.natural === 'tree') { D.trees.push(P(el)); continue; }
    if (el.type === 'node' && el.tags && (el.tags.highway || el.tags.traffic_sign || el.tags.traffic_calming || el.tags.hazard || el.tags.railway || el.tags.amenity)) { const q = P(el); D.nodes.push({ id: el.id, k: el.tags.highway || (el.tags.traffic_calming ? 'calming' : el.tags.hazard ? 'hazard' : el.tags.railway ? 'railway' : el.tags.traffic_sign ? 'sign' : 'amenity'), tags: el.tags, x: q[0], z: q[1] }); continue; }
    if (el.type === 'relation' && el.tags && el.tags.building && el.members) {
      for (const m of el.members) if (m.role === 'outer' && m.geometry && m.geometry.length > 3) D.buildings.push({ pts: m.geometry.map(P), h: bh(el.tags, el.id) });
      continue;
    }
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags || {}, pts = el.geometry.map(P), closed = el.geometry.length > 3 && el.nodes && el.nodes[0] === el.nodes[el.nodes.length - 1];
    if (t.highway) {
      if (DRIVEW[t.highway]) { let w = DRIVEW[t.highway]; if (t.width && !isNaN(parseFloat(t.width))) w = clamp(parseFloat(t.width), 2.2, 20); else if (t.lanes) w = clamp(+t.lanes * 3.2, 3, 20); D.roads.push({ type: t.highway, w, pts, ids: el.nodes, name: t.name || t.ref || '', ms: parseInt(t.maxspeed) || 0, oneway: t.oneway === 'yes' || t.oneway === '1' }); }
      else if (OFFW[t.highway]) D.roads.push({ type: t.highway, w: OFFW[t.highway], pts, off: true });
    } else if (t.building) {
      if (closed || pts.length > 3) D.buildings.push({ pts, h: bh(t, el.id) });
    } else if (t.waterway) {
      if (t.waterway === 'riverbank' && closed) D.waters.push({ poly: true, pts }); else D.waters.push({ w: t.waterway === 'river' ? 12 : t.waterway === 'canal' ? 8 : 3, pts });
    } else if (t.natural === 'water' && closed) D.waters.push({ poly: true, pts });
    else if (closed) D.greens.push({ pts, kind: t.natural === 'sand' || t.natural === 'beach' ? 'sand' : (t.natural === 'wood' || t.landuse === 'forest') ? 'forest' : 'grass' });
  }
  const nOsm = D.buildings.length; let nOv = 0;
  if (opts.overture !== false) {
    try {
      const { fetchOvertureBuildings } = await import('./overture.js');
      const ov = await fetchOvertureBuildings(b, P, stat);
      const cell = 60, grid = new Map(), cen = pts => { let x = 0, z = 0; for (const p of pts) { x += p[0]; z += p[1]; } return [x / pts.length, z / pts.length]; };
      const inP = (x, z, p) => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, zi] = p[i], [xj, zj] = p[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
      for (const o of D.buildings) { o.c = cen(o.pts); const k = Math.floor(o.c[0] / cell) + ',' + Math.floor(o.c[1] / cell); (grid.get(k) || grid.set(k, []).get(k)).push(o); }
      for (const n of ov) {
        const c = cen(n.pts); let dup = false;
        for (let dx = -1; dx <= 1 && !dup; dx++) for (let dz = -1; dz <= 1 && !dup; dz++) { const a = grid.get((Math.floor(c[0] / cell) + dx) + ',' + (Math.floor(c[1] / cell) + dz)); if (a) for (const o of a) if (inP(c[0], c[1], o.pts) || inP(o.c[0], o.c[1], n.pts)) { dup = true; break; } }
        if (!dup) { D.buildings.push(n); nOv++; }
      }
    } catch (e) { console.warn('Overture:', e); stat('Overture Maps indisponível agora — seguindo só com OpenStreetMap…'); await new Promise(r => setTimeout(r, 1200)); }
  }
  D.geo = { lat0, lon0, mLat, mLon };
  D.opts = opts; D.stats = { osm: nOsm, overture: nOv };
  stat(`Dados: ${D.roads.length} ruas, ${nOsm} prédios do OpenStreetMap + ${nOv} do Overture, ${D.trees.length} árvores. Baixando relevo…`);
  let elev = null;
  try { elev = await loadElevation(b, stat); } catch (e) { console.warn('relevo:', e); }
  const f = elev || (() => 0);
  let lo = 1e9; for (let i = 0; i < 25; i++) for (let k = 0; k < 25; k++) lo = Math.min(lo, f(b.s + (b.n - b.s) * i / 24, b.w + (b.e - b.w) * k / 24));
  const c0 = f(lat0, lon0);
  D.base = elev ? c0 : 0;
  D.elev = (x, z) => elev ? f(lat0 - z / mLat, lon0 + x / mLon) : 0;
  D.hasElev = !!elev;
  return D;
}
const DRIVEW = { motorway: 7, motorway_link: 5, trunk: 7, trunk_link: 5, primary: 5.5, primary_link: 4, secondary: 5, secondary_link: 4, tertiary: 4.5, tertiary_link: 3.5, residential: 3.8, unclassified: 3.8, living_street: 3.2, service: 2.6, road: 3.5 };
const OFFW = { track: 2.4, path: 1.0, cycleway: 1.3, footway: 1.0, pedestrian: 3.0 };
