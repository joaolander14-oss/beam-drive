// ============================================================
//  Catálogo de personalização: peças com efeito físico (fx), predefinições (set) e visuais (vis)
//  cfg.parts[chave] = índice da opção escolhida (0 = original)
// ============================================================
import { WHEEL_STYLES, COMPOUNDS, BRAKES, GEARBOXES, ENGINES, DIFFS, CENTER_DIFFS, SUSP_PRESETS } from './data.js';

export const CATS = {};        // chave -> { label, kind:'fx'|'preset'|'vis', opts:[{n, fx?, set?}], show? }
const cat = (key, label, kind, opts, show) => { CATS[key] = { key, label, kind, opts, show }; };
const fxo = list => list.map(([n, fx = {}]) => ({ n, fx }));
const vis = names => names.map(n => ({ n }));

// ---------- motor ----------
cat('fuel', 'Combustível', 'fx', fxo([['Gasolina comum (original)'], ['Gasolina aditivada', { tq: 1.005 }], ['Gasolina premium 98 octanas', { tq: 1.02 }], ['Etanol E100', { tq: 1.04, cool: 1.08 }], ['E85 (etanol + gasolina)', { tq: 1.05, cool: 1.05 }], ['Gasolina de corrida 102', { tq: 1.07 }], ['Metanol', { tq: 1.09, cool: 1.12 }], ['Gasolina econômica (baixa octanagem)', { tq: 0.985 }]]));
cat('ecu', 'Central eletrônica (ECU)', 'fx', fxo([['Original'], ['Mapa econômico', { tq: 0.97 }], ['Remap estágio 1', { tq: 1.04, boost: 1.04 }], ['Remap estágio 2', { tq: 1.07, boost: 1.07 }], ['Remap estágio 3', { tq: 1.10, boost: 1.10 }], ['Mapa flex-fuel', { tq: 1.03 }], ['Mapa de corrida', { tq: 1.12, boost: 1.15, red: 200 }], ['Anti-lag', { tq: 1.06, boost: 1.10 }], ['Módulo piggyback', { tq: 1.05, boost: 1.05 }]]));
cat('intake', 'Admissão', 'fx', fxo([['Original'], ['Filtro de ar esportivo', { tq: 1.012 }], ['Filtro cônico aberto', { tq: 1.02 }], ['Caixa de ar fria', { tq: 1.025 }], ['Coletor de admissão esportivo', { tq: 1.03 }], ['Plenum de competição', { tq: 1.04, mass: 1 }], ['Corpos de borboleta individuais', { tq: 1.055, J: 0.98 }], ['Ram-air de competição', { tq: 1.06, cdA: 0.004 }]]));
cat('headers', 'Coletor de escape (header)', 'fx', fxo([['Original'], ['Header 4-2-1', { tq: 1.02 }], ['Header 4-1', { tq: 1.03 }], ['Header de comprimentos iguais', { tq: 1.04, mass: -3 }], ['Header de inconel', { tq: 1.045, mass: -6 }], ['Sem catalisador (competição)', { tq: 1.06, mass: -8 }]]));
cat('exhaust', 'Escapamento', 'fx', fxo([['Original'], ['Silencioso esportivo', { tq: 1.01 }], ['Cat-back', { tq: 1.02 }], ['Cat-back inox', { tq: 1.025, mass: -5 }], ['Escape duplo', { tq: 1.03 }], ['Straight-pipe', { tq: 1.04, mass: -10 }], ['Titânio', { tq: 1.04, mass: -14 }], ['Escape de corrida', { tq: 1.05, mass: -14 }], ['Escape com válvulas', { tq: 1.03 }], ['Escape ativo (modo pista)', { tq: 1.035 }]]));
cat('cams', 'Comando de válvulas', 'fx', fxo([['Original'], ['Comando estágio 1', { tq: 1.03, red: 100 }], ['Comando estágio 2', { tq: 1.06, red: 200 }], ['Comando estágio 3', { tq: 1.09, red: 300, fric: 1.05 }], ['Comando de competição', { tq: 1.12, red: 400, fric: 1.1 }], ['Comando variável (VVT)', { tq: 1.04 }], ['Comando de torque (baixa rotação)', { tq: 1.03 }]]));
cat('head', 'Cabeçote', 'fx', fxo([['Original'], ['Cabeçote polido', { tq: 1.02 }], ['Cabeçote portado', { tq: 1.04 }], ['Válvulas maiores', { tq: 1.055 }], ['Cabeçote de competição', { tq: 1.07, red: 200 }]]));
cat('injectors', 'Bicos injetores', 'fx', fxo([['Original'], ['Bicos +10%', { tq: 1.01 }], ['Bicos +20%', { tq: 1.02 }], ['Bicos 1000 cc', { tq: 1.035 }], ['Bicos 1500 cc', { tq: 1.05 }], ['Injeção direta + indireta', { tq: 1.045 }]]));
cat('pistons', 'Internos do motor', 'fx', fxo([['Originais'], ['Pistões forjados', { tq: 1.01, red: 200, mass: -1 }], ['Alta compressão', { tq: 1.04 }], ['Baixa compressão (p/ turbo)', { boost: 1.12 }], ['Bielas forjadas', { tq: 1.015, red: 300 }], ['Bloco fechado reforçado', { boost: 1.2, mass: 8, J: 1.03 }]]));
cat('oil', 'Lubrificação', 'fx', fxo([['Óleo original'], ['Óleo mineral', { fric: 1.04 }], ['Semissintético', { fric: 1.02 }], ['Sintético 0W-20', { fric: 0.98 }], ['Sintético racing', { fric: 0.96 }], ['Cárter seco', { fric: 0.93, mass: 4 }]]));
cat('flywheel', 'Volante do motor', 'fx', fxo([['Original'], ['Volante leve', { J: 0.85 }], ['Volante de alumínio', { J: 0.7, mass: -3 }], ['Volante de chromoly', { J: 0.6, mass: -4 }], ['Volante pesado', { J: 1.3, mass: 3 }], ['Volante de massa dupla', { J: 1.15 }], ['Volante de competição', { J: 0.5, mass: -5 }]]));
cat('clutch', 'Embreagem', 'fx', fxo([['Original'], ['Esportiva (1.2×)', { clutch: 1.2 }], ['Reforçada (1.4×)', { clutch: 1.4 }], ['Cerâmica (1.8×)', { clutch: 1.8 }], ['Carbono (2.0×)', { clutch: 2.0 }], ['Multidisco (2.4×)', { clutch: 2.4, J: 0.95 }], ['Dupla de competição', { clutch: 2.8, J: 0.92 }]]));
const forced = c => !!ENGINES[c.eng].boost;
cat('turbo', 'Turbo / compressor', 'fx', fxo([['Original'], ['Turbo de maior fluxo', { boost: 1.08 }], ['Turbo estágio 1', { boost: 1.12 }], ['Turbo estágio 2', { boost: 1.18 }], ['Turbo estágio 3', { boost: 1.25 }], ['Turbo estágio 4', { boost: 1.32 }], ['Turbo twin-scroll', { boost: 1.14 }], ['Turbo de geometria variável', { boost: 1.16 }], ['Turbo de esfera', { boost: 1.22 }], ['Biturbo sequencial', { boost: 1.28 }], ['Turbo elétrico', { boost: 1.2, mass: 4 }], ['Turbo gigante (drag)', { boost: 1.42 }]]), forced);
cat('intercooler', 'Intercooler', 'fx', fxo([['Original'], ['Intercooler maior', { tq: 1.02 }], ['Intercooler frontal', { tq: 1.03, cdA: 0.004 }], ['Líquido-ar', { tq: 1.035, mass: 5 }], ['Spray água-metanol', { tq: 1.05, mass: 4 }], ['Intercooler de competição', { tq: 1.045, cdA: 0.006 }]]), forced);
cat('wastegate', 'Válvulas de alívio', 'fx', fxo([['Originais'], ['Wastegate externa', { boost: 1.03 }], ['BOV esportiva', { boost: 1.0 }], ['Controle eletrônico de boost', { boost: 1.05 }], ['Boost controller manual', { boost: 1.06 }]]), forced);
cat('radiator', 'Radiador', 'fx', fxo([['Original'], ['Radiador maior', { cool: 1.2 }], ['Radiador de alumínio', { cool: 1.4, mass: -2 }], ['Radiador duplo', { cool: 1.6, mass: 3 }], ['Radiador de competição', { cool: 1.9, mass: 2 }], ['Radiador + ventoinha dupla', { cool: 2.2, mass: 5 }]]));
cat('oilcooler', 'Arrefecimento extra', 'fx', fxo([['Nenhum'], ['Trocador de calor do óleo', { cool: 1.06 }], ['Arrefecedor de óleo duplo', { cool: 1.12, mass: 3 }], ['Aleta de capô com saída de ar', { cool: 1.15, cdA: 0.003 }]]));
cat('nitrosize', 'Garrafa de nitro', 'fx', fxo([['Padrão (12 s)'], ['Pequena (+6 s)', { nitroS: 6, mass: 3 }], ['Média (+12 s)', { nitroS: 12, mass: 6 }], ['Grande (+24 s)', { nitroS: 24, mass: 10 }], ['Gigante (+48 s)', { nitroS: 48, mass: 16 }]]));
// ---------- transmissão ----------
cat('shiftkit', 'Câmbio — kit de engates', 'fx', fxo([['Original'], ['Engates curtos', { shift: 0.85 }], ['Engates de competição', { shift: 0.7 }], ['Câmbio dog-box', { shift: 0.5, mass: -4 }], ['Corte de ignição', { shift: 0.35 }]]));
cat('driveshaft', 'Eixos e transmissão', 'fx', fxo([['Originais'], ['Semieixos reforçados', { eta: 0.005, mass: 2 }], ['Cardã de carbono', { eta: 0.01, mass: -6 }], ['Transmissão de baixa perda', { eta: 0.02 }]]));
cat('finaldrive', 'Relação final (predefinida)', 'preset', [['Original', 1], ['Mais curta −20%', 1.25], ['Mais curta −15%', 1.176], ['Mais curta −10%', 1.11], ['Mais curta −5%', 1.05], ['Mais longa +5%', 0.95], ['Mais longa +10%', 0.91], ['Mais longa +15%', 0.87], ['Mais longa +20%', 0.833], ['Arrancada (curta)', 1.4], ['Velocidade final (longa)', 0.78], ['Off-road (muito curta)', 1.5], ['Economia', 0.85], ['Pista (média)', 1.08]].map(([n, m]) => ({ n, set: (c, car) => { c.fin = +(car.fin * m).toFixed(2); } })));
// ---------- chassi ----------
cat('springs', 'Molas', 'fx', fxo([['Originais'], ['Molas macias (0.8×)', { spring: 0.8 }], ['Molas confortáveis (0.9×)', { spring: 0.9 }], ['Molas esportivas (1.15×)', { spring: 1.15 }], ['Molas rebaixadas (1.3×)', { spring: 1.3 }], ['Molas de pista (1.5×)', { spring: 1.5 }], ['Molas de competição (1.8×)', { spring: 1.8 }], ['Molas de drag (2.2×)', { spring: 2.2 }], ['Molas progressivas (1.2×)', { spring: 1.2 }], ['Molas de rali (1.1×)', { spring: 1.1 }]]));
cat('dampers', 'Amortecedores', 'fx', fxo([['Originais'], ['Amortecedor macio', { damp: 0.8 }], ['Gás esportivo', { damp: 1.15 }], ['Monotubo', { damp: 1.25 }], ['Regulável 2 vias', { damp: 1.35 }], ['Regulável 3 vias', { damp: 1.45 }], ['Competição', { damp: 1.6 }], ['Rali (longo curso)', { damp: 1.2 }]]));
cat('arbs', 'Barras estabilizadoras', 'fx', fxo([['Originais'], ['Sem barras', { arb: 0.0 }], ['Barras macias', { arb: 0.6 }], ['Barras esportivas', { arb: 1.3 }], ['Barras grossas', { arb: 1.6 }], ['Barras de competição', { arb: 2.0 }], ['Barras ajustáveis', { arb: 1.8 }], ['Barras extremas', { arb: 2.6 }]]));
cat('braces', 'Reforços de carroceria', 'fx', fxo([['Nenhum'], ['Barra de torre dianteira', { arb: 1.04, mass: 3 }], ['Barra de torre traseira', { arb: 1.05, mass: 3 }], ['Barras de torre dupla', { arb: 1.08, mass: 6 }]]));
cat('cage', 'Santo Antônio (gaiola)', 'fx', fxo([['Sem gaiola'], ['Semi-gaiola 4 pontos', { arb: 1.1, mass: 25 }], ['Gaiola 6 pontos', { arb: 1.2, mass: 40 }], ['Gaiola completa', { arb: 1.3, mass: 60 }], ['Gaiola de alumínio', { arb: 1.15, mass: 28 }]]));
cat('rack', 'Caixa de direção', 'fx', fxo([['Original'], ['Direção lenta (conforto)', { steer: 0.9 }], ['Direção direta', { steer: 1.07 }], ['Direção rápida', { steer: 1.12 }], ['Direção de competição', { steer: 1.18 }]]));
cat('camber', 'Cambagem (predefinida)', 'preset', [[0, 0], [-0.5, -0.5], [-1, -1], [-1.5, -1.5], [-2, -2.5], [-3, -3.5], [-4, -4.5], [-0.5, -2], [-2.5, -1.5], [0.5, 0.5]].map(([f, r]) => ({ n: `Frente ${f}° / Trás ${r}°`, set: c => { c.camF = f; c.camR = r; } })));
cat('toe', 'Convergência (predefinida)', 'preset', [['Neutra', 0, 0], ['Estável (toe-in leve)', 0.1, 0.2], ['Esportiva', 0.05, 0.15], ['Reativa (toe-out)', -0.15, 0.05], ['Drift', -0.3, 0.0], ['Máxima estabilidade', 0.2, 0.4]].map(([n, f, r]) => ({ n, set: c => { c.toeF = f; c.toeR = r; } })));
cat('rideh', 'Altura da suspensão (predefinida)', 'preset', [[-80, 'Muito baixa'], [-60, 'Baixíssima'], [-40, 'Baixa'], [-20, 'Rebaixada leve'], [0, 'Original'], [20, 'Elevada leve'], [40, 'Elevada'], [70, 'Lift 70 mm'], [100, 'Lift 100 mm'], [140, 'Lift extremo']].map(([v, n]) => ({ n: `${n} (${v > 0 ? '+' : ''}${v} mm)`, set: c => { c.rh = v; } })));
cat('pressure', 'Pressão dos pneus (predefinida)', 'preset', [[1.0, 'Areia (1.0)'], [1.4, 'Off-road (1.4)'], [1.8, 'Pista fria (1.8)'], [2.2, 'Padrão (2.2)'], [2.6, 'Econômica (2.6)'], [3.0, 'Alta (3.0)']].map(([v, n]) => ({ n, set: c => { c.pF = v; c.pR = v; } })));
// ---------- freios ----------
cat('pads', 'Pastilhas de freio', 'fx', fxo([['Originais'], ['Pastilha orgânica', { brk: 0.92 }], ['Pastilha semimetálica', { brk: 1.05 }], ['Pastilha esportiva', { brk: 1.12 }], ['Pastilha cerâmica', { brk: 1.1 }], ['Pastilha de pista', { brk: 1.22 }], ['Pastilha de competição', { brk: 1.32 }]]));
cat('rotors', 'Discos de freio', 'fx', fxo([['Originais'], ['Discos ventilados', { brk: 1.04 }], ['Discos ranhurados', { brk: 1.07 }], ['Discos furados', { brk: 1.06 }], ['Discos flutuantes', { brk: 1.12, mass: -1 }], ['Discos grandes (+30 mm)', { brk: 1.18, mass: 3 }], ['Discos de carbono', { brk: 1.3, mass: -6 }]]));
cat('lines', 'Mangueiras e cilindro mestre', 'fx', fxo([['Originais'], ['Mangueiras de aço', { brk: 1.03 }], ['Cilindro mestre esportivo', { brk: 1.05 }]]));
// ---------- pneus ----------
const TM = [
  ['Michelin Pilot Sport 4S', 'sport', 1.03, 0.001], ['Michelin Pilot Sport Cup 2', 'semislick', 1.02, 0.001], ['Michelin Primacy 4', 'street', 1.0, -0.001], ['Michelin Energy Saver', 'eco', 1.0, -0.001], ['Michelin LTX Force', 'at', 1.0, 0],
  ['Pirelli P Zero', 'sport', 1.02, 0.001], ['Pirelli P Zero Trofeo R', 'semislick', 1.04, 0.002], ['Pirelli Cinturato P7', 'street', 1.0, 0], ['Pirelli Scorpion All Terrain', 'at', 1.02, 0.001], ['Pirelli Slick P Zero', 'slick', 1.0, 0],
  ['Bridgestone Potenza RE-71R', 'semislick', 0.99, 0.001], ['Bridgestone Turanza', 'street', 0.98, -0.001], ['Bridgestone Ecopia', 'eco', 1.0, -0.001], ['Bridgestone Dueler A/T', 'at', 1.0, 0],
  ['Continental ExtremeContact Sport', 'sport', 1.01, 0.001], ['Continental SportContact 7', 'sport', 1.03, 0.001], ['Continental CrossContact', 'at', 0.98, 0],
  ['Goodyear Eagle F1', 'sport', 1.01, 0.001], ['Goodyear Eagle Supercar', 'sport', 1.04, 0.002], ['Goodyear EfficientGrip', 'eco', 1.0, -0.001], ['Goodyear Wrangler', 'at', 1.0, 0.001],
  ['Yokohama Advan A052', 'semislick', 0.98, 0.001], ['Yokohama Advan Neova AD08R', 'sport', 1.05, 0.002], ['Hankook Ventus V12 evo', 'sport', 0.99, 0.001], ['Falken Azenis RT615K+', 'semislick', 1.0, 0.001], ['Falken Wildpeak A/T', 'at', 1.02, 0.001],
  ['Toyo Proxes R888R', 'semislick', 1.01, 0.001], ['Toyo Open Country', 'at', 1.0, 0], ['Nitto NT05R', 'semislick', 0.99, 0.001], ['Nitto Trail Grappler', 'mud', 1.0, 0.001], ['Dunlop Direzza', 'sport', 1.0, 0.001], ['Dunlop Sport Maxx', 'sport', 1.02, 0.001],
  ['BFGoodrich All-Terrain KO2', 'at', 1.03, 0.001], ['BFGoodrich Mud-Terrain KM3', 'mud', 1.03, 0.001], ['Mickey Thompson Baja Boss', 'mud', 1.02, 0.001], ['Mickey Thompson ET Street R', 'drag', 1.0, 0], ['Maxxis Victra (drift)', 'drift', 1.0, 0],
  ['Kumho Ecsta (drift duro)', 'drift', 1.05, 0], ['Rali — Michelin Pilot Rally', 'rally', 1.03, 0.001], ['Rali — Pirelli Scorpion Rally', 'rally', 1.0, 0], ['Cooper Discoverer', 'at', 0.98, 0],
];
cat('tiremodel', 'Modelo de pneu (ambos os eixos)', 'fx', [{ n: 'Compostos individuais (abas Rodas e Pneus)', fx: {} }, ...TM.map(([n, comp, mu, crr]) => ({ n, fx: { comp, mu, crr } }))]);
const SIZES = [[145, 80, 13], [165, 70, 14], [175, 65, 14], [185, 60, 15], [195, 55, 15], [205, 55, 16], [205, 50, 17], [215, 45, 17], [225, 45, 17], [225, 40, 18], [235, 40, 18], [245, 40, 18], [245, 35, 19], [255, 35, 19], [265, 35, 20], [275, 30, 20], [295, 30, 20], [315, 30, 21], [215, 65, 16], [235, 70, 16], [265, 65, 17], [285, 70, 17], [315, 70, 17], [345, 25, 24]];
cat('tiresize', 'Medida dos pneus (predefinida)', 'preset', SIZES.map(([w, a, r]) => ({ n: `${w}/${a} R${r} (ambos os eixos)`, set: c => { c.tf = [w, a, r]; c.tr = [w, a, r]; } })));
// ---------- aerodinâmica / carroceria ----------
cat('wingkit', 'Aerofólio avançado', 'fx', [{ n: 'Nenhum (usa o aerofólio da aba)', fx: {} }, ...[['Spoiler baixo discreto', 0.03, 0.002], ['Lip de porta-malas', 0.05, 0.004], ['Ducktail alto', 0.10, 0.01], ['Asa GT de alumínio', 0.30, 0.04], ['Asa GT de carbono', 0.34, 0.045], ['Asa pedestal dupla', 0.40, 0.06], ['Asa swan-neck', 0.55, 0.08], ['Asa de pista (grande)', 0.70, 0.11], ['Asa biplano', 0.85, 0.15], ['Asa DRS ativa', 0.60, 0.07], ['Asa de rali', 0.45, 0.07], ['Asa tipo Touring', 0.50, 0.07], ['Asa de drift (alta)', 0.35, 0.06]].map(([n, cl, cd]) => ({ n, fx: { clR: cl, cdA: cd, mass: Math.round(cl * 18) } }))]);
cat('splitter2', 'Parte inferior dianteira', 'fx', fxo([['Original'], ['Lábio pequeno', { clF: 0.02, cdA: 0.002 }], ['Splitter de fibra', { clF: 0.1, cdA: 0.012 }], ['Splitter largo', { clF: 0.16, cdA: 0.018 }], ['Splitter com ancoragens', { clF: 0.22, cdA: 0.024 }], ['Splitter de corrida', { clF: 0.3, cdA: 0.034 }], ['Splitter extremo', { clF: 0.4, cdA: 0.05 }], ['Defletor off-road (alto)', { clF: 0.0, cdA: 0.01 }]]));
cat('diffuser2', 'Difusor traseiro', 'fx', fxo([['Original'], ['Difusor pequeno', { clR: 0.05, cdA: 0.008 }], ['Difusor grande', { clR: 0.11, cdA: 0.016 }], ['Difusor de competição', { clR: 0.2, cdA: 0.028 }], ['Difusor + túneis', { clR: 0.3, cdA: 0.04 }]]));
cat('canards', 'Aletas (canards)', 'fx', fxo([['Nenhuma'], ['Canards pequenos', { clF: 0.02, cdA: 0.003 }], ['Canards duplos', { clF: 0.05, cdA: 0.006 }], ['Canards de competição', { clF: 0.09, cdA: 0.012 }]]));
cat('skirts', 'Saias laterais', 'fx', fxo([['Originais'], ['Saia discreta', { clF: 0.01, clR: 0.01 }], ['Saia esportiva', { clF: 0.02, clR: 0.02 }], ['Saia larga', { clF: 0.03, clR: 0.03, cdA: 0.004 }], ['Saia de corrida', { clF: 0.05, clR: 0.05, cdA: 0.008 }], ['Saia baixíssima', { clF: 0.07, clR: 0.07, cdA: 0.012 }]]));
cat('floor', 'Assoalho', 'fx', fxo([['Original'], ['Assoalho plano', { clF: 0.03, clR: 0.04, cdA: -0.01 }], ['Assoalho + efeito solo', { clF: 0.08, clR: 0.12, cdA: -0.005 }]]));
cat('roofsp', 'Spoiler de teto', 'fx', fxo([['Nenhum'], ['Spoiler de teto pequeno', { clR: 0.02, cdA: 0.003 }], ['Spoiler de teto grande', { clR: 0.04, cdA: 0.006 }], ['Aleta de teto', { clR: 0.03, cdA: 0.005 }]]));
cat('hoodvent', 'Saídas de ar do capô', 'fx', fxo([['Nenhuma'], ['Respiros simples', { cool: 1.03, clF: 0.01 }], ['Respiros duplos', { cool: 1.05, clF: 0.02 }], ['Aletas (louvers)', { cool: 1.06, clF: 0.02 }], ['Extrator grande', { cool: 1.1, clF: 0.04, cdA: 0.004 }], ['Capô de carbono vazado', { cool: 1.12, clF: 0.05, mass: -6 }], ['Capô com entrada NACA', { cool: 1.08, clF: 0.02 }], ['Capô tipo racing', { cool: 1.14, clF: 0.06, cdA: 0.006 }]]));
cat('louvers', 'Veneziana do vidro traseiro', 'fx', fxo([['Nenhuma'], ['Veneziana 3 aletas', { clR: 0.01, cdA: 0.002 }], ['Veneziana 5 aletas', { clR: 0.02, cdA: 0.004 }]]));
cat('frontkit', 'Para-choque dianteiro (kit)', 'fx', fxo([['Original'], ['Kit esportivo', { cdA: 0.004, clF: 0.02 }], ['Kit agressivo', { cdA: 0.008, clF: 0.04 }], ['Kit de pista', { cdA: 0.012, clF: 0.06 }], ['Kit rali', { cdA: 0.01 }], ['Kit off-road', { cdA: 0.02 }], ['Kit retrô', { cdA: 0.0 }], ['Kit aerodinâmico', { cdA: -0.006, clF: 0.02 }]]));
cat('rearkit', 'Para-choque traseiro (kit)', 'fx', fxo([['Original'], ['Kit esportivo', { cdA: 0.003, clR: 0.02 }], ['Kit agressivo', { cdA: 0.006, clR: 0.04 }], ['Kit de pista', { cdA: 0.01, clR: 0.06 }], ['Kit off-road', { cdA: 0.01 }], ['Kit aerodinâmico', { cdA: -0.005, clR: 0.02 }]]));
cat('flares', 'Paralamas alargados', 'fx', fxo([['Originais'], ['Alargamento +10 mm', { cdA: 0.002 }], ['Alargamento +20 mm', { cdA: 0.004, mass: 4 }], ['Alargamento +35 mm', { cdA: 0.007, mass: 7 }], ['Alargamento +50 mm (rali)', { cdA: 0.01, mass: 10 }], ['Paralamas retrô (rebitados)', { cdA: 0.008, mass: 8 }]]));
cat('hoodstyle', 'Capô', 'vis', vis(['Original', 'Entrada de ar grande', 'Respiros duplos', 'Capô de carbono', 'Veneziana de aletas', 'Travas de capô', 'Capô com power-dome', 'Capô preto fosco']));
cat('roofacc', 'Acessórios de teto', 'vis', vis(['Nenhum', 'Bagageiro de teto', 'Maleiro (caixa de teto)', 'Aleta de tubarão', 'Barras de rali', 'Rack de esqui', 'Estepe no teto', 'Faróis auxiliares de teto']));
cat('roofcolor', 'Cor do teto', 'vis', null);
cat('mirrors', 'Retrovisores (cor)', 'vis', null);
// ---------- off-road ----------
cat('bullbar', 'Para-choque / quebra-mato', 'vis', vis(['Nenhum', 'Quebra-mato tubular', 'Para-choque off-road de aço', 'Para-choque com guincho', 'Quebra-mato de rali']));
cat('winch', 'Guincho', 'vis', vis(['Nenhum', 'Guincho elétrico 9.500 lb', 'Guincho elétrico 12.000 lb']));
cat('snorkel', 'Snorkel', 'vis', vis(['Nenhum', 'Snorkel lateral', 'Snorkel alto', 'Snorkel de competição']));
cat('spare', 'Estepe', 'vis', vis(['Original', 'Estepe na traseira', 'Estepe duplo', 'Sem estepe']));
cat('mudflaps', 'Para-lamas de lama', 'vis', vis(['Nenhum', 'Abas de borracha', 'Abas esportivas', 'Abas largas off-road']));
cat('fog', 'Faróis de milha', 'vis', vis(['Nenhum', 'Faróis auxiliares redondos', 'Faróis auxiliares retangulares', 'Faróis de LED', 'Faróis de rali (4)']));
cat('pods', 'Faróis auxiliares de LED', 'vis', vis(['Nenhum', 'Barra de LED no para-choque', 'Pods no capô', 'Pods na grade', 'Barra de LED curva']));
cat('skid', 'Protetor de cárter', 'vis', vis(['Nenhum', 'Protetor de alumínio', 'Protetor de aço', 'Protetor de competição']));
cat('steps', 'Estribos', 'vis', vis(['Nenhum', 'Estribo tubular', 'Estribo plano', 'Estribo retrátil']));
cat('tow', 'Engates e ganchos', 'vis', vis(['Nenhum', 'Ganchos de reboque', 'Engate traseiro', 'Ganchos de recuperação']));
// ---------- visual ----------
const COLORS = [['Branco', '#f2f2f2'], ['Preto', '#0c0c0e'], ['Prata', '#b9bcc2'], ['Cinza', '#6b6f76'], ['Grafite', '#2b2d31'], ['Vermelho', '#c0262d'], ['Bordô', '#6b1220'], ['Laranja', '#e8741a'], ['Amarelo', '#f2c40f'], ['Verde', '#2f9e44'], ['Verde-oliva', '#4a5a2a'], ['Verde-água', '#1fa89a'], ['Azul', '#1f5fbf'], ['Azul-marinho', '#14234f'], ['Azul-claro', '#4fa8e8'], ['Roxo', '#6a2aa8'], ['Rosa', '#e0509a'], ['Marrom', '#5a3a22'], ['Bege', '#cdb892'], ['Dourado', '#c59a2a'], ['Bronze', '#8a5a2a'], ['Champanhe', '#d8c9a0'], ['Lima', '#9ad12a'], ['Turquesa', '#12b5cb']];
function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (c) => Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)))); return '#' + ((1 << 24) | (m(r) << 16) | (m(g) << 8) | m(b)).toString(16).slice(1); }
const paintOpts = [];
for (const [n, h] of COLORS) {
  paintOpts.push({ n: `${n} sólido`, set: c => { c.paint = h; c.finish = 'gloss'; } }, { n: `${n} claro`, set: c => { c.paint = shade(h, 0.28); c.finish = 'gloss'; } }, { n: `${n} escuro`, set: c => { c.paint = shade(h, -0.35); c.finish = 'gloss'; } }, { n: `${n} metálico`, set: c => { c.paint = h; c.finish = 'metal'; } }, { n: `${n} perolado`, set: c => { c.paint = shade(h, 0.1); c.finish = 'pearl'; } });
}
cat('paint', 'Pintura (120 cores)', 'preset', paintOpts);
cat('paintmatte', 'Pintura fosca / acetinada', 'preset', COLORS.slice(0, 12).flatMap(([n, h]) => [{ n: `${n} fosco`, set: c => { c.paint = h; c.finish = 'matte'; } }, { n: `${n} acetinado`, set: c => { c.paint = h; c.finish = 'satin'; } }]));
CATS.roofcolor.opts = [{ n: 'Mesma cor da carroceria', v: null }, ...COLORS.map(([n, h]) => ({ n: `Teto ${n}`, v: h })), { n: 'Teto preto brilhante', v: '#050506' }, { n: 'Teto carbono', v: '#17181b' }];
CATS.mirrors.opts = [{ n: 'Cor da carroceria', v: null }, ...[['Preto', '#0a0a0c'], ['Cromado', '#d0d4da'], ['Carbono', '#17181b'], ['Branco', '#f2f2f2'], ['Vermelho', '#c0262d'], ['Azul', '#1f5fbf'], ['Amarelo', '#f2c40f'], ['Prata', '#b9bcc2'], ['Laranja', '#e8741a'], ['Verde', '#2f9e44'], ['Dourado', '#c59a2a']].map(([n, v]) => ({ n: `Espelhos ${n}`, v }))];
// listras (família paramétrica)
const STRIPES = [{ n: 'Sem listras', p: null }];
for (const w of [0.06, 0.1, 0.16, 0.24, 0.34, 0.5]) STRIPES.push({ n: `Faixa central ${Math.round(w * 100)}%`, p: ['center', w] });
for (const [w, s] of [[0.05, 0.12], [0.07, 0.18], [0.09, 0.24], [0.06, 0.32], [0.1, 0.4]]) STRIPES.push({ n: `Faixas duplas ${Math.round(w * 100)}/${Math.round(s * 100)}`, p: ['dual', w, s] });
for (const [y, h] of [[0.28, 0.05], [0.35, 0.08], [0.42, 0.04], [0.5, 0.1], [0.58, 0.06], [0.2, 0.12]]) STRIPES.push({ n: `Faixa lateral altura ${Math.round(y * 100)}%`, p: ['side', y, h] });
for (const w of [0.12, 0.22, 0.36]) STRIPES.push({ n: `Faixa só no capô ${Math.round(w * 100)}%`, p: ['hood', w] });
for (const w of [0.12, 0.22]) STRIPES.push({ n: `Faixa só no teto ${Math.round(w * 100)}%`, p: ['roof', w] });
for (const w of [0.14, 0.26]) STRIPES.push({ n: `Faixa traseira ${Math.round(w * 100)}%`, p: ['rear', w] });
STRIPES.push({ n: 'Metade inferior bicolor', p: ['lower', 0.3] }, { n: 'Saia bicolor', p: ['lower', 0.18] }, { n: 'Degradê frontal', p: ['grad', 0] }, { n: 'Degradê traseiro', p: ['grad', 1] }, { n: 'Degradê lateral', p: ['grad', 2] }, { n: 'Xadrez no teto', p: ['check', 0.12] }, { n: 'Xadrez no capô', p: ['check', 0.2] }, { n: 'Diagonal esportiva', p: ['diag', 0.3] }, { n: 'Diagonal larga', p: ['diag', 0.6] }, { n: 'Chamas laterais', p: ['flame', 0] }, { n: 'Pontas de chama (frente)', p: ['flame', 1] }, { n: 'Números de rali (portas)', p: ['num', 0] }, { n: 'Disco branco (portas)', p: ['num', 1] }, { n: 'Hexágonos', p: ['hex', 0] }, { n: 'Pontilhado', p: ['dots', 0] }, { n: 'Faixa Le Mans (cap + teto)', p: ['lemans', 0] }, { n: 'Faixa tipo Cobra', p: ['lemans', 1] }, { n: 'Listras de polícia', p: ['side', 0.3, 0.12] });
CATS.stripes = { key: 'stripes', label: 'Adesivos e listras', kind: 'vis', opts: STRIPES };
cat('headlight', 'Cor dos faróis', 'vis', null); cat('taillight', 'Lanternas traseiras', 'vis', null);
CATS.headlight.opts = [['Branco xenônio', '#ffffff', '#fff2dc'], ['Branco quente', '#fff0c8', '#ffe8b0'], ['Amarelo seletivo', '#ffd84a', '#ffd070'], ['Azul gelo', '#bcd8ff', '#c8e0ff'], ['Azul LED', '#9cc8ff', '#a8d0ff'], ['Verde', '#a8ffb8', '#b0ffc0'], ['Vermelho', '#ff7a7a', '#ff9a9a'], ['Roxo', '#d0a8ff', '#d8b8ff'], ['Âmbar', '#ffb060', '#ffc080'], ['Rosa', '#ffb0d8', '#ffc0e0']].map(([n, c, s]) => ({ n, v: c, s }));
CATS.taillight.opts = [['Vermelho original', '#ff1010'], ['Vermelho escuro (fumê)', '#a00808'], ['Vermelho LED', '#ff3030'], ['Branco-gelo', '#ffd8d8'], ['Âmbar', '#ff9020'], ['Azul', '#2060ff']].map(([n, v]) => ({ n, v }));
cat('glow', 'Neon sob o carro', 'vis', null);
CATS.glow.opts = [{ n: 'Desligado', v: null }, ...[['Azul', '#2a6cff'], ['Ciano', '#20e0ff'], ['Verde', '#30ff60'], ['Lima', '#b0ff20'], ['Amarelo', '#ffe030'], ['Laranja', '#ff8020'], ['Vermelho', '#ff2030'], ['Rosa', '#ff40c0'], ['Roxo', '#a040ff'], ['Branco', '#ffffff'], ['Arco-íris', 'rainbow'], ['Pulsante azul', 'pulse']].map(([n, v]) => ({ n: `Neon ${n}`, v }))];
cat('tint', 'Película dos vidros (predefinida)', 'preset', [[0, 'Transparente'], [0.15, 'Muito clara'], [0.3, 'Clara 70%'], [0.5, 'Média 50%'], [0.7, 'Escura 35%'], [0.85, 'Escura 20%'], [1, 'Fumê total 5%'], [0.6, 'Verde-fumê']].map(([v, n]) => ({ n, set: c => { c.tint = v; } })));
cat('plates', 'Placas', 'vis', vis(['Mercosul (BR)', 'Padrão antigo cinza (BR)', 'Europa (UE)', 'EUA branca', 'Preta colecionador', 'Sem placa']));
cat('rimcolor', 'Cor das rodas', 'preset', [['Prata', '#b8bcc4'], ['Prata escura', '#6f737a'], ['Grafite', '#2b2d31'], ['Preto brilhante', '#0a0a0c'], ['Preto fosco', '#18181a'], ['Branco', '#f2f2f2'], ['Cromado', '#e0e4ea'], ['Dourado', '#c59a2a'], ['Bronze', '#8a5a2a'], ['Champanhe', '#d8c9a0'], ['Vermelho', '#c0262d'], ['Bordô', '#6b1220'], ['Laranja', '#e8741a'], ['Amarelo', '#f2c40f'], ['Verde', '#2f9e44'], ['Verde-militar', '#4a5a2a'], ['Azul', '#1f5fbf'], ['Azul-marinho', '#14234f'], ['Azul-claro', '#4fa8e8'], ['Roxo', '#6a2aa8'], ['Rosa', '#e0509a'], ['Turquesa', '#12b5cb'], ['Lima', '#9ad12a'], ['Cinza-azulado', '#4a5568'], ['Gunmetal', '#3a3f47'], ['Titânio', '#8a8f96'], ['Cobre', '#b86a3a'], ['Ouro rosé', '#c9948a'], ['Bege', '#cdb892'], ['Marrom', '#5a3a22'], ['Vinho', '#4a1030'], ['Azul-petróleo', '#14606a'], ['Verde-água', '#1fa89a'], ['Magenta', '#b0208a'], ['Vermelho-sangue', '#8a0a14'], ['Branco pérola', '#ece8de']].map(([n, h]) => ({ n, set: c => { c.rimColor = h; } })));
cat('rimfinish', 'Acabamento das rodas', 'vis', vis(['Polido', 'Escovado', 'Fosco', 'Cromado espelhado']));
cat('caliper', 'Cor das pinças de freio', 'vis', null);
CATS.caliper.opts = [['Original', null], ['Vermelho', '#d01818'], ['Amarelo', '#f2c40f'], ['Azul', '#1f5fbf'], ['Laranja', '#e8741a'], ['Verde', '#2f9e44'], ['Branco', '#f2f2f2'], ['Preto', '#18181a'], ['Dourado', '#c59a2a'], ['Prata', '#b9bcc2'], ['Rosa', '#e0509a'], ['Roxo', '#6a2aa8'], ['Ciano', '#20c0e0'], ['Grafite', '#4a4d54']].map(([n, v]) => ({ n: `Pinças ${n}`, v }));
cat('sidewall', 'Lateral dos pneus', 'vis', vis(['Preta lisa', 'Letras brancas', 'Faixa vermelha', 'Faixa amarela', 'Faixa branca (white-wall)', 'Letras amarelas']));
cat('tips', 'Ponteiras de escape', 'vis', vis(['Original', 'Cromada redonda', 'Dupla cromada', 'Preta fosca', 'Titânio azulado', 'Carbono', 'Quádrupla', 'Central redonda', 'Oval grande', 'Saída lateral']));
cat('horn', 'Buzina', 'vis', vis(['Original', 'Dupla grave', 'Aguda esportiva', 'Ar comprimido (caminhão)', 'Clássica (fon-fon)', 'Sirene curta', 'Musical (La-cucaracha)', 'Cornetas italianas']));
cat('esound', 'Som do motor', 'vis', vis(['Original', 'Grave rouco', 'Agudo esportivo', 'Competição (cru)', 'Retrô', 'Surdo (abafado)', 'Metálico', 'Futurista']));
cat('interior', 'Cor do interior', 'vis', null);
CATS.interior.opts = [['Preto', '#17171a', '#0c0c10'], ['Cinza', '#4a4d52', '#202226'], ['Bege', '#b8a584', '#3a3228'], ['Marrom', '#6a4a2c', '#2a1e14'], ['Vermelho', '#a01820', '#1a0a0c'], ['Azul', '#1f3f8f', '#0a1020'], ['Branco', '#e8e8e8', '#35363a'], ['Laranja', '#d06a1a', '#1a1208'], ['Verde', '#2a6a3a', '#0e1a12'], ['Amarelo', '#d8b010', '#1a1608'], ['Tan caramelo', '#a8703a', '#2a1c10'], ['Bordô', '#5a1424', '#160a0e'], ['Cinza-claro', '#8a8d92', '#2a2c30'], ['Preto/vermelho', '#17171a', '#6a0a10'], ['Preto/azul', '#17171a', '#0a2a6a'], ['Carbono', '#202226', '#101114']].map(([n, v, d]) => ({ n, v, d }));
cat('wheelstyle', 'Volante (direção)', 'vis', vis(['Original', 'Esportivo pequeno', 'Esportivo fundo achatado', 'Madeira clássico', 'Competição (quick-release)', 'Grande de caminhão', 'Retrô de aro fino', 'Carbono']));
// estilos extras de roda (a aba Rodas lista tudo de WHEEL_STYLES)
const EXTRA_WS = [['five-thin', '5 raios finos', 5, 0.08, 0.03, 'spoke'], ['seven', '7 raios', 7, 0.1, 0.03, 'spoke'], ['nine', '9 raios', 9, 0.07, 0.03, 'spoke'], ['y-spoke', 'Raios em Y', 10, 0.09, 0.04, 'spoke', true], ['star6', 'Estrela de 6 pontas', 6, 0.2, 0.02, 'spoke'], ['split10', '10 raios divididos', 10, 0.05, 0.035, 'spoke', true], ['aero', 'Disco aerodinâmico', 14, 0.15, 0.0, 'fan'], ['basket', 'Basketweave', 24, 0.03, 0.02, 'mesh'], ['classic5', '5 raios clássica', 5, 0.2, 0.01, 'spoke'], ['cross', 'Cruz (centerlock)', 4, 0.25, 0.04, 'spoke'], ['honey', 'Colmeia', 30, 0.025, 0.015, 'mesh'], ['blade', 'Lâminas', 15, 0.06, 0.02, 'fan'], ['dishmesh', 'Malha deep dish', 18, 0.035, 0.08, 'mesh'], ['stepped', 'Degrau (stepped lip)', 12, 0.07, 0.09, 'spoke', true], ['rally', 'Rali (8 raios grossos)', 8, 0.22, 0.01, 'spoke'], ['pie', 'Fatias', 20, 0.1, 0.02, 'fan']];
for (const [id, name, spokes, w, dish, kind, twin] of EXTRA_WS) WHEEL_STYLES[id] = { name, spokes, w, dish, kind, twin: !!twin };

// ---------- agrupamento para a interface ----------
export const CAT_GROUPS = [
  { id: 'enginep', name: '🔧 Motor: peças', keys: ['fuel', 'ecu', 'intake', 'headers', 'exhaust', 'cams', 'head', 'injectors', 'pistons', 'oil'] },
  { id: 'forced', name: '🌀 Turbo & arrefecimento', keys: ['turbo', 'intercooler', 'wastegate', 'radiator', 'oilcooler', 'nitrosize'] },
  { id: 'drivep', name: '⛓ Embreagem & câmbio', keys: ['flywheel', 'clutch', 'shiftkit', 'driveshaft', 'finaldrive'] },
  { id: 'chassis', name: '🛠 Chassi & ajustes', keys: ['springs', 'dampers', 'arbs', 'braces', 'cage', 'rack', 'camber', 'toe', 'rideh', 'pressure'] },
  { id: 'brakep', name: '⛔ Freios: peças', keys: ['pads', 'rotors', 'lines', 'caliper'] },
  { id: 'tirep', name: '◎ Pneus & rodas: opções', keys: ['tiremodel', 'tiresize', 'rimcolor', 'rimfinish', 'sidewall'] },
  { id: 'aerop', name: '✈ Aerodinâmica: peças', keys: ['wingkit', 'splitter2', 'diffuser2', 'canards', 'skirts', 'floor', 'roofsp', 'hoodvent', 'louvers'] },
  { id: 'bodyp', name: '🚘 Carroceria & kits', keys: ['frontkit', 'rearkit', 'flares', 'hoodstyle', 'roofacc', 'mirrors', 'tips'] },
  { id: 'paintp', name: '🎨 Pintura & adesivos', keys: ['paint', 'paintmatte', 'roofcolor', 'stripes'] },
  { id: 'lights', name: '💡 Luzes, som & vidros', keys: ['headlight', 'taillight', 'glow', 'tint', 'plates', 'horn', 'esound', 'fog', 'pods'] },
  { id: 'intp', name: '🪑 Interior', keys: ['interior', 'wheelstyle'] },
  { id: 'offp', name: '⛰ Off-road & acessórios', keys: ['bullbar', 'winch', 'snorkel', 'spare', 'mudflaps', 'skid', 'steps', 'tow'] },
];

export function applyFx(cfg) {
  const f = { tq: 1, boost: 1, J: 1, red: 0, mass: 0, cdA: 0, clF: 0, clR: 0, mu: 1, crr: 0, brk: 1, clutch: 1, spring: 1, arb: 1, damp: 1, steer: 1, shift: 1, eta: 0, fric: 1, cool: 1, nitroS: 0, comp: null };
  const P = cfg.parts || {};
  for (const k in CATS) {
    const c = CATS[k]; if (c.kind !== 'fx') continue;
    if (c.show && !c.show(cfg)) continue;
    const o = c.opts[P[k] | 0]; if (!o || !o.fx) continue;
    for (const key in o.fx) {
      if (key === 'comp') f.comp = o.fx[key];
      else if (['tq', 'boost', 'J', 'mu', 'brk', 'clutch', 'spring', 'arb', 'damp', 'steer', 'shift', 'fric', 'cool'].includes(key)) f[key] *= o.fx[key]; else f[key] += o.fx[key];
    }
  }
  f.tq = Math.min(f.tq, 1.45); f.boost = Math.min(f.boost, 1.7); f.J = Math.max(f.J, 0.4);
  return f;
}

export function countOptions() {
  let parts = 0, per = {};
  for (const k in CATS) { const c = CATS[k]; const n = c.opts.length; parts += n; }
  const base = Object.keys(WHEEL_STYLES).length + Object.keys(COMPOUNDS).length + Object.keys(BRAKES).length + Object.keys(GEARBOXES).length + Object.keys(DIFFS).length + Object.keys(CENTER_DIFFS).length + Object.keys(SUSP_PRESETS).length + 5 + 4 + 5 + 4 + 3 + 3 + 5 + 4 + 5;
  return { catalog: parts, base, total: parts + base, categories: Object.keys(CATS).length };
}
