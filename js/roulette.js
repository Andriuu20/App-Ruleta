// Definición de la ruleta y de las apuestas. Sin dependencias: lo usan la
// interfaz, el Web Worker y los tests de Node.

export const DOUBLE_ZERO = 37; // índice interno del "00" en la ruleta americana

export const WHEELS = {
  european: { id: 'european', name: 'Europea (0)', pockets: 37 },
  american: { id: 'american', name: 'Americana (0 y 00)', pockets: 38 },
};

export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

// Orden físico de la rueda europea (los sectores dependen de él).
export const EUROPEAN_WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

export function pocketLabel(n) {
  return n === DOUBLE_ZERO ? '00' : String(n);
}

export function pocketColor(n) {
  if (n === 0 || n === DOUBLE_ZERO) return 'green';
  return RED.has(n) ? 'red' : 'black';
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const ONE_TO_36 = range(1, 36);

// Los sectores se modelan como un reparto uniforme de la apuesta entre sus
// números (plenos). La esperanza es idéntica a la del reparto real de fichas
// del casino; solo cambia ligeramente la distribución del premio.
export const BETS = [
  { id: 'red', group: 'Sencillas', name: 'Rojo', numbers: () => ONE_TO_36.filter((n) => RED.has(n)) },
  { id: 'black', group: 'Sencillas', name: 'Negro', numbers: () => ONE_TO_36.filter((n) => !RED.has(n)) },
  { id: 'even', group: 'Sencillas', name: 'Par', numbers: () => ONE_TO_36.filter((n) => n % 2 === 0) },
  { id: 'odd', group: 'Sencillas', name: 'Impar', numbers: () => ONE_TO_36.filter((n) => n % 2 === 1) },
  { id: 'low', group: 'Sencillas', name: 'Falta (1-18)', numbers: () => range(1, 18) },
  { id: 'high', group: 'Sencillas', name: 'Pasa (19-36)', numbers: () => range(19, 36) },
  { id: 'dozen1', group: 'Docenas', name: '1ª docena (1-12)', numbers: () => range(1, 12) },
  { id: 'dozen2', group: 'Docenas', name: '2ª docena (13-24)', numbers: () => range(13, 24) },
  { id: 'dozen3', group: 'Docenas', name: '3ª docena (25-36)', numbers: () => range(25, 36) },
  { id: 'col1', group: 'Columnas', name: '1ª columna (1, 4, 7…)', numbers: () => ONE_TO_36.filter((n) => n % 3 === 1) },
  { id: 'col2', group: 'Columnas', name: '2ª columna (2, 5, 8…)', numbers: () => ONE_TO_36.filter((n) => n % 3 === 2) },
  { id: 'col3', group: 'Columnas', name: '3ª columna (3, 6, 9…)', numbers: () => ONE_TO_36.filter((n) => n % 3 === 0) },
  { id: 'voisins', group: 'Sectores', name: 'Vecinos del cero (Voisins)', europeanOnly: true,
    numbers: () => [22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25] },
  { id: 'tiers', group: 'Sectores', name: 'Tercio (Tiers)', europeanOnly: true,
    numbers: () => [27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33] },
  { id: 'orphelins', group: 'Sectores', name: 'Huérfanos (Orphelins)', europeanOnly: true,
    numbers: () => [17, 34, 6, 1, 20, 14, 31, 9] },
  { id: 'jeuzero', group: 'Sectores', name: 'Juego del cero', europeanOnly: true,
    numbers: () => [12, 35, 3, 26, 0, 32, 15] },
  { id: 'numbers', group: 'Números', name: 'Números elegidos (plenos)', custom: true, numbers: () => [] },
];

export function getBet(id) {
  return BETS.find((b) => b.id === id);
}

export function betNumbers(id, customNumbers = []) {
  const bet = getBet(id);
  if (!bet) throw new Error(`Apuesta desconocida: ${id}`);
  return bet.custom ? [...new Set(customNumbers)].sort((a, b) => a - b) : bet.numbers();
}

// Ganancia neta por unidad apostada si la bola cae en uno de los k números
// cubiertos (pleno 35:1, docena 2:1, sencilla 1:1…). Vale para ambas ruletas.
export function payoutFor(k) {
  return 36 / k - 1;
}

export function betStats(k, wheelId) {
  const N = WHEELS[wheelId].pockets;
  const p = k / N;
  const payout = payoutFor(k);
  return {
    covered: k,
    probability: p,
    payout,
    expectedPerUnit: p * payout - (1 - p), // = 36/N − 1
  };
}

// Ventaja de la casa (pérdida esperada por unidad apostada).
export function houseEdge(wheelId) {
  return 1 - 36 / WHEELS[wheelId].pockets;
}
