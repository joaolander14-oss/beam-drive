// Footprints de construções do Overture Maps (Microsoft/Google/OSM) via PMTiles — gratuito, sem chave.
const RELEASES = ['2026-11-18.0', '2026-10-21.0', '2026-09-23.0', '2026-08-20.0'];
let libP;

function loadLibs() {
  return libP || (libP = (async () => {
    await new Promise((res, rej) => { if (window.pmtiles) return res(); const s = document.createElement('script'); s.src = 'https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js'; s.onload = res; s.onerror = () => rej(new Error('biblioteca pmtiles indisponível')); document.head.append(s); });
    const Pbf = (await import('https://esm.sh/pbf@3.2.1')).default;
    const vt = await import('https://esm.sh/@mapbox/vector-tile@1.3.1');
    return { PMTiles: window.pmtiles.PMTiles, Pbf, VectorTile: vt.VectorTile || vt.default.VectorTile };
  })().catch(e => { libP = null; throw e; }));
}

const area = pts => { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]); return Math.abs(a / 2); };

export async function fetchOvertureBuildings(b, P, stat) {
  const { PMTiles, Pbf, VectorTile } = await loadLibs();
  let pm = null, header = null, last = '';
  for (const rel of RELEASES) {
    try { const p = new PMTiles(`https://tiles.overturemaps.org/${rel}/buildings.pmtiles`); header = await p.getHeader(); pm = p; break; } catch (e) { last = e.message; }
  }
  if (!pm) throw new Error('Overture indisponível (' + last + ')');
  const z = Math.min(14, header.maxZoom || 14);
  const tx = lon => (lon + 180) / 360 * 2 ** z, ty = lat => (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2 * 2 ** z;
  const x0 = Math.floor(tx(b.w)), x1 = Math.floor(tx(b.e)), y0 = Math.floor(ty(b.n)), y1 = Math.floor(ty(b.s));
  const out = [], seen = new Set();
  for (let X = x0; X <= x1; X++) for (let Y = y0; Y <= y1; Y++) {
    stat(`Baixando casas do Overture Maps (tile ${(X - x0) * (y1 - y0 + 1) + (Y - y0) + 1}/${(x1 - x0 + 1) * (y1 - y0 + 1)})…`);
    const res = await pm.getZxy(z, X, Y); if (!res) continue;
    const tile = new VectorTile(new Pbf(new Uint8Array(res.data)));
    const layer = tile.layers.building || tile.layers.buildings || Object.values(tile.layers)[0]; if (!layer) continue;
    for (let i = 0; i < layer.length; i++) {
      const f = layer.feature(i), gj = f.toGeoJSON(X, Y, z), g = gj.geometry; if (!g) continue;
      const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      const pr = f.properties || {};
      for (const poly of polys) {
        const ring = poly[0]; if (!ring || ring.length < 4) continue;
        let cLon = 0, cLat = 0; for (const [lo, la] of ring) { cLon += lo; cLat += la; } cLon /= ring.length; cLat /= ring.length;
        if (cLon < b.w || cLon > b.e || cLat < b.s || cLat > b.n) continue;
        const key = (pr.id || '') + ring[0][0].toFixed(6) + ring[0][1].toFixed(6); if (seen.has(key)) continue; seen.add(key);
        const pts = ring.map(([lo, la]) => P({ lat: la, lon: lo }));
        let h = parseFloat(pr.height); if (isNaN(h)) { const fl = parseFloat(pr.num_floors); h = !isNaN(fl) ? fl * 3.2 + 1 : 0; }
        const A = area(pts); if (A < 12) continue;
        if (!h) h = A < 300 ? 3.4 + (Math.abs(Math.round(cLon * 1e5)) % 14) / 10 : A < 900 ? 6 + (Math.abs(Math.round(cLat * 1e5)) % 30) / 10 : 10;
        out.push({ pts, h: Math.max(3, Math.min(250, h)), ov: true });
      }
    }
  }
  return out;
}
