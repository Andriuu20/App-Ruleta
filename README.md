# Simulador de estrategias de ruleta

Web móvil (instalable y sin conexión) que simula estrategias de ruleta y muestra sus
probabilidades reales. Sin APIs ni servidores: todo se calcula en el teléfono.

**No predice números.** Cada tirada es independiente y ninguna estrategia vence la
ventaja de la casa (2,70 % en la europea, 5,26 % en la americana).

## Uso

```bash
npm start   # http://localhost:8080 (sirve los archivos estáticos)
npm test    # tests del motor (node:test, sin dependencias)
```

Abrir `index.html` directamente como archivo no funciona: los módulos JS y el
service worker necesitan HTTP. Para publicarla basta cualquier hosting estático
(GitHub Pages, Netlify…).

## Qué hace

La app tiene cuatro pestañas:

### Simulador
- **Apuestas:** rojo/negro, par/impar, falta/pasa, docenas, columnas, sectores
  (Vecinos, Tercio, Huérfanos, Juego del cero; solo ruleta europea) y números
  elegidos en el tablero.
- **Estrategias:** apuesta fija, Martingala, Fibonacci, D'Alembert y personalizada
  (qué hacer tras ganar/perder, multiplicar o sumar unidades, reiniciar tras N
  victorias o derrotas; con ella se puede montar un Paroli, por ejemplo).
- **Parámetros:** banca, apuesta inicial (mínima), objetivo de ganancia, máximo de
  tiradas, máximo de mesa y número de sesiones (hasta 100.000).
- **Resultados:** probabilidad de llegar al objetivo, de ruina y de agotar las
  tiradas (con intervalo de confianza del 95 %), tiradas medias hasta la ruina,
  ganancia media simulada frente a la teórica (ventaja × total apostado),
  percentiles, gráfico de la banca en sesiones de ejemplo e histograma del
  resultado final.
- **¿Saldrá en las próximas tiradas?** Para la zona elegida (rojo, docena, vecinos,
  juego del cero, números…): probabilidad exacta de que salga al menos una vez en
  las próximas N tiradas, veces esperadas, distribución de aciertos y probabilidad
  de acabar ganando apostando a ella en todas. Si hay historial, muestra cuántas
  veces salió en las últimas N tiradas, como dato del pasado que no cambia el cálculo.
- Tabla con la probabilidad, el pago y la esperanza de cada apuesta.

### Historial
- Se introducen tiradas tocando el tablero o pegando una lista.
- Frecuencia por número, color, par/impar, falta/pasa, docenas, columnas y
  sectores de la rueda, frente a lo esperado.
- Test chi-cuadrado con una interpretación prudente (normal / inusual / poco
  habitual) y aviso cuando hay pocas tiradas para que el test sea fiable.
- Cuántas tiradas harían falta para detectar un sesgo real. Nada de esto se usa
  para predecir.

### Perfil
- Recomendación según lo que busca el jugador (que el dinero dure, término medio
  o premio grande), nunca según el historial.
- Comparativa simulada de sencilla, docena, seisena y pleno con el presupuesto, la
  apuesta y el tiempo de juego indicados, y botón para abrirla en el simulador.

### Control
- Límite de pérdida, tiempo máximo y objetivo de retirada opcional.
- Se anotan las ganancias y pérdidas; avisos al 80 % y al 100 % de cada límite
  (con vibración si el teléfono la admite) y registro de sesiones anteriores.
- Todo se guarda solo en el teléfono (`localStorage`).

## Modelo

- Una sesión termina al alcanzar el objetivo, cuando la banca ya no cubre la
  apuesta inicial (ruina) o al agotar las tiradas.
- Si la estrategia pide más de lo que queda en la banca, se apuesta lo que queda;
  si supera el máximo de mesa, se apuesta el máximo.
- Una apuesta que cubre *k* números paga `36/k − 1` por unidad. Los sectores y los
  números múltiples se modelan como la apuesta repartida por igual entre sus
  números: la esperanza es exactamente la del casino.
- Generador pseudoaleatorio sfc32 con semilla. Los tests comprueban, entre otras
  cosas, que la simulación coincide con la fórmula exacta de la ruina del jugador.

## Estructura

| Archivo | Contenido |
|---|---|
| `js/roulette.js` | Ruleta, apuestas, probabilidades y pagos |
| `js/strategies.js` | Progresiones de apuesta |
| `js/simulator.js` | Simulación Monte Carlo y estadísticas |
| `js/worker.js` | Ejecuta la simulación en un Web Worker |
| `js/chart.js` | Gráficos en canvas |
| `js/stats.js` | Estadística del historial y test chi-cuadrado |
| `js/session.js` | Lógica del control de gasto |
| `js/board.js`, `js/format.js` | Tablero de números y formato de cifras |
| `js/views/*.js` | Una vista por pestaña |
| `js/app.js` | Pestañas y arranque |
| `sw.js`, `manifest.webmanifest` | Funcionamiento sin conexión e instalación |

## Publicación

La rama `gh-pages` contiene la versión publicada en GitHub Pages:
https://andriuu20.github.io/App-Ruleta/

## Próximos pasos

- Empaquetar para Android e iPhone (Capacitor).
