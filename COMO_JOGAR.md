# Beam Drive — Simulador de Veículos (HTML + CSS + three.js)

Simulador de veículos estilo BeamNG: carros baseados em modelos reais, física de verdade
(corpo rígido 6 graus de liberdade, suspensão, pneu com escorregamento combinado, motor,
embreagem, câmbio e diferenciais) e **deformação da lataria** nas batidas.

## Como abrir
- Dê dois cliques em **Jogar.bat** (precisa de Python) — abre `http://localhost:8330`
- ou: `python serve.py 8330` dentro desta pasta.

## Carros (157 modelos prontos)
Inspirados em carros reais — de Fiat Uno e Fusca a Ferrari F40, Porsche 911 GT3, Tesla Model S Plaid, Land Rover Defender, Ford F-150 Raptor, Rimac Nevera…
Cada um tem ficha técnica própria (massa, motor com curva de torque, câmbio, tração, pneus, suspensão). Há busca e filtro por classe no menu Carros.
(Nomes de marcas são usados apenas para identificar o modelo que inspirou o carro; o projeto não tem relação com as fabricantes.)

## Mapas (4)
Campo de Provas (arrancada 400 m, skidpad, slalom, rampas, muros, off-road) ·
Serra do Rio (estrada de montanha de ~4 km) · Deserto & Rochas · Autódromo (com cronômetro de volta)

## Garagem (tecla G) — mais de 900 opções de personalização
20+ abas: peças de motor, turbo/arrefecimento, embreagem/câmbio, chassi, freios, 40 modelos de pneus, aerodinâmica, kits de carroceria,
120 cores de pintura, 60 adesivos/listras, neon, luzes, som do motor/buzina (tecla H), interior, acessórios off-road e mais.
Peças alteram a física de verdade (potência, boost, inércia, aderência, freio, aerodinâmica, peso).

### Detalhes
- **Motor**: 20 motores reais (I4, flat-4, I6, V6, V8, V10, V12, rotativo, diesel, elétricos),
  preparação em 3 estágios, pressão do turbo, inércia do volante, nitro
- **Transmissão**: 17 caixas (manual 4–6, automática, dupla embreagem, sequencial, CVT, elétrica),
  relação final, reduzida, modo auto/manual
- **Tração**: FWD / RWD / AWD, distribuição de torque, diferencial dianteiro/central/traseiro
  (aberto, LSD 1 e 2 vias, travado)
- **Rodas e pneus**: 8 modelos de roda, largura/perfil/aro (frente e trás), 10 compostos,
  pressão, espaçadores
- **Suspensão**: molas, amortecedores, barras, altura (rebaixado/lift), cambagem, convergência, Ackermann
- **Freios e assistências**: kit de freio, distribuição, ABS, TC, ESC, assistência de direção
- **Aerodinâmica**: splitter, aerofólio (5 tipos, ângulo), difusor
- **Peso**: lastro (e posição), redução de peso — o centro de gravidade e a distribuição são recalculados
- **Visual**: cor, acabamento, widebody, entrada de ar, barra de LED, película

## Controles
W/↑ acelera · S/↓ freia/ré · A/D direção · Espaço freio de mão · N nitro · E/Q marchas (manual) ·
T auto/manual · C câmera · V olhar para trás · R desvira · Backspace volta ao início e conserta ·
Delete conserta · L faróis · F telemetria · P pausa · [ ] câmera lenta · G garagem · M mapas · Esc menu ·
Mouse arrasta = câmera. Gamepad suportado.
