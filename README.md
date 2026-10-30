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
- Tabla con la probabilidad, el pago y la esperanza de cada apuesta.

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
| `js/app.js` | Interfaz |
| `sw.js`, `manifest.webmanifest` | Funcionamiento sin conexión e instalación |

## Próximos pasos

1. Análisis de historial (frecuencias y test chi-cuadrado, sin predicciones).
2. Recomendación según el perfil del jugador.
3. Control de gasto: límite de dinero y tiempo por sesión.
4. Empaquetar para Android e iPhone (Capacitor).
