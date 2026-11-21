// Menus: escolha de carro, garagem de customização, mapas, opções, ajuda
import { CARS, ENGINES, GEARBOXES, DIFFS, CENTER_DIFFS, COMPOUNDS, BRAKES, SUSP_PRESETS, WHEEL_STYLES, MAPS, TIMES, tireDims, HP } from './data.js';
import { defaultCfg, buildSpec, WING_STYLES, SPLITTERS } from './spec.js';
import { quickPerf, engTorqueWOT } from './physics.js';
import { CATS, CAT_GROUPS, countOptions } from './catalog.js';

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const fmt = (v, d = 0) => Number(v).toFixed(d);

// ---------- definição dos controles da garagem ----------
const ENG_OPTS = () => Object.entries(ENGINES).map(([id, e]) => [id, `${e.name} — ${fmt(e.peakHp)} cv · ${fmt(e.peakTq)} Nm`]);
const GB_OPTS = () => Object.entries(GEARBOXES).map(([id, g]) => [id, `${g.name} (${g.r.length} marcha${g.r.length > 1 ? 's' : ''})`]);
const tireSel = (axle) => [
  { t: 'range', label: 'Largura', min: 135, max: 355, step: 10, get: c => c[axle][0], set: (c, v) => c[axle][0] = +v, fmt: v => v + ' mm' },
  { t: 'range', label: 'Perfil (altura do flanco)', min: 25, max: 85, step: 5, get: c => c[axle][1], set: (c, v) => c[axle][1] = +v, fmt: v => v + ' %' },
  { t: 'range', label: 'Diâmetro do aro', min: 13, max: 24, step: 1, get: c => c[axle][2], set: (c, v) => c[axle][2] = +v, fmt: v => v + '"' },
];

export const GARAGE = [
  { id: 'motor', name: '⚙ Motor', items: [
    { k: 'eng', t: 'select', label: 'Motor (swap)', hint: 'Troque por qualquer motor real: muda peso, curva de torque e som', opts: ENG_OPTS },
    { k: 'tune', t: 'select', label: 'Preparação', opts: [[0, 'Original'], [1, 'Estágio 1 — ECU + filtro (+5%)'], [2, 'Estágio 2 — escape + comando (+11%)'], [3, 'Estágio 3 — internos forjados (+18%)']] },
    { k: 'boost', t: 'range', label: 'Pressão do turbo', min: 0.5, max: 1.8, step: 0.05, show: c => !!ENGINES[c.eng].boost, fmt: (v, c) => (ENGINES[c.eng].boost.bar * v).toFixed(2) + ' bar' },
    { k: 'fly', t: 'range', label: 'Inércia do volante', hint: 'Menor = gira mais rápido, mais nervoso', min: 0.4, max: 2.0, step: 0.05, fmt: v => '×' + v.toFixed(2) },
    { k: 'nitro', t: 'check', label: 'Sistema de nitro (N₂O)', hint: 'Tecla N: +32% de torque por ~12 s' },
  ] },
  { id: 'trans', name: '⛓ Transmissão', items: [
    { k: 'gb', t: 'select', label: 'Caixa de câmbio', opts: GB_OPTS },
    { k: 'fin', t: 'range', label: 'Relação final (diferencial)', hint: 'Maior = acelera mais, velocidade final menor', min: 2.0, max: 6.0, step: 0.01, show: c => !GEARBOXES[c.gb].type.startsWith('ev') || true, fmt: v => v.toFixed(2) },
    { k: 'lowRange', t: 'check', label: 'Reduzida (low range)', hint: 'Multiplica as marchas por 2,6 para off-road' },
    { k: 'trans', t: 'select', label: 'Modo de câmbio', hint: 'Em manual use E / Q para trocar', opts: [['auto', 'Automático'], ['manual', 'Manual (sequencial E/Q)']] },
  ] },
  { id: 'drive', name: '⚖ Tração', items: [
    { k: 'drive', t: 'select', label: 'Layout de tração', opts: [['fwd', 'Dianteira (FWD)'], ['rwd', 'Traseira (RWD)'], ['awd', 'Integral (AWD / 4x4)']] },
    { k: 'cf', t: 'range', label: 'Distribuição de torque (% frente)', min: 0, max: 1, step: 0.05, show: c => c.drive === 'awd', fmt: v => Math.round(v * 100) + ' / ' + Math.round((1 - v) * 100) },
    { k: 'dc', t: 'select', label: 'Diferencial central', show: c => c.drive === 'awd', opts: () => Object.entries(CENTER_DIFFS).map(([k, d]) => [k, d.name]) },
    { k: 'dif', t: 'select', label: 'Diferencial dianteiro', show: c => c.drive !== 'rwd', opts: () => Object.entries(DIFFS).map(([k, d]) => [k, d.name]) },
    { k: 'dir', t: 'select', label: 'Diferencial traseiro', show: c => c.drive !== 'fwd', opts: () => Object.entries(DIFFS).map(([k, d]) => [k, d.name]) },
  ] },
  { id: 'wheels', name: '◎ Rodas & Pneus', items: [
    { t: 'sec', label: 'Estilo' },
    { k: 'wheel', t: 'select', label: 'Modelo de roda', opts: () => Object.entries(WHEEL_STYLES).map(([k, w]) => [k, w.name]) },
    { k: 'rimColor', t: 'color', label: 'Cor da roda' },
    { t: 'sec', label: 'Eixo dianteiro' },
    ...tireSel('tf'),
    { k: 'compF', t: 'select', label: 'Composto', opts: () => Object.entries(COMPOUNDS).map(([k, c]) => [k, c.name]) },
    { k: 'pF', t: 'range', label: 'Pressão', min: 1.0, max: 3.2, step: 0.1, fmt: v => v.toFixed(1) + ' bar' },
    { k: 'spF', t: 'range', label: 'Espaçador (alarga a bitola)', min: 0, max: 50, step: 5, fmt: v => v + ' mm' },
    { t: 'sec', label: 'Eixo traseiro' },
    ...tireSel('tr'),
    { k: 'compR', t: 'select', label: 'Composto', opts: () => Object.entries(COMPOUNDS).map(([k, c]) => [k, c.name]) },
    { k: 'pR', t: 'range', label: 'Pressão', min: 1.0, max: 3.2, step: 0.1, fmt: v => v.toFixed(1) + ' bar' },
    { k: 'spR', t: 'range', label: 'Espaçador (alarga a bitola)', min: 0, max: 50, step: 5, fmt: v => v + ' mm' },
    { t: 'btn', label: 'Copiar medida dianteira para a traseira', act: 'copyTire' },
  ] },
  { id: 'susp', name: '≋ Suspensão', items: [
    { k: '_preset', t: 'select', label: 'Pacote pronto', opts: () => [['', '— escolher para aplicar —'], ...Object.entries(SUSP_PRESETS).map(([k, p]) => [k, p.name])] },
    { k: 'rh', t: 'range', label: 'Altura da carroceria', hint: 'Negativo = rebaixado · positivo = lift', min: -100, max: 140, step: 5, fmt: v => (v > 0 ? '+' : '') + v + ' mm' },
    { k: 'kF', t: 'range', label: 'Mola dianteira', min: 8, max: 130, step: 1, fmt: v => v + ' N/mm' },
    { k: 'kR', t: 'range', label: 'Mola traseira', min: 8, max: 130, step: 1, fmt: v => v + ' N/mm' },
    { k: 'bF', t: 'range', label: 'Barra estabilizadora diant.', min: 0, max: 90, step: 1, fmt: v => v + ' N/mm' },
    { k: 'bR', t: 'range', label: 'Barra estabilizadora tras.', min: 0, max: 90, step: 1, fmt: v => v + ' N/mm' },
    { k: 'zb', t: 'range', label: 'Amortecedor — compressão', min: 0.1, max: 1.0, step: 0.02, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'zr', t: 'range', label: 'Amortecedor — retorno', min: 0.1, max: 1.2, step: 0.02, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'camF', t: 'range', label: 'Cambagem dianteira', min: -5, max: 2, step: 0.1, fmt: v => v.toFixed(1) + '°' },
    { k: 'camR', t: 'range', label: 'Cambagem traseira', min: -5, max: 2, step: 0.1, fmt: v => v.toFixed(1) + '°' },
    { k: 'toeF', t: 'range', label: 'Convergência dianteira', min: -0.6, max: 0.6, step: 0.02, fmt: v => v.toFixed(2) + '°' },
    { k: 'toeR', t: 'range', label: 'Convergência traseira', min: -0.6, max: 0.6, step: 0.02, fmt: v => v.toFixed(2) + '°' },
    { k: 'ack', t: 'range', label: 'Ackermann', hint: '0 = paralelo (drift) · 100% = geometria pura', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
  ] },
  { id: 'brakes', name: '⛔ Freios & Assistências', items: [
    { k: 'brk', t: 'select', label: 'Sistema de freios', opts: () => Object.entries(BRAKES).map(([k, b]) => [k, b.name]) },
    { k: 'bias', t: 'range', label: 'Distribuição de frenagem (frente)', min: 0.4, max: 0.85, step: 0.01, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'abs', t: 'check', label: 'ABS' },
    { k: 'tc', t: 'check', label: 'Controle de tração (TC)' },
    { k: 'esc', t: 'check', label: 'Controle de estabilidade (ESC)' },
    { k: 'steerAssist', t: 'select', label: 'Assistência de direção', hint: 'Reduz o esterço em alta velocidade (útil no teclado)', opts: [[0, 'Desligada (esterço total)'], [1, 'Média'], [2, 'Forte']] },
  ] },
  { id: 'aero', name: '✈ Aerodinâmica', items: [
    { k: 'splitter', t: 'select', label: 'Dianteira', opts: () => Object.entries(SPLITTERS).map(([k, w]) => [k, w.name]) },
    { k: 'wing', t: 'select', label: 'Aerofólio traseiro', opts: () => Object.entries(WING_STYLES).map(([k, w]) => [k, w.name]) },
    { k: 'wingAng', t: 'range', label: 'Ângulo do aerofólio', hint: 'Mais ângulo = mais downforce e mais arrasto', min: 0, max: 1, step: 0.05, show: c => c.wing === 'gt' || c.wing === 'big', fmt: v => Math.round(v * 100) + ' %' },
    { k: 'diffuser', t: 'check', label: 'Difusor traseiro' },
  ] },
  { id: 'weight', name: '⚖ Peso', items: [
    { k: 'ballast', t: 'range', label: 'Lastro', min: 0, max: 200, step: 5, fmt: v => v + ' kg' },
    { k: 'ballastPos', t: 'range', label: 'Posição do lastro', hint: '-100 = ponta dianteira · +100 = traseira', min: -1, max: 1, step: 0.1, fmt: v => Math.round(v * 100) },
    { k: 'lighten', t: 'range', label: 'Redução de peso', hint: 'Retirar bancos traseiros, isolamento, etc.', min: 0, max: 160, step: 5, fmt: v => '−' + v + ' kg' },
  ] },
  { id: 'body', name: '🎨 Visual', items: [
    { k: 'paint', t: 'color', label: 'Cor da pintura' },
    { k: 'finish', t: 'select', label: 'Acabamento', opts: [['gloss', 'Brilhante'], ['metal', 'Metálico'], ['pearl', 'Perolado'], ['satin', 'Acetinado'], ['matte', 'Fosco']] },
    { k: 'tint', t: 'range', label: 'Película dos vidros', min: 0, max: 1, step: 0.05, fmt: v => Math.round(v * 100) + ' %' },
    { k: 'widebody', t: 'check', label: 'Kit widebody (paralamas largos)' },
    { k: 'scoop', t: 'check', label: 'Entrada de ar no capô' },
    { k: 'lightbar', t: 'check', label: 'Barra de LED no teto' },
  ] },
];

// ---------------------------------------------------------------
export class UI {
  constructor(app) { this.app = app; this.tab = 'car'; this.gtab = 'motor'; }

  init() {
    this.menu = $('#menu');
    $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setTab(b.dataset.t); });
    $('#btnPlay').addEventListener('click', () => this.app.closeMenu());
    this.renderCars(); this.renderMaps(); this.renderOpt(); this.renderHelp(); this.buildGarageTabs();
  }
  open(tab) { this.menu.classList.remove('hidden'); if (tab) this.setTab(tab); this.refreshAll(); }
  close() { this.menu.classList.add('hidden'); }
  setTab(t) {
    this.tab = t;
    for (const b of document.querySelectorAll('#tabs button')) b.classList.toggle('on', b.dataset.t === t);
    for (const p of document.querySelectorAll('.pane')) p.classList.toggle('hidden', p.id !== 'p-' + t);
    if (t === 'garage') this.renderGarage();
    this.app.onTab && this.app.onTab(t);
  }
  refreshAll() { this.renderCars(); if (this.tab === 'garage') this.renderGarage(); this.renderMaps(); }

  // ---------- carros ----------
  renderCars() {
    const p = $('#p-car'); const F = this.carFilter || (this.carFilter = { q: '', cls: '', sort: 'name' });
    p.innerHTML = '';
    const ids = Object.keys(CARS), classes = [...new Set(ids.map(i => CARS[i].cls))].sort();
    const bar = el('div', 'row2');
    const q = el('input'); q.type = 'text'; q.placeholder = `Buscar entre ${ids.length} carros…`; q.value = F.q; q.style.minWidth = '220px';
    const cs = el('select'); cs.innerHTML = '<option value="">Todas as classes</option>' + classes.map(c => `<option value="${c}"${F.cls === c ? ' selected' : ''}>${c}</option>`).join('');
    const so = el('select'); so.innerHTML = [['name', 'Ordem alfabética'], ['hp', 'Mais potentes'], ['mass', 'Mais leves'], ['fast', 'Mais rápidos (0–100)']].map(([k, v]) => `<option value="${k}"${F.sort === k ? ' selected' : ''}>${v}</option>`).join('');
    bar.append(q, cs, so, el('span', 'hint', `${ids.length} modelos prontos · cada um com ficha técnica, motor, câmbio e suspensão próprios`));
    p.append(bar);
    const grid = el('div', 'cards'); p.append(grid);
    const draw = () => {
      F.q = q.value; F.cls = cs.value; F.sort = so.value;
      grid.innerHTML = '';
      let list = ids.filter(id => (!F.cls || CARS[id].cls === F.cls) && (!F.q || (CARS[id].name + ' ' + CARS[id].cls).toLowerCase().includes(F.q.toLowerCase())));
      const hp = id => ENGINES[CARS[id].eng].peakHp;
      list.sort((a, b) => F.sort === 'hp' ? hp(b) - hp(a) : F.sort === 'mass' ? CARS[a].mass - CARS[b].mass : F.sort === 'fast' ? hp(b) / CARS[b].mass - hp(a) / CARS[a].mass : CARS[a].name.localeCompare(CARS[b].name));
      const cache = (this.perfCache ||= {});
      const todo = [];
      for (const id of list) {
        const c = CARS[id], e = ENGINES[c.eng];
        const d = el('div', 'card' + (this.app.cfg.car === id ? ' sel' : ''));
        const kind = e.kind === 'ev' ? 'Elétrico' : e.kind === 'turbo' ? 'Turbo' : e.kind === 'sc' ? 'Supercharger' : e.kind === 'diesel' ? 'Diesel' : 'Aspirado';
        d.innerHTML = `<div class="sw" style="background:${c.color}"></div><h3>${c.name}</h3><div class="sub">${c.sub}</div>
          <div><span class="tag">${c.cls}</span><span class="tag">${c.drive.toUpperCase()}</span><span class="tag">${kind}</span></div>
          <div class="stats"><div><b>${fmt(e.peakHp)}</b><span>${e.kind === 'ev' ? 'cv (pico)' : 'cv'}</span></div><div><b>${fmt(c.mass + 75)}</b><span>kg</span></div><div><b class="t100">${cache[id] ? cache[id] : '…'}</b><span>0–100 s</span></div></div>`;
        d.onclick = () => { this.app.selectCar(id); draw(); };
        grid.append(d);
        if (!cache[id]) todo.push([id, d]);
      }
      const step = () => {
        const t0 = performance.now();
        while (todo.length && performance.now() - t0 < 12) { const [id, d] = todo.shift(); const pf = quickPerf(buildSpec(defaultCfg(id))); cache[id] = pf.t100 ? pf.t100.toFixed(1) : '—'; const b = d.querySelector('.t100'); if (b) b.textContent = cache[id]; }
        if (todo.length) setTimeout(step, 0);
      };
      clearTimeout(this._perfT); this._perfT = setTimeout(step, 0);
    };
    q.oninput = draw; cs.onchange = draw; so.onchange = draw; draw();
  }

  renderMaps() {
    const p = $('#p-map'); p.innerHTML = '';
    p.append(el('div', 'hint', 'Mapas pequenos, pensados para testar os veículos.'));
    { const row = el('div', 'row2'); const lab = el('label', '', '🚗 Tráfego de bots: <b id="botn">' + this.app.opt.bots + '</b>'); const r = el('input'); r.type = 'range'; r.min = 0; r.max = 40; r.value = this.app.opt.bots; r.style.maxWidth = '260px';
      r.oninput = () => { $('#botn').textContent = r.value; }; r.onchange = () => this.app.setBots(+r.value);
      row.append(lab, r, el('span', 'hint', 'Os bots dirigem pelas ruas, mantêm a direita, respeitam semáforos, PARE, preferencial e limites de velocidade, e batem de verdade.')); p.append(row); }
    const g = el('div', 'cards');
    for (const [id, m] of Object.entries(MAPS)) {
      const d = el('div', 'card' + (this.app.mapId === id ? ' sel' : ''), `<h3>${m.name}</h3><div class="sub">${m.desc}</div>`);
      d.onclick = () => { if (id === 'real') { this.app.openRealPicker(); return; } this.app.loadMap(id).then(() => this.renderMaps()); };
      g.append(d);
    }
    p.append(g);
  }

  renderOpt() {
    const p = $('#p-opt'); p.innerHTML = '';
    const o = this.app.opt;
    const grid = el('div', 'opt');
    const row = (label, node) => { grid.append(el('label', '', label), node); };
    const sel = (opts, val, fn) => { const s = el('select'); for (const [k, v] of opts) { const op = el('option', '', v); op.value = k; if (String(k) === String(val)) op.selected = true; s.append(op); } s.onchange = () => fn(s.value); return s; };
    row('Hora do dia', sel(Object.entries(TIMES).map(([k, t]) => [k, t.name]), o.time, v => this.app.setTime(v)));
    const wet = el('input'); wet.type = 'checkbox'; wet.checked = o.wet > 0; wet.onchange = () => this.app.setWet(wet.checked ? 1 : 0); row('Pista molhada (menos aderência)', wet);
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = o.volume; vol.oninput = () => this.app.setVolume(+vol.value); row('Volume', vol);
    row('Unidade de velocidade', sel([['kmh', 'km/h'], ['mph', 'mph']], o.units, v => { o.units = v; }));
    row('Sombras', sel([[1, 'Ligadas'], [0, 'Desligadas (mais FPS)']], o.shadows, v => this.app.setShadows(+v)));
    row('Resolução de renderização', sel([[1, 'Normal'], [1.5, 'Alta'], [0.75, 'Baixa (mais FPS)']], o.pixel, v => this.app.setPixel(+v)));
    row('Velocidade da simulação', sel([[1, 'Normal (1×)'], [0.5, 'Câmera lenta 0,5×'], [0.2, 'Câmera lenta 0,2×'], [0.05, 'Câmera lentíssima']], o.timeScale, v => { o.timeScale = +v; }));
    { const r = el('input'); r.type = 'range'; r.min = 0; r.max = 40; r.value = o.bots; r.onchange = () => this.app.setBots(+r.value); row('Tráfego de bots (0–40)', r); }
    const tel = el('input'); tel.type = 'checkbox'; tel.checked = o.telemetry; tel.onchange = () => { o.telemetry = tel.checked; }; row('Mostrar telemetria (carga/derrapagem)', tel);
    p.append(grid);
  }

  renderHelp() {
    $('#p-help').innerHTML = `<div class="help">
      <p><kbd>W</kbd> <kbd>↑</kbd> acelerar · <kbd>S</kbd> <kbd>↓</kbd> frear / ré · <kbd>A</kbd> <kbd>D</kbd> direção</p>
      <p><kbd>Espaço</kbd> freio de mão · <kbd>N</kbd> nitro (se instalado)</p>
      <p><kbd>E</kbd> / <kbd>Q</kbd> troca de marcha (modo manual) · <kbd>T</kbd> alterna automático/manual</p>
      <p><kbd>C</kbd> muda a câmera (perseguição, capô, cockpit, para-choque, órbita, aérea) · <kbd>V</kbd> olhar para trás</p>
      <p>Mouse: arraste para girar a câmera · roda para aproximar</p>
      <p><kbd>R</kbd> desvira o carro · <kbd>Backspace</kbd> volta ao início e conserta · <kbd>Delete</kbd> conserta a lataria</p>
      <p><b>Painel do carro:</b> <kbd>L</kbd> faróis (apagado → lanterna → baixo → alto) · <kbd>B</kbd> neblina · <kbd>J</kbd> seta esquerda · <kbd>K</kbd> seta direita · <kbd>X</kbd> pisca-alerta · <kbd>O</kbd> limpador (lento/rápido) · <kbd>I</kbd> liga/desliga o motor · <kbd>Y</kbd> piloto automático · <kbd>H</kbd> buzina</p>
      <p><b>Minimapa:</b> <kbd>-</kbd> <kbd>=</kbd> zoom · <kbd>U</kbd> norte fixo / gira com o carro. As luzes de alerta do painel (motor, temperatura, óleo, bateria, combustível, freio, ABS/TC/ESC, pneus) acendem sozinhas.</p>
      <p><kbd>F</kbd> telemetria · <kbd>P</kbd> pausa · <kbd>[</kbd> <kbd>]</kbd> câmera lenta · <kbd>Delete</kbd> conserta e abastece</p>
      <p><kbd>G</kbd> garagem · <kbd>M</kbd> mapas · <kbd>Esc</kbd> menu · <kbd>F1</kbd> controles</p>
      <p>Controle (gamepad): analógico esquerdo direção · RT/LT acelera/freia · A freio de mão · LB/RB marchas · Y câmera · X reset</p>
      <p><b>Dica:</b> a deformação é real: bata em muros, rampas e rochas — o dano aparece na lataria, no motor, no radiador e nas rodas. O painel mostra a % de dano.</p>
      <p><b>Física:</b> pneu com escorregamento combinado e transferência de carga, suspensão com mola/amortecedor/barra, embreagem, diferenciais (aberto/LSD/travado), turbo com atraso, aerodinâmica e centro de gravidade calculados da configuração.</p>
    </div>`;
  }

  // ---------- garagem ----------
  buildGarageTabs() {
    const t = $('#gtabs'); t.innerHTML = '';
    const n = countOptions();
    t.append(el('div', 'hint', `<b>${n.total}</b> opções de personalização (${n.catalog} peças/visuais em ${n.categories} categorias + ${n.base} configurações base) — sem contar o carro inteiro`));
    for (const g of this.allGroups()) { const b = el('button', g.id === this.gtab ? 'on' : '', g.name); b.onclick = () => { this.gtab = g.id; this.renderGarage(); }; t.append(b); }
    const rb = el('button', 'sm', '↺ Original'); rb.style.marginLeft = 'auto'; rb.onclick = () => this.app.resetCfg(); t.append(rb);
  }

  allGroups() {
    if (this._groups) return this._groups;
    const extra = CAT_GROUPS.map(g => ({ id: g.id, name: g.name, items: g.keys.map(k => ({ t: 'part', key: k })).concat(g.id === 'paintp' ? [{ k: 'stripeColor', t: 'color', label: 'Cor dos adesivos / listras' }] : []) }));
    return (this._groups = [...GARAGE, ...extra]);
  }

  renderGarage() {
    this.buildGarageTabs();
    const grp = this.allGroups().find(g => g.id === this.gtab), c = this.app.cfg, box = $('#gctl'); box.innerHTML = '';
    for (const it of grp.items) {
      if (it.t === 'part') {
        const cat = CATS[it.key]; if (cat.show && !cat.show(c)) continue;
        const row = el('div', 'ctl'); const lab = el('div'); lab.innerHTML = `<label>${cat.label}</label><small>${cat.opts.length} opções${cat.kind === 'preset' ? ' · aplica valores' : cat.kind === 'fx' ? ' · muda a física' : ''}</small>`;
        const sel = el('select'); cat.opts.forEach((o, i) => { const op = el('option', '', o.n); op.value = i; if (((c.parts || {})[it.key] | 0) === i) op.selected = true; sel.append(op); });
        sel.onchange = () => { this.app.setPart(it.key, +sel.value); this.renderGarage(); };
        row.append(lab, sel, el('div', 'val', '')); box.append(row); continue;
      }
      if (it.show && !it.show(c)) continue;
      if (it.t === 'sec') { box.append(el('div', 'sec', it.label)); continue; }
      if (it.t === 'btn') { const b = el('button', 'sm', it.label); b.onclick = () => { this.app.garageAction(it.act); this.renderGarage(); }; const r = el('div', 'row2'); r.append(b); box.append(r); continue; }
      const get = it.get || (cc => cc[it.k]), set = it.set || ((cc, v) => { cc[it.k] = v; });
      const row = el('div', 'ctl'); const lab = el('div'); lab.innerHTML = `<label>${it.label}</label>${it.hint ? `<small>${it.hint}</small>` : ''}`;
      const val = el('div', 'val');
      let inp;
      if (it.t === 'select') {
        inp = el('select'); const opts = typeof it.opts === 'function' ? it.opts(c) : it.opts;
        for (const [k, v] of opts) { const o = el('option', '', v); o.value = k; if (String(k) === String(get(c))) o.selected = true; inp.append(o); }
        inp.onchange = () => this.change(it, inp.value, true);
      } else if (it.t === 'range') {
        inp = el('input'); inp.type = 'range'; inp.min = it.min; inp.max = it.max; inp.step = it.step; inp.value = get(c);
        const upd = () => { val.textContent = it.fmt ? it.fmt(+inp.value, c) : inp.value; };
        upd(); inp.oninput = upd; inp.onchange = () => { upd(); this.change(it, +inp.value, true); };
      } else if (it.t === 'check') {
        inp = el('input'); inp.type = 'checkbox'; inp.checked = !!get(c); inp.onchange = () => this.change(it, inp.checked, true);
      } else if (it.t === 'color') {
        inp = el('input'); inp.type = 'color'; inp.value = get(c);
        inp.oninput = () => { set(c, inp.value); this.app.quickColor(it.k); };
        inp.onchange = () => { this.change(it, inp.value, it.k !== 'paint'); };
      }
      row.append(lab, inp, val); box.append(row);
    }
    this.updateStats();
  }

  change(it, v, rebuild) {
    const c = this.app.cfg;
    if (it.k === '_preset') { if (v) this.app.applySuspPreset(v); this.renderGarage(); return; }
    const set = it.set || ((cc, val) => { cc[it.k] = (it.t === 'select' && /^-?\d+(\.\d+)?$/.test(String(val)) && it.k !== 'eng' && it.k !== 'gb') ? +val : val; });
    set(c, v);
    this.app.onCfgChanged(it.k, rebuild);
    if (['eng', 'drive', 'wing', 'gb'].includes(it.k)) this.renderGarage();
    else this.updateStats();
  }

  updateStats() {
    const s = $('#gstats'); if (!s) return;
    const app = this.app, spec = app.spec, c = app.cfg, car = CARS[c.car], e = ENGINES[c.eng], gb = GEARBOXES[c.gb];
    const pf = quickPerf(spec);
    const stockHp = ENGINES[car.eng].peakHp;
    // potência/torque efetivos (com preparação e turbo)
    let hp = 0, tq = 0, rpmP = 0, rpmT = 0;
    for (let r = Math.max(e.idle, 500); r <= e.red; r += 100) { const T = engTorqueWOT(spec.eng, r, 1), P = T * r * Math.PI / 30 / HP; if (P > hp) { hp = P; rpmP = r; } if (T > tq) { tq = T; rpmT = r; } }
    const vmax = pf.top * 3.6;
    s.innerHTML = `<h4>${car.name}</h4>
      <div style="color:var(--dim);margin-bottom:6px">${e.name} · ${gb.name}</div>
      <canvas id="dyno" width="340" height="170"></canvas>
      <div class="kv"><span>Potência máx.</span><b>${fmt(hp)} cv @ ${fmt(rpmP)} rpm</b>
      <span>Torque máx.</span><b>${fmt(tq)} Nm @ ${fmt(rpmT)} rpm</b>
      <span>Massa (c/ piloto)</span><b>${fmt(spec.mass)} kg</b>
      <span>Distribuição de peso</span><b>${fmt(spec.distF * 100)} / ${fmt(100 - spec.distF * 100)} %</b>
      <span>Altura do CG</span><b>${fmt(spec.cgH * 100)} cm</b>
      <span>Potência / peso</span><b>${fmt(hp / spec.mass * 1000)} cv/t</b>
      <span>0–100 km/h (est.)</span><b>${pf.t100 ? pf.t100.toFixed(1) + ' s' : '—'}</b>
      <span>400 m (est.)</span><b>${pf.q ? pf.q.toFixed(1) + ' s @ ' + fmt(pf.v400 * 3.6) + ' km/h' : '—'}</b>
      <span>Vel. máxima (est.)</span><b>${fmt(vmax)} km/h</b>
      <span>Pneus (F / T)</span><b>${c.tf[0]}/${c.tf[1]}R${c.tf[2]} · ${c.tr[0]}/${c.tr[1]}R${c.tr[2]}</b>
      <span>Arrasto CdA</span><b>${spec.cdA.toFixed(2)} m²</b>
      <span>Downforce @200 km/h</span><b>${fmt(0.5 * 1.2 * 55.5 * 55.5 * (spec.clF + spec.clR) / 9.81)} kg</b></div>
      <div style="color:var(--dim);font-size:11px">Marchas: ${spec.gearInfo.ratios.map(r => r.toFixed(2)).join(' · ')}</div>`;
    this.drawDyno($('#dyno'), spec, e);
  }

  drawDyno(cv, spec, e) {
    if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    const E = spec.eng, red = E.red, step = 100;
    const pts = []; let maxT = 1, maxP = 1;
    for (let r = Math.max(200, E.idle * 0.6); r <= red * 1.02; r += step) { const T = engTorqueWOT(E, r, 1), P = T * r * Math.PI / 30 / HP; pts.push([r, T, P]); maxT = Math.max(maxT, T); maxP = Math.max(maxP, P); }
    const mx = 34, my = 12, pw = W - mx - 10, ph = H - my - 22;
    g.strokeStyle = '#1f2b44'; g.fillStyle = '#7f90b0'; g.font = '10px sans-serif'; g.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const y = my + ph * i / 4; g.beginPath(); g.moveTo(mx, y); g.lineTo(mx + pw, y); g.stroke(); g.fillText(Math.round(maxT * 1.1 * (1 - i / 4)), 2, y + 3); }
    const top = Math.ceil(red / 1000);
    for (let r = 0; r <= top; r++) { const x = mx + pw * (r * 1000 - pts[0][0]) / (red * 1.02 - pts[0][0]); if (x < mx || x > mx + pw) continue; g.fillText(r + 'k', x - 6, H - 8); g.beginPath(); g.moveTo(x, my); g.lineTo(x, my + ph); g.stroke(); }
    const X = r => mx + pw * (r - pts[0][0]) / (red * 1.02 - pts[0][0]);
    const plot = (idx, mxv, col) => { g.beginPath(); g.strokeStyle = col; g.lineWidth = 2; pts.forEach((p, i) => { const x = X(p[0]), y = my + ph * (1 - p[idx] / (mxv * 1.1)); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
    plot(1, maxT, '#34b4ff'); plot(2, maxP, '#ff7a1a');
    g.fillStyle = '#34b4ff'; g.fillText('Torque (Nm)', mx + 6, my + 10); g.fillStyle = '#ff7a1a'; g.fillText('Potência (cv ×' + (maxP / maxT).toFixed(2) + ')', mx + 80, my + 10);
    // linha de corte
    g.strokeStyle = '#ff4040'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(X(red), my); g.lineTo(X(red), my + ph); g.stroke(); g.setLineDash([]);
  }
}
