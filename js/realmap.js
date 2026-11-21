// Seletor de área (Leaflet + OpenStreetMap) e busca de dados gratuitos (Overpass + elevação AWS Terrain)
const MAXSIDE = 2000;   // metros
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
      <span id="rminfo" class="hint"></span>
      <button id="rmgen" class="primary">Gerar mapa 3D</button>
      <button id="rmx" class="sm">Cancelar</button>
    </div>
    <div class="rmhelp">Arraste no mapa para desenhar o retângulo da área (máx. ${MAXSIDE / 1000} km de lado). Dados: © OpenStreetMap, elevação AWS Terrain — gratuito, sem chave.</div>
    <div id="rmmap"></div><div id="rmstat"></div>`;
  document.body.append(root);
  const $ = s => root.querySelector(s), stat = t => { $('#rmstat').textContent = t; $('#rmstat').style.display = t ? 'block' : 'none'; };
  $('#rmx').onclick = () => root.remove();
  try { await loadLeaflet(); } catch (e) { stat(e.message); return; }
  const L = window.L;
  const map = L.map('rmmap', { zoomControl: true }).setView([-23.5614, -46.6559], 15);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  let rect = null, drawing = false, a = null, name = 'área escolhida';
  const dims = b => { const lat0 = (b.getSouth() + b.getNorth()) / 2; return [(b.getEast() - b.getWest()) * 111320 * Math.cos(lat0 * Math.PI / 180), (b.getNorth() - b.getSouth()) * 110574]; };
  const show = () => { const [w, h] = dims(rect.getBounds()); $('#rminfo').textContent = `${(w / 1000).toFixed(2)} × ${(h / 1000).toFixed(2)} km`; };
  const defRect = () => { const c = map.getCenter(), dLat = 450 / 110574, dLon = 450 / (111320 * Math.cos(c.lat * Math.PI / 180)); if (rect) rect.remove(); rect = L.rectangle([[c.lat - dLat, c.lng - dLon], [c.lat + dLat, c.lng + dLon]], { color: '#ff7a1a', weight: 2, fillOpacity: 0.12 }).addTo(map); show(); };
  defRect();
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
  const end = () => { if (!drawing || !a) return; drawing = false; a = null; map.dragging.enable(); map.getContainer().style.cursor = ''; show(); };
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
    $('#rmgen').disabled = true;
    try { const D = await fetchRealData({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() }, stat, name); stat('Construindo o mapa 3D…'); await new Promise(r => setTimeout(r, 50)); document.removeEventListener('mouseup', end); root.remove(); await app.loadRealMap(D); }
    catch (e) { console.error(e); stat('Erro: ' + e.message + ' — tente de novo ou reduza a área.'); $('#rmgen').disabled = false; }
  };
  setTimeout(() => map.invalidateSize(), 100);
}

async function overpass(q, stat) {
  if (cacheQ.has(q)) return cacheQ.get(q);
  let err;
  for (let round = 1; round <= 3; round++) {
    stat(`Baixando ruas e prédios — tentando ${OVERPASS.length} servidores gratuitos (tentativa ${round}/3)…`);
    const ctls = OVERPASS.map(() => new AbortController());
    const tasks = OVERPASS.map((url, i) => fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctls[i].signal })
      .then(async r => { if (!r.ok) throw new Error(new URL(url).host + ' HTTP ' + r.status); const j = await r.json(); if (!j.elements) throw new Error('resposta vazia'); return j; }));
    const timer = setTimeout(() => ctls.forEach(c => c.abort()), 60000);
    try { const j = await Promise.any(tasks); clearTimeout(timer); ctls.forEach(c => c.abort()); cacheQ.set(q, j); return j; }
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

export async function fetchRealData(b, stat, name) {
  const lat0 = (b.s + b.n) / 2, lon0 = (b.w + b.e) / 2, mLat = 110574, mLon = 111320 * Math.cos(lat0 * Math.PI / 180);
  const P = g => [(g.lon - lon0) * mLon, (lat0 - g.lat) * mLat];
  const bb = `${b.s},${b.w},${b.n},${b.e}`;
  const q = `[out:json][timeout:40];(way["highway"](${bb});way["building"](${bb});way["natural"~"water|wood|scrub|grassland|sand|beach"](${bb});way["waterway"~"river|stream|canal|riverbank"](${bb});way["leisure"~"park|garden|pitch|playground|golf_course"](${bb});way["landuse"~"grass|forest|meadow|recreation_ground|village_green"](${bb}););out geom tags;`;
  const j = await overpass(q, stat);
  const D = { roads: [], buildings: [], waters: [], greens: [], name, size: { w: (b.e - b.w) * mLon, h: (b.n - b.s) * mLat } };
  for (const el of j.elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 2) continue;
    const t = el.tags || {}, pts = el.geometry.map(P), closed = el.geometry.length > 3 && el.nodes && el.nodes[0] === el.nodes[el.nodes.length - 1];
    if (t.highway) {
      if (DRIVEW[t.highway]) { let w = DRIVEW[t.highway]; if (t.width && !isNaN(parseFloat(t.width))) w = clamp(parseFloat(t.width), 2.2, 20); else if (t.lanes) w = clamp(+t.lanes * 3.2, 3, 20); D.roads.push({ type: t.highway, w, pts }); }
      else if (OFFW[t.highway]) D.roads.push({ type: t.highway, w: OFFW[t.highway], pts, off: true });
    } else if (t.building) {
      let h = parseFloat(t.height); if (isNaN(h)) { const lv = parseFloat(t['building:levels']); h = !isNaN(lv) ? lv * 3.2 + 1 : 7 + (el.id % 7); }
      if (closed || pts.length > 3) D.buildings.push({ pts, h: clamp(h, 3, 250) });
    } else if (t.waterway) {
      if (t.waterway === 'riverbank' && closed) D.waters.push({ poly: true, pts }); else D.waters.push({ w: t.waterway === 'river' ? 12 : t.waterway === 'canal' ? 8 : 3, pts });
    } else if (t.natural === 'water' && closed) D.waters.push({ poly: true, pts });
    else if (closed) D.greens.push({ pts, kind: t.natural === 'sand' || t.natural === 'beach' ? 'sand' : (t.natural === 'wood' || t.landuse === 'forest') ? 'forest' : 'grass' });
  }
  stat(`Dados: ${D.roads.length} ruas, ${D.buildings.length} prédios. Baixando relevo…`);
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
