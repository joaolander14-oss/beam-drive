# Beam Drive — Simulador de Veículos (HTML + CSS + three.js)

Simulador de veículos estilo BeamNG: carros baseados em modelos reais, física de verdade
(corpo rígido 6 graus de liberdade, suspensão, pneu com escorregamento combinado, motor,
embreagem, câmbio e diferenciais) e **deformação da lataria** nas batidas.

## Como abrir
- Dê dois cliques em **Jogar.bat** (precisa de Python) — abre `http://localhost:8330`
- ou: `python serve.py 8330` dentro desta pasta.

## Veículos (462 carros + 133 motos)
Inspirados em carros reais — de Fiat Uno e Fusca a Ferrari F40, Porsche 911 GT3, Tesla Model S Plaid, Land Rover Defender, Ford F-150 Raptor, Rimac Nevera…
Cada um tem ficha técnica própria (massa, motor com curva de torque, câmbio, tração, pneus, suspensão). Há busca e filtro por classe no menu Carros.
(Nomes de marcas são usados apenas para identificar o modelo que inspirou o carro; o projeto não tem relação com as fabricantes.)

## Mapas (4 + Mundo Real)
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

## Mundo Real (qualquer lugar do planeta)
Menu **Mapas → Mundo Real (OpenStreetMap)**: busque um lugar, arraste um retângulo (até 2 km de lado) e clique em *Gerar mapa 3D*.
O jogo baixa ruas, todos os prédios e casas (com altura e janelas; só os ~1.600 mais próximos do centro têm colisão, o resto é cenário), árvores, água, parques e o relevo e monta a área em 3D com física e colisões.
Tudo gratuito, sem chave: mapa Leaflet/OpenStreetMap, dados via Overpass API e elevação AWS Terrain.
Os servidores públicos às vezes ficam sobrecarregados — o jogo tenta 4 servidores em paralelo; se falhar, espere alguns minutos ou reduza a área.
Dados © contribuidores do OpenStreetMap (ODbL).

## Painel e controles do carro
Setas (J/K), pisca-alerta (X), faróis lanterna/baixo/alto (L), neblina (B), limpador de para-brisa (O), ignição (I), piloto automático (Y), buzina (H).
O painel inferior tem as luzes de alerta: motor, temperatura, óleo, bateria, combustível, freio de mão, ABS/TC/ESC, pneus, faróis e setas piscando.
Combustível/bateria acabam de verdade (Delete abastece). Minimapa em todos os mapas (-/= zoom, U orientação).
No Mundo Real: faixas de pedestre, semáforos com fases, placas de PARE/preferência/velocidade, postes, calçadas e árvores (só visuais, sem colisão).

### Casas no Mundo Real (Overture Maps + genéricas)
Onde o OpenStreetMap não tem as casas cadastradas, o jogo completa com os contornos de construções do **Overture Maps** (gratuito, detectados por satélite) e,
nos lotes ainda vazios ao longo de ruas residenciais, com **casas genéricas** (marcadas como opção no seletor; telhados de duas águas). Casas genéricas não são as reais.

### Pista e sinalização do Mundo Real (dados reais do local)
- **Asfalto de verdade:** o terreno é nivelado ao longo e através de cada rua (pista reta e lisa), com textura de asfalto com trilhas de roda, bordas, remendos e rachaduras; calçadas com meio-fio e linhas de retenção.
- **Sinalização conforme o OpenStreetMap:** semáforos nos cruzamentos que realmente têm (um conjunto para cada sentido de chegada, com braço sobre a pista nas vias largas e placa com o nome das ruas),
  PARE/dê a preferência na via secundária (usa a hierarquia e a direção cadastradas), placas de velocidade (maxspeed), proibido entrar/estacionar, advertências, pontos de ônibus com abrigo, radares e lombadas (físicas) onde cadastrados.
- Não há fonte gratuita sem chave que enxergue placas da rua (Street View/Mapillary exigem chave): onde o OpenStreetMap não tem a placa, ela não aparece.

## Tráfego de bots
No seletor do Mundo Real, na aba **Mapas** e em **Opções** há um controle de **bots (0–40)**. Os bots dirigem pelas ruas na faixa da direita, respeitam semáforos, PARE, preferencial e limites de velocidade, mantêm distância do carro da frente, piscam nas curvas e **colidem de verdade** com você e entre si. Nos mapas pequenos eles seguem um circuito próprio. Aparecem como pontos no minimapa. Bots presos ou capotados são reposicionados.
No Mundo Real, a opção **sinalização genérica** adiciona semáforos, PARE/preferencial e placas de velocidade nos cruzamentos onde o OpenStreetMap não tem dados.

## Painel do carro e alertas
Perto do velocímetro há um **painel de botões** com as teclas do carro (faróis, neblina, setas, alerta, limpador, ignição, piloto automático, buzina etc. — todas menos acelerador e freio); clique ou use o teclado. Luzes de alerta: SRS (airbag), cinto (Z), lâmpada queimada, disco de freio quente, líquido, 4x4, limite de velocidade, piloto, RPM, combustível/bateria, motor, óleo, temperatura.

## Mapa grande com carregamento contínuo
No Mundo Real você desenha uma área grande (até 30 km de lado) e escolhe o **📍 ponto de partida**. O jogo só constrói **2 km ao redor do carro** (ruas, prédios, relevo, sinalização) e, conforme você dirige, carrega e troca para a região seguinte automaticamente (as regiões ficam numa grade de 500 m e usam cache, então voltar é rápido). Os bots só existem nessa janela carregada (~1 km ao redor de você).

## Bots persistentes, relevo nivelado e placas
- **Bots com posição guardada:** cada bot é um registro (carro, cor, posição). Só os que estão a até **1 km** de você viram carros de verdade (física, modelo 3D e colisão, no máximo 28 ao mesmo tempo); os outros ficam parados no lugar, sem custo e sem colisão. Ao trocar de região do mapa os bots são mantidos e voltam quando você se aproxima. O controle vai até 200 bots.
- **Ruas niveladas:** o terreno é terraplenado sob as ruas — perfil suave, inclinação máxima de ~9 %, cruzamentos na mesma cota, pista plana de borda a borda e talude suave até o terreno natural.
- **Calçadas:** são interrompidas onde outra via cruza, com meio-fio fechado nas pontas.
- **Mais de 100 placas diferentes** (limites de velocidade 20–120, proibições, obrigações, advertências, informação, indicação, preferencial). Vêm das tags do OpenStreetMap (traffic_sign, hazard, passagens de nível, hospitais, postos…) e, com "sinalização genérica", são distribuídas pelas vias (curvas, cruzamentos, semáforo à frente, escolas, becos sem saída…).

## Colisão realista, gráficos e motos
- **Batidas:** o amassado agora é proporcional à energia (~0,3 m a 50 km/h, ~0,8 m a 100 km/h, mais de 1 m acima de 120 km/h) e atinge toda a largura da frente/traseira; motor, radiador e suspensão sofrem dano de verdade (rodas desalinhadas), airbag e peças soltas.
- **Gráficos (Opções):** presets Mínimo/Baixo/Médio/Alto/Ultra e controles individuais — escala de resolução, resolução dinâmica (ajusta sozinha para manter o FPS), sombras (4 níveis), distância de visão, detalhe do terreno à distância, densidade de objetos, bots ativos ao mesmo tempo, limite de FPS e antialiasing. Otimizações automáticas: terreno em blocos com nível de detalhe, só desenha o que está na tela, bots distantes viram caixas simples e usam física a 120 Hz.
- **Motos (aba Carros → filtro "🏍 Motos"):** 133 motos reais (esportivas, naked, trail, custom, touring, clássicas, scooters, off-road, elétricas) com física própria de duas rodas: inclinação nas curvas, o piloto virtual mantém o equilíbrio, empinadas e frenagens com a roda traseira levantando, queda se passar do limite (aperte R para levantar). Câmbio sequencial/CVT e motores com curva de torque própria.

## Lombadas por velocidade da via
O perfil depende do limite de velocidade; a subida (rampa) é bem íngreme nas de baixa velocidade: **20 km/h** = 1,1 m × 14 cm (rampa de 28 cm); **30** = 1,8 m × 12 cm; **40** = 3 m × 10 cm; **50** = 4,8 m × 9 cm; **60/70 km/h** = mesas longas e suaves (8–12 m). No teste de física com um hatch: a de 20 km/h dá um tranco de ~1,1 g; a de 70 km/h, ~0,3 g. Valem para as lombadas reais do OpenStreetMap e, com "sinalização genérica", são distribuídas pelas ruas.

## Minimapa do Mundo Real
No Mundo Real o minimapa usa o mesmo mapa do seletor de área (ladrilhos do OpenStreetMap, com nomes de ruas), girando com o carro e com zoom (teclas - / =). Precisa de internet; sem ela, aparece o mapa simplificado de antes.

## Comércios reais e peças que quebram
- **Comércios (Mundo Real):** lojas, bancos, restaurantes, farmácias, mercados etc. do OpenStreetMap ganham fachada com vitrine, porta, toldo listrado na cor da categoria e letreiro com o **nome real** e um ícone (até 256 por região, os mais próximos do centro). Vêm de prédios marcados como comércio e de pontos de interesse com nome, encaixados na parede que dá para a rua.
- **Colisão das peças:** asas, splitters, difusores, santo-antônio, estribos/saias, bagageiro de teto e estepe agora têm pontos de colisão próprios (antes só a carroceria batia). Ao bater, a peça mais próxima do impacto **quebra e some**, e o carro perde a aerodinâmica dela (ex.: sem a asa, menos downforce atrás). Consertar (Backspace) recoloca as peças.

## Placas reais, pistas duplas/triplas e rodovias
- **Placas reais:** as placas agora usam as imagens oficiais do CONTRAN (sinalização brasileira, Wikimedia Commons, domínio público) — PARE, preferencial, sentido proibido, velocidades (R-19), proibido ultrapassar/estacionar, curvas, cruzamentos, lombada, pedestres, escola, animais etc. — baixadas na hora e guardadas em cache (precisa de internet na primeira vez; sem internet usa o desenho próprio). Sem emojis nos letreiros das lojas e placas de informação.
- **Pistas duplas e triplas:** a largura e as marcações seguem o número de faixas do OpenStreetMap (faixa de 3,5 m + acostamento nas rodovias; sem a informação, rodovias de mão única têm 2 faixas): eixo amarelo duplo contínuo nas vias de 4+ faixas, separadores tracejados entre faixas, bordas contínuas.
- **Relevo nas rodovias:** rodovias e vias principais seguem o relevo (suavização leve e inclinação máxima por tipo: 7,5 % em autoestradas, 10 % nas principais); só as ruas urbanas ficam bem niveladas.
- **Lombadas nas rodovias:** mesas longas e suaves (18 m) de vez em quando nas vias de 80 km/h ou mais.
- **Paredes invisíveis:** prédios não criam mais colisão em cima de pistas (viadutos/túneis/ruas dentro de quarteirões). A troca de região agora antecipa mais em alta velocidade e pré-carrega a região à frente.

## Bots (distância e limite)
Bots a até 300 m aparecem como o carro completo; entre 300 m e 1 km aparecem como carros simplificados **na cor da pintura** (antes ficavam escuros). O limite de bots ativos ao mesmo tempo subiu (Mínimo 14, Baixo 22, Médio 34, Alto 44, Ultra 60; dá para escolher até 80 em Opções).
