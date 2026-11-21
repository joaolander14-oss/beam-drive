// ============================================================
//  100+ motos reais (dados de ficha técnica aproximados) — geradas a partir de linhas compactas.
//  Linha: [id, nome, estilo, kg(seca+óleo/combustível, sem piloto), tipo motor (n/t/s/e), cilindros, litros, cv (kW p/ elétrica),
//          rpm cv, Nm, rpm Nm, corte, cor, extras]
//  Estilos: sport, naked, adv, cruiser, tour, classic, street, scooter, moto (fora-de-estrada), mini
// ============================================================
import { CARS, ENGINES, GEARBOXES, buildCurve, clamp, tireDims, RHO, HP } from './data.js';

GEARBOXES.m4 = { name: '4 marchas moto (sequencial)', type: 'manual', r: [2.85, 1.80, 1.30, 1.00], rev: 3.0, fin: 3.0, mass: 8, shift: 0.14 };
GEARBOXES.m5 = { name: '5 marchas moto (sequencial)', type: 'manual', r: [2.80, 1.85, 1.38, 1.12, 0.96], rev: 3.0, fin: 3.0, mass: 10, shift: 0.12 };
GEARBOXES.m6 = { name: '6 marchas moto (sequencial)', type: 'manual', r: [2.62, 1.94, 1.58, 1.34, 1.17, 1.04], rev: 3.0, fin: 3.0, mass: 12, shift: 0.09 };

// dimensões e geometria por estilo: [comp, larg(guidão), alt, entre-eixos, altura do CG, resistência Cd, área frontal m², suspensão (curso frente, trás)]
const ST = {
  sport:    { L: 2.05, W: 0.72, H: 1.15, WB: 1.40, cg: 0.58, cd: 0.58, A: 0.60, trav: [0.12, 0.13], kf: 1.0, label: 'Esportiva' },
  naked:    { L: 2.07, W: 0.82, H: 1.10, WB: 1.43, cg: 0.60, cd: 0.68, A: 0.70, trav: [0.12, 0.13], kf: 1.0, label: 'Naked' },
  adv:      { L: 2.25, W: 0.95, H: 1.45, WB: 1.55, cg: 0.70, cd: 0.80, A: 0.85, trav: [0.20, 0.20], kf: 0.85, label: 'Aventureira' },
  cruiser:  { L: 2.35, W: 0.95, H: 1.15, WB: 1.65, cg: 0.52, cd: 0.78, A: 0.78, trav: [0.10, 0.08], kf: 0.9, label: 'Custom' },
  tour:     { L: 2.45, W: 0.95, H: 1.40, WB: 1.70, cg: 0.58, cd: 0.62, A: 0.90, trav: [0.13, 0.12], kf: 0.9, label: 'Touring' },
  classic:  { L: 2.15, W: 0.85, H: 1.10, WB: 1.45, cg: 0.58, cd: 0.72, A: 0.72, trav: [0.12, 0.10], kf: 0.9, label: 'Clássica' },
  street:   { L: 1.95, W: 0.75, H: 1.05, WB: 1.28, cg: 0.55, cd: 0.70, A: 0.62, trav: [0.11, 0.09], kf: 0.9, label: 'Urbana' },
  scooter:  { L: 1.95, W: 0.72, H: 1.20, WB: 1.35, cg: 0.50, cd: 0.72, A: 0.66, trav: [0.09, 0.08], kf: 0.8, label: 'Scooter' },
  moto:     { L: 2.15, W: 0.83, H: 1.25, WB: 1.48, cg: 0.70, cd: 0.78, A: 0.70, trav: [0.28, 0.28], kf: 0.8, label: 'Fora-de-estrada' },
  mini:     { L: 1.75, W: 0.70, H: 0.95, WB: 1.20, cg: 0.50, cd: 0.70, A: 0.55, trav: [0.09, 0.08], kf: 0.9, label: 'Mini' },
  ev:       { L: 2.05, W: 0.80, H: 1.10, WB: 1.42, cg: 0.56, cd: 0.62, A: 0.65, trav: [0.12, 0.13], kf: 1.0, label: 'Elétrica' },
};

const B = [
  // ---------- esportivas ----------
  ['r1', 'Yamaha YZF-R1', 'sport', 201, 'n', 4, 0.998, 200, 13500, 113, 11500, 14500, '#1e4aa8'],
  ['r6', 'Yamaha YZF-R6', 'sport', 190, 'n', 4, 0.599, 118, 14500, 66, 10500, 16500, '#c0392b'],
  ['r7', 'Yamaha YZF-R7', 'sport', 188, 'n', 2, 0.689, 73, 8750, 67, 6500, 10000, '#1e4aa8'],
  ['r3', 'Yamaha YZF-R3', 'sport', 169, 'n', 2, 0.321, 42, 10750, 30, 9000, 12000, '#1e4aa8'],
  ['cbr1000', 'Honda CBR1000RR-R Fireblade SP', 'sport', 201, 'n', 4, 1.0, 217, 14500, 113, 12500, 15500, '#c0392b'],
  ['cbr600', 'Honda CBR600RR', 'sport', 194, 'n', 4, 0.599, 118, 13500, 66, 11250, 16000, '#c0392b'],
  ['cbr500', 'Honda CBR500R', 'sport', 192, 'n', 2, 0.471, 47, 8600, 43, 6500, 9500, '#c0392b'],
  ['cbr250', 'Honda CBR250R', 'sport', 161, 'n', 1, 0.249, 26, 8500, 23, 7000, 10000, '#f2f2f2'],
  ['cbr650', 'Honda CBR650R', 'sport', 208, 'n', 4, 0.649, 95, 12000, 64, 9500, 12700, '#c0392b'],
  ['zx10r', 'Kawasaki Ninja ZX-10R', 'sport', 207, 'n', 4, 0.998, 203, 13200, 115, 11400, 14700, '#2ecc71'],
  ['zx6r', 'Kawasaki Ninja ZX-6R', 'sport', 196, 'n', 4, 0.636, 130, 13500, 71, 11000, 15500, '#2ecc71'],
  ['zx14r', 'Kawasaki Ninja ZX-14R', 'sport', 268, 'n', 4, 1.441, 200, 10000, 162, 7500, 11000, '#1f1f22'],
  ['ninja400', 'Kawasaki Ninja 400', 'sport', 168, 'n', 2, 0.399, 49, 10000, 38, 8000, 11000, '#2ecc71'],
  ['ninja650', 'Kawasaki Ninja 650', 'sport', 193, 'n', 2, 0.649, 68, 8000, 66, 6500, 9000, '#2ecc71'],
  ['h2', 'Kawasaki Ninja H2', 'sport', 238, 's', 4, 0.998, 231, 11500, 141, 10500, 14500, '#1f1f22'],
  ['gsxr1000', 'Suzuki GSX-R1000', 'sport', 203, 'n', 4, 0.999, 202, 13200, 118, 10800, 14500, '#1e4aa8'],
  ['gsxr750', 'Suzuki GSX-R750', 'sport', 190, 'n', 4, 0.750, 148, 13200, 86, 11000, 14500, '#1e4aa8'],
  ['gsxr600', 'Suzuki GSX-R600', 'sport', 188, 'n', 4, 0.599, 125, 13500, 70, 11000, 15500, '#1e4aa8'],
  ['hayabusa', 'Suzuki Hayabusa', 'sport', 264, 'n', 4, 1.340, 190, 9700, 150, 7000, 11000, '#9aa0a6'],
  ['panigale', 'Ducati Panigale V4 S', 'sport', 195, 'n', 4, 1.103, 214, 13000, 124, 10000, 14500, '#c0392b'],
  ['p1299', 'Ducati 1299 Panigale', 'sport', 190, 'n', 2, 1.285, 205, 10500, 144, 8750, 11500, '#c0392b'],
  ['p959', 'Ducati 959 Panigale', 'sport', 200, 'n', 2, 0.955, 157, 10500, 102, 9000, 11500, '#c0392b'],
  ['d916', 'Ducati 916', 'classic', 195, 'n', 2, 0.916, 114, 8900, 90, 6000, 9800, '#c0392b'],
  ['rsv4', 'Aprilia RSV4 1100', 'sport', 199, 'n', 4, 1.077, 217, 13000, 122, 10500, 13600, '#1f1f22'],
  ['rs660', 'Aprilia RS 660', 'sport', 183, 'n', 2, 0.659, 100, 10500, 67, 8500, 11500, '#2d6ab0'],
  ['rs125', 'Aprilia RS 125', 'sport', 140, 'n', 1, 0.125, 15, 10000, 11.5, 8000, 11500, '#1f1f22'],
  ['rc390', 'KTM RC 390', 'sport', 172, 'n', 1, 0.373, 44, 9000, 37, 7000, 10500, '#e67e22'],
  ['s1000rr', 'BMW S 1000 RR', 'sport', 197, 'n', 4, 0.999, 207, 13500, 113, 11000, 15000, '#f2f2f2'],
  ['daytona', 'Triumph Daytona 675', 'sport', 184, 'n', 3, 0.675, 126, 12500, 72, 11750, 14500, '#1f1f22'],
  ['mvf3', 'MV Agusta F3 800', 'sport', 173, 'n', 3, 0.798, 148, 13000, 88, 10600, 14000, '#c0392b'],
  ['nsr500', 'Honda NSR500 (GP)', 'sport', 131, 'n', 4, 0.498, 190, 12500, 105, 11000, 13500, '#f2f2f2', { gp: 1 }],
  ['m1', 'Yamaha YZR-M1 (MotoGP)', 'sport', 157, 'n', 4, 0.999, 270, 17000, 120, 13000, 18000, '#1e4aa8', { gp: 1 }],
  ['rc213v', 'Honda RC213V-S', 'sport', 170, 'n', 4, 0.999, 215, 13000, 120, 10500, 14500, '#c0392b', { gp: 1 }],
  // ---------- naked ----------
  ['mt03', 'Yamaha MT-03', 'naked', 168, 'n', 2, 0.321, 42, 10750, 30, 9000, 12000, '#2d6ab0'],
  ['mt07', 'Yamaha MT-07', 'naked', 184, 'n', 2, 0.689, 73, 8750, 67, 6500, 10000, '#1f1f22'],
  ['mt09', 'Yamaha MT-09', 'naked', 189, 'n', 3, 0.890, 119, 10000, 93, 7000, 11000, '#2d6ab0'],
  ['mt10', 'Yamaha MT-10', 'naked', 210, 'n', 4, 0.998, 166, 11500, 112, 9000, 13000, '#1f1f22'],
  ['z900', 'Kawasaki Z900', 'naked', 212, 'n', 4, 0.948, 125, 9500, 99, 7700, 11000, '#2ecc71'],
  ['z650', 'Kawasaki Z650', 'naked', 188, 'n', 2, 0.649, 68, 8000, 64, 6700, 9000, '#2ecc71'],
  ['z1000', 'Kawasaki Z1000', 'naked', 220, 'n', 4, 1.043, 142, 10000, 111, 7300, 11200, '#1f1f22'],
  ['zh2', 'Kawasaki Z H2', 'naked', 240, 's', 4, 0.998, 200, 11000, 137, 8500, 12500, '#1f1f22'],
  ['cb300r', 'Honda CB 300R', 'naked', 147, 'n', 1, 0.286, 31, 8500, 27.5, 7250, 9500, '#c0392b'],
  ['cb650r', 'Honda CB650R', 'naked', 202, 'n', 4, 0.649, 95, 12000, 64, 8500, 12800, '#1f1f22'],
  ['cb1000r', 'Honda CB1000R', 'naked', 212, 'n', 4, 0.998, 145, 10500, 104, 8250, 11500, '#1f1f22'],
  ['hornet', 'Honda Hornet CB600F', 'naked', 200, 'n', 4, 0.599, 102, 12000, 63, 9500, 13000, '#f1c40f'],
  ['cb500f', 'Honda CB500F', 'naked', 189, 'n', 2, 0.471, 47, 8600, 43, 6500, 9500, '#c0392b'],
  ['gsxs1000', 'Suzuki GSX-S1000', 'naked', 214, 'n', 4, 0.999, 150, 10000, 106, 9500, 11500, '#1e4aa8'],
  ['sv650', 'Suzuki SV650', 'naked', 197, 'n', 2, 0.645, 75, 8500, 64, 8100, 9500, '#1e4aa8'],
  ['duke390', 'KTM 390 Duke', 'naked', 163, 'n', 1, 0.373, 44, 9000, 37, 7000, 10000, '#e67e22'],
  ['duke890', 'KTM 890 Duke R', 'naked', 169, 'n', 2, 0.889, 121, 9250, 99, 8000, 10000, '#e67e22'],
  ['sduke', 'KTM 1290 Super Duke R', 'naked', 200, 'n', 2, 1.301, 180, 9500, 140, 8000, 10200, '#e67e22'],
  ['monster', 'Ducati Monster 821', 'naked', 206, 'n', 2, 0.821, 112, 9250, 89, 7750, 10000, '#c0392b'],
  ['sf4', 'Ducati Streetfighter V4', 'naked', 199, 'n', 4, 1.103, 208, 12750, 123, 11500, 14000, '#c0392b'],
  ['tuono', 'Aprilia Tuono V4', 'naked', 209, 'n', 4, 1.077, 175, 11000, 121, 9000, 13000, '#1f1f22'],
  ['streettriple', 'Triumph Street Triple RS', 'naked', 188, 'n', 3, 0.765, 123, 11750, 79, 9350, 13000, '#9aa0a6'],
  ['speedtriple', 'Triumph Speed Triple 1200 RS', 'naked', 199, 'n', 3, 1.160, 180, 10750, 125, 9000, 11500, '#1f1f22'],
  ['g310r', 'BMW G 310 R', 'naked', 158, 'n', 1, 0.313, 34, 9500, 28, 7500, 10500, '#2d6ab0'],
  ['s1000r', 'BMW S 1000 R', 'naked', 199, 'n', 4, 0.999, 165, 11000, 114, 9250, 13000, '#f2f2f2'],
  ['pulsar', 'Bajaj Pulsar 200 NS', 'naked', 154, 'n', 1, 0.199, 24, 9750, 18.7, 8000, 10500, '#1f1f22'],
  // ---------- urbanas / econômicas ----------
  ['cg160', 'Honda CG 160 Titan', 'street', 116, 'n', 1, 0.162, 15, 8000, 14, 6500, 9000, '#c0392b'],
  ['cg125', 'Honda CG 125 Fan', 'street', 108, 'n', 1, 0.125, 10, 7500, 9.7, 6000, 8500, '#c0392b'],
  ['pop110', 'Honda Pop 110i', 'street', 97, 'n', 1, 0.109, 7.9, 7500, 8.5, 5500, 8500, '#e67e22'],
  ['biz125', 'Honda Biz 125', 'street', 101, 'n', 1, 0.125, 9.4, 7500, 9.3, 5500, 8500, '#c0392b'],
  ['factor150', 'Yamaha Factor 150', 'street', 125, 'n', 1, 0.149, 12.4, 8000, 12.5, 6000, 9000, '#1f1f22'],
  ['fazer250', 'Yamaha Fazer 250', 'street', 154, 'n', 1, 0.249, 21, 7500, 21, 6000, 8500, '#c0392b'],
  ['gixxer', 'Suzuki Gixxer 150', 'street', 135, 'n', 1, 0.155, 14, 8000, 14, 6000, 9500, '#2d6ab0'],
  ['dominar', 'Bajaj Dominar 400', 'tour', 182, 'n', 1, 0.373, 40, 8650, 35, 6500, 9500, '#1f1f22'],
  ['cubc125', 'Honda Super Cub C125', 'mini', 109, 'n', 1, 0.125, 9.4, 7500, 10.4, 5000, 8500, '#c0392b'],
  ['monkey', 'Honda Monkey 125', 'mini', 107, 'n', 1, 0.125, 9.3, 6750, 11, 5250, 7500, '#f1c40f'],
  ['grom', 'Honda Grom', 'mini', 103, 'n', 1, 0.125, 9.7, 7250, 10.9, 5500, 8500, '#e67e22'],
  // ---------- aventureiras / trail ----------
  ['gs1250', 'BMW R 1250 GS', 'adv', 249, 'n', 2, 1.254, 136, 7750, 143, 6250, 8500, '#f2f2f2', { boxer: 1 }],
  ['f850gs', 'BMW F 850 GS', 'adv', 233, 'n', 2, 0.853, 95, 8250, 92, 6250, 9000, '#e67e22'],
  ['africa', 'Honda Africa Twin CRF1100L', 'adv', 226, 'n', 2, 1.084, 102, 7500, 105, 6250, 8500, '#c0392b'],
  ['tenere', 'Yamaha Ténéré 700', 'adv', 205, 'n', 2, 0.689, 73, 9000, 68, 6500, 10000, '#2d6ab0'],
  ['versys', 'Kawasaki Versys 650', 'adv', 216, 'n', 2, 0.649, 69, 8500, 64, 7000, 9500, '#2ecc71'],
  ['vstrom1000', 'Suzuki V-Strom 1000', 'adv', 233, 'n', 2, 0.999, 100, 8000, 103, 5500, 9500, '#f1c40f'],
  ['vstrom650', 'Suzuki V-Strom 650', 'adv', 213, 'n', 2, 0.645, 71, 8800, 62, 6500, 9500, '#1f1f22'],
  ['ktm1290', 'KTM 1290 Super Adventure R', 'adv', 249, 'n', 2, 1.301, 160, 9000, 138, 6500, 9500, '#e67e22'],
  ['tiger900', 'Triumph Tiger 900 Rally', 'adv', 201, 'n', 3, 0.888, 95, 8750, 87, 7250, 9500, '#f2f2f2'],
  ['multistrada', 'Ducati Multistrada V4', 'adv', 240, 'n', 4, 1.158, 170, 10500, 125, 8750, 11000, '#c0392b'],
  ['himalayan', 'Royal Enfield Himalayan', 'adv', 191, 'n', 1, 0.411, 24, 6500, 32, 4000, 7500, '#9aa0a6'],
  ['xre300', 'Honda XRE 300', 'adv', 148, 'n', 1, 0.291, 25, 7500, 28, 6500, 8500, '#c0392b'],
  ['lander', 'Yamaha XTZ 250 Lander', 'adv', 138, 'n', 1, 0.249, 21, 7000, 21, 6000, 8500, '#2d6ab0'],
  ['bros160', 'Honda NXR 160 Bros', 'adv', 130, 'n', 1, 0.162, 15, 8000, 14, 6500, 9000, '#c0392b'],
  ['cb500x', 'Honda CB500X', 'adv', 199, 'n', 2, 0.471, 47, 8600, 43, 6500, 9500, '#2d6ab0'],
  // ---------- custom / cruiser / touring ----------
  ['fatboy', 'Harley-Davidson Fat Boy 114', 'cruiser', 317, 'n', 2, 1.868, 95, 5020, 155, 3000, 5800, '#1f1f22'],
  ['streetglide', 'Harley-Davidson Street Glide', 'tour', 369, 'n', 2, 1.868, 93, 5020, 163, 3250, 5800, '#c0392b'],
  ['iron883', 'Harley-Davidson Iron 883', 'cruiser', 256, 'n', 2, 0.883, 53, 6000, 70, 3750, 6200, '#1f1f22'],
  ['vrod', 'Harley-Davidson V-Rod', 'cruiser', 300, 'n', 2, 1.250, 125, 8250, 115, 6500, 9000, '#9aa0a6'],
  ['scout', 'Indian Scout', 'cruiser', 255, 'n', 2, 1.133, 100, 8100, 98, 6000, 8500, '#c0392b'],
  ['chief', 'Indian Chief Dark Horse', 'cruiser', 346, 'n', 2, 1.811, 90, 4500, 162, 3000, 5200, '#1f1f22'],
  ['shadow', 'Honda Shadow 750', 'cruiser', 237, 'n', 2, 0.745, 45, 5500, 60, 3500, 6500, '#1f1f22'],
  ['rebel', 'Honda Rebel 500', 'cruiser', 191, 'n', 2, 0.471, 47, 8600, 43, 6000, 9500, '#1f1f22'],
  ['vulcan', 'Kawasaki Vulcan S', 'cruiser', 228, 'n', 2, 0.649, 61, 7500, 62, 6600, 8500, '#9aa0a6'],
  ['m109', 'Suzuki Boulevard M109R', 'cruiser', 315, 'n', 2, 1.783, 125, 6200, 160, 3200, 6800, '#1f1f22'],
  ['diavel', 'Ducati Diavel 1260', 'cruiser', 244, 'n', 2, 1.262, 159, 9500, 129, 7500, 10500, '#1f1f22'],
  ['rocket3', 'Triumph Rocket 3 R', 'cruiser', 291, 'n', 3, 2.458, 167, 6000, 221, 4000, 6750, '#1f1f22'],
  ['goldwing', 'Honda Gold Wing', 'tour', 383, 'n', 6, 1.833, 126, 5500, 170, 4500, 6000, '#9aa0a6'],
  ['k1600', 'BMW K 1600 GTL', 'tour', 348, 'n', 6, 1.649, 160, 7750, 175, 5250, 8500, '#2c3e50'],
  // ---------- clássicas ----------
  ['bonneville', 'Triumph Bonneville T120', 'classic', 236, 'n', 2, 1.200, 79, 6550, 105, 3500, 7500, '#2d4f3a'],
  ['scrambler', 'Ducati Scrambler Icon', 'classic', 186, 'n', 2, 0.803, 73, 8250, 66, 5750, 9000, '#f1c40f'],
  ['rninet', 'BMW R nineT', 'classic', 222, 'n', 2, 1.170, 110, 7750, 119, 6000, 8500, '#9aa0a6', { boxer: 1 }],
  ['interceptor', 'Royal Enfield Interceptor 650', 'classic', 202, 'n', 2, 0.648, 47, 7250, 52, 5250, 7500, '#c0392b'],
  ['classic350', 'Royal Enfield Classic 350', 'classic', 195, 'n', 1, 0.349, 20, 6100, 27, 4000, 6800, '#2d4f3a'],
  ['sr400', 'Yamaha SR400', 'classic', 175, 'n', 1, 0.399, 24, 6500, 29, 3000, 7000, '#1f1f22'],
  ['cb750', 'Honda CB750 Four (1969)', 'classic', 218, 'n', 4, 0.736, 67, 8000, 60, 7000, 8800, '#c0392b'],
  ['z1', 'Kawasaki Z1 900 (1973)', 'classic', 230, 'n', 4, 0.903, 82, 8500, 75, 7000, 9000, '#e67e22'],
  ['h2mach', 'Kawasaki H2 Mach IV 750', 'classic', 205, 'n', 3, 0.748, 74, 6800, 79, 6500, 7500, '#e67e22'],
  ['rd350', 'Yamaha RD350', 'classic', 155, 'n', 2, 0.347, 39, 7500, 38, 7000, 8500, '#f2f2f2'],
  ['commando', 'Norton Commando 850', 'classic', 200, 'n', 2, 0.828, 58, 5900, 66, 5000, 6700, '#1f1f22'],
  ['vincent', 'Vincent Black Shadow', 'classic', 208, 'n', 2, 0.998, 55, 5700, 80, 4000, 6200, '#1f1f22'],
  // ---------- fora-de-estrada ----------
  ['crf450', 'Honda CRF450R', 'moto', 112, 'n', 1, 0.449, 55, 9000, 50, 7500, 10500, '#c0392b'],
  ['kx450', 'Kawasaki KX450', 'moto', 111, 'n', 1, 0.449, 55, 9000, 50, 7500, 10500, '#2ecc71'],
  ['exc450', 'KTM 450 EXC-F', 'moto', 112, 'n', 1, 0.449, 55, 9000, 50, 7500, 10500, '#e67e22'],
  ['crf250l', 'Honda CRF 250L', 'moto', 144, 'n', 1, 0.249, 24, 8500, 23, 6500, 9500, '#c0392b'],
  ['klx300', 'Kawasaki KLX 300', 'moto', 138, 'n', 1, 0.292, 27, 8000, 26, 6500, 9000, '#2ecc71'],
  ['drz400', 'Suzuki DR-Z400SM', 'moto', 133, 'n', 1, 0.398, 39, 7500, 39, 5000, 8500, '#f1c40f'],
  ['xr650', 'Honda XR650L', 'moto', 162, 'n', 1, 0.644, 45, 6000, 55, 5000, 7000, '#c0392b'],
  ['smc690', 'KTM 690 SMC R', 'moto', 147, 'n', 1, 0.693, 74, 8000, 74, 6750, 8500, '#e67e22'],
  // ---------- scooters ----------
  ['pcx', 'Honda PCX 160', 'scooter', 132, 'n', 1, 0.157, 15.8, 8500, 15, 6500, 9500, '#f2f2f2'],
  ['nmax', 'Yamaha NMAX 160', 'scooter', 127, 'n', 1, 0.155, 15, 8000, 14, 6000, 9000, '#2d6ab0'],
  ['xmax', 'Yamaha XMAX 300', 'scooter', 180, 'n', 1, 0.292, 28, 7250, 29, 5750, 8500, '#9aa0a6'],
  ['burgman', 'Suzuki Burgman 400', 'scooter', 215, 'n', 1, 0.400, 31, 6300, 36, 4800, 7500, '#1f1f22'],
  ['vespa', 'Vespa Primavera 150', 'scooter', 130, 'n', 1, 0.155, 12.7, 7750, 13, 5500, 8500, '#f1c40f'],
  ['forza', 'Honda Forza 350', 'scooter', 187, 'n', 1, 0.330, 29, 7500, 31.5, 5250, 8500, '#2c3e50'],
  ['tmax', 'Yamaha T-Max 560', 'scooter', 220, 'n', 2, 0.562, 47, 7500, 56, 5250, 8500, '#1f1f22'],
  // ---------- elétricas ----------
  ['zerosrf', 'Zero SR/F', 'ev', 225, 'e', 0, 0, 82, 0, 190, 0, 10500, '#1f1f22'],
  ['zerofxe', 'Zero FXE', 'ev', 134, 'e', 0, 0, 33, 0, 100, 0, 9500, '#2d6ab0'],
  ['energica', 'Energica Ego', 'ev', 258, 'e', 0, 0, 108, 0, 215, 0, 11000, '#c0392b'],
  ['livewire', 'Harley-Davidson LiveWire One', 'ev', 249, 'e', 0, 0, 78, 0, 116, 0, 9500, '#f1c40f'],
  ['ls218', 'Lightning LS-218', 'sport', 253, 'e', 0, 0, 150, 0, 228, 0, 12000, '#2d6ab0'],
  ['supersoco', 'Super Soco TC Max', 'ev', 95, 'e', 0, 0, 4, 0, 14, 0, 6500, '#f2f2f2'],
  ['damon', 'Damon Hypersport', 'sport', 245, 'e', 0, 0, 148, 0, 200, 0, 12500, '#1f1f22'],
].map(r => [...r]);

const TIRES = {
  sport: hp => hp > 150 ? ['120/70R17', '190/55R17'] : hp > 80 ? ['120/70R17', '180/55R17'] : hp > 35 ? ['110/70R17', '140/70R17'] : ['100/80R17', '130/70R17'],
  naked: hp => hp > 140 ? ['120/70R17', '190/55R17'] : hp > 70 ? ['120/70R17', '180/55R17'] : hp > 35 ? ['110/70R17', '160/60R17'] : ['110/70R17', '140/70R17'],
  adv: hp => hp > 80 ? ['120/70R19', '170/60R17'] : hp > 30 ? ['110/80R19', '150/70R17'] : ['90/90R21', '120/80R18'],
  cruiser: hp => hp > 100 ? ['130/70R18', '200/55R17'] : hp > 50 ? ['130/60R19', '180/65R16'] : ['100/90R19', '150/80R16'],
  tour: hp => hp > 100 ? ['130/70R18', '180/60R16'] : ['110/80R18', '140/70R17'],
  classic: hp => hp > 80 ? ['120/70R17', '180/55R17'] : hp > 30 ? ['100/90R19', '130/80R17'] : ['90/90R18', '110/80R17'],
  street: hp => ['80/100R17', '90/90R18'].map(t => t),
  scooter: hp => hp > 25 ? ['120/70R15', '150/70R14'] : ['110/70R14', '130/70R13'],
  moto: hp => hp > 40 ? ['80/100R21', '110/90R19'] : ['80/100R21', '100/100R18'],
  mini: hp => ['120/70R12', '130/70R12'],
  ev: hp => hp > 70 ? ['120/70R17', '180/55R17'] : hp > 20 ? ['110/70R17', '140/70R17'] : ['110/70R17', '120/70R17'],
};
const COOL = { n: 'aspirado', t: 'turbo', s: 'supercharger', e: 'elétrico' };

export const BIKE_IDS = [];
for (const r of B) {
  const [id, name, style, kg, kind, cyl, disp, hp, rpmP, nm, rpmT, red, color, ex = {}] = r;
  const S = ST[style], isEV = kind === 'e';
  // motor
  const e = { id, kind: { n: 'na', t: 'turbo', s: 'sc', e: 'ev' }[kind], cyl, disp };
  if (isEV) Object.assign(e, { name: `Motor elétrico ${hp} kW`, Tmax: nm, Pmax: hp, idle: 0, red, mass: 25 + hp * 0.25, battery: 60 + hp * 0.6, J: 0.012 + hp / 20000, regen: 0.3 });
  else {
    Object.assign(e, { name: `${disp.toFixed(2)} ${cyl}cil ${COOL[kind]} · ${hp} cv`, tq: [rpmT, nm], pw: [rpmP, hp], idle: 1250, red, mass: Math.round(18 + disp * 22), J: 0.012 + disp * 0.012, fric: 0.09 });
    if (kind === 's') { e.tq2 = Math.min(red * 0.85, rpmT + 2200); if (e.tq2 >= rpmP) e.tq2 = rpmP - 500; e.boost = { bar: 0.7, lo: 500, hi: 1200 }; }
    if (rpmT >= rpmP) e.pw = [rpmT + 100, hp];
  }
  if (ex.boxer) e.boxer = true;
  ENGINES['b_' + id] = e; buildCurve(e);
  const gb = isEV ? 'ev-1' : style === 'scooter' ? 'cvt' : hp < 12 ? 'm4' : hp < 32 ? 'm5' : 'm6';
  const [tf, tr] = TIRES[style](hp).map(t => { const m = t.match(/(\d+)\/(\d+)R(\d+)/); return [+m[1], +m[2], +m[3]]; });
  const wB = ex.WB || S.WB, L = S.L * (ex.gp ? 0.96 : 1), H = ex.gp ? 1.05 : S.H;
  const distF = style === 'cruiser' || style === 'tour' ? 0.47 : style === 'sport' ? 0.51 : 0.50;
  const M = kg;
  // molas: afundamento estático ~ 5 cm por entrada (as 4 rodas são pares)
  const sagK = k => Math.round(M * 9.81 * k / 2 / 0.05 / 1000 * (ex.gp ? 1.3 : S.kf));
  const kF = Math.max(4, sagK(distF)), kR = Math.max(4, sagK(1 - distF));
  const isGp = !!ex.gp;
  const wheel = style === 'moto' || style === 'adv' ? 'spoke' : style === 'classic' || style === 'cruiser' ? 'spoke' : 'five';
  const obj = {
    bike: true, style, name, sub: `Moto ${S.label} · ${hp}${isEV ? ' kW' : ' cv'} · ${Math.round(kg)} kg · inspirada no modelo real`, cls: 'Moto ' + S.label, brand: name.split(' ')[0], nw: true,
    L, W: S.W, H, WB: wB, fo: L * 0.30 - wB * 0.12, tF: 0.12, tR: 0.12, cgH: S.cg, mass: M, distF,
    engX: wB * 0.58, drvX: wB * 0.5, drive: 'rwd', eng: 'b_' + id, gb, fin: 3.0, tf, tr, comp: isGp ? 'sport' : hp > 90 ? 'sport' : style === 'moto' || style === 'adv' ? 'at' : 'street',
    spr: [kF, kR], arb: [0, 0], damp: [0.28, 0.40], trav: S.trav,
    brk: { k: isGp ? 1.0 : 0.95, bias: 0.62 }, cd: S.cd, A: S.A, dfF: 0, dfR: 0, steer: style === 'cruiser' || style === 'tour' ? 0.55 : 0.50, ack: 0, camber: [0, 0], toe: [0, 0],
    wheel, color, rimColor: style === 'sport' || hp > 100 ? '#2b2d31' : '#b8bcc4', spoiler: 'none',
    shape: { belt: [0.8, 0.85], xc: 0.35, xt: 0.98, roofW: 0.3, nt: 0.5, hf: 0.7 },
    bikeStyle: style, tank: clamp(isEV ? 1 : 8 + hp / 12 + (style === 'adv' || style === 'tour' ? 10 : style === 'moto' ? -2 : 0), 6, 30),
  };
  obj.dir = 'open'; obj.dif = 'open';
  // relação final calculada para a velocidade máxima física
  const gbx = GEARBOXES[gb], last = gbx.r[gbx.r.length - 1];
  const cdA = obj.cd * obj.A, Pw = hp * (isEV ? 1000 : HP) * 0.85;
  let v = 25; for (let i = 0; i < 80; i++) { const need = 0.5 * RHO * cdA * v * v * v + 0.018 * (kg + 75) * 9.81 * v; v += (Pw - need) / (1.5 * RHO * cdA * v * v + 0.018 * (kg + 75) * 9.81) * 0.7; }
  const vcap = (style === 'sport' || style === 'naked' || style === 'adv' ? (hp > 150 ? 299 : 280) : 220) / 3.6;
  const vt = Math.min(v, vcap, style === 'moto' ? 130 / 3.6 : style === 'mini' ? 105 / 3.6 : 999);
  const Rw = tireDims(...tr).R;
  const rpmTop = red * (isEV ? 0.97 : 0.95);
  let fin = (rpmTop * Math.PI / 30 * Rw / vt) / last;
  fin = isEV ? clamp(fin, 0.4, 2.5) : clamp(fin, 1.6, 9);
  obj.fin = +fin.toFixed(2);
  CARS[id] = obj; BIKE_IDS.push(id);
}
