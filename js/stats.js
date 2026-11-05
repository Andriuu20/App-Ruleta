// Estadística del historial de tiradas. Describe el pasado; no predice nada.

import { WHEELS, DOUBLE_ZERO, RED, betNumbers } from './roulette.js';

// Convierte texto pegado ("12, 0 35 00…") en tiradas válidas.
export function parseSpins(text, wheel) {
  const spins = [];
  const invalid = [];
  for (const token of text.split(/[\s,;.]+/).filter(Boolean)) {
    if (token === '00') {
      if (wheel === 'american') spins.push(DOUBLE_ZERO);
      else invalid.push(token);
    } else if (/^\d{1,2}$/.test(token) && Number(token) <= 36) spins.push(Number(token));
    else invalid.push(token);
  }
  return { spins, invalid };
}

// ln Γ(x) por la aproximación de Lanczos.
function lnGamma(x) {
  const c = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  x -= 1;
  let a = 0.99999999999980993;
  const t = x + 7.5;
  for (let i = 0; i < 8; i++) a += c[i] / (x + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

// Función gamma incompleta regularizada superior Q(a, x).
function gammaQ(a, x) {
  if (x <= 0) return 1;
  const lnPre = -x + a * Math.log(x) - lnGamma(a);
  if (x < a + 1) {
    let sum = 1 / a, term = sum;
    for (let n = 1; n < 1000; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(lnPre);
  }
  // Fracción continua (Lentz).
  let b = x + 1 - a, c = 1e300, d = 1 / b, h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(lnPre) * h;
}

export function chiSquarePValue(stat, df) {
  return Math.min(1, Math.max(0, gammaQ(df / 2, stat / 2)));
}

// observed: recuentos; probs: probabilidades esperadas (suman 1).
export function chiSquare(observed, probs) {
  const n = observed.reduce((s, v) => s + v, 0);
  let stat = 0, minExpected = Infinity;
  observed.forEach((o, i) => {
    const e = n * probs[i];
    minExpected = Math.min(minExpected, e);
    stat += (o - e) ** 2 / e;
  });
  const df = observed.length - 1;
  return { stat, df, p: chiSquarePValue(stat, df), minExpected };
}

// Tiradas aproximadas para detectar (α = 5 %, potencia 80 %) que un número
// concreto sale con probabilidad (1 + bias)/N en vez de 1/N.
export function spinsToDetect(bias, pockets) {
  const p0 = 1 / pockets, p1 = (1 + bias) / pockets;
  const z = 1.96 * Math.sqrt(p0 * (1 - p0)) + 0.8416 * Math.sqrt(p1 * (1 - p1));
  return Math.ceil((z / (p1 - p0)) ** 2);
}

const ZERO_LABEL = { european: 'Cero', american: 'Cero y doble cero' };

function partitions(wheel) {
  const zeros = wheel === 'american' ? [0, DOUBLE_ZERO] : [0];
  const zero = { name: ZERO_LABEL[wheel], numbers: zeros };
  const list = [
    { title: 'Color', rows: [
      { name: 'Rojo', numbers: [...RED] },
      { name: 'Negro', numbers: betNumbers('black') },
      { ...zero, name: wheel === 'american' ? 'Verde (0 y 00)' : 'Verde (0)' },
    ] },
    { title: 'Par / impar', rows: [
      { name: 'Par', numbers: betNumbers('even') }, { name: 'Impar', numbers: betNumbers('odd') }, zero] },
    { title: 'Falta / pasa', rows: [
      { name: 'Falta (1-18)', numbers: betNumbers('low') }, { name: 'Pasa (19-36)', numbers: betNumbers('high') }, zero] },
    { title: 'Docenas', rows: [
      { name: '1ª docena', numbers: betNumbers('dozen1') }, { name: '2ª docena', numbers: betNumbers('dozen2') },
      { name: '3ª docena', numbers: betNumbers('dozen3') }, zero] },
    { title: 'Columnas', rows: [
      { name: '1ª columna', numbers: betNumbers('col1') }, { name: '2ª columna', numbers: betNumbers('col2') },
      { name: '3ª columna', numbers: betNumbers('col3') }, zero] },
  ];
  if (wheel === 'european') {
    list.push({ title: 'Sectores de la rueda', rows: [
      { name: 'Vecinos del cero', numbers: betNumbers('voisins') },
      { name: 'Tercio', numbers: betNumbers('tiers') },
      { name: 'Huérfanos', numbers: betNumbers('orphelins') },
    ] });
  }
  return list;
}

export function analyzeHistory(spins, wheel) {
  const N = WHEELS[wheel].pockets;
  const counts = new Array(N).fill(0);
  for (const s of spins) if (s < N) counts[s]++;
  const total = counts.reduce((s, v) => s + v, 0);

  const groups = partitions(wheel).map((g) => {
    const rows = g.rows.map((r) => ({
      name: r.name,
      observed: r.numbers.reduce((s, n) => s + counts[n], 0),
      expectedP: r.numbers.length / N,
    }));
    return {
      title: g.title,
      rows,
      test: total ? chiSquare(rows.map((r) => r.observed), rows.map((r) => r.expectedP)) : null,
    };
  });

  return {
    total,
    pockets: N,
    counts,
    numberTest: total ? chiSquare(counts, counts.map(() => 1 / N)) : null,
    groups,
  };
}

// Interpretación prudente del valor p.
export function interpret(test) {
  if (!test) return null;
  const few = test.minExpected < 5;
  if (test.p >= 0.05) {
    return { level: 'normal', text: 'Desviación normal: compatible con una ruleta justa.', few };
  }
  if (test.p >= 0.001) {
    return { level: 'unusual', few,
      text: 'Algo inusual, pero una ruleta justa produce desviaciones así con frecuencia (1 de cada 20 veces por debajo de p = 0,05). No es prueba de sesgo.' };
  }
  return { level: 'rare', few,
    text: 'Desviación poco habitual. Revisa que el historial esté bien introducido; para hablar de ruleta sesgada harían falta miles de tiradas más que lo confirmen.' };
}

// Probabilidades exactas (binomial) de una zona que cubre k casillas en las
// próximas n tiradas. No depende de lo que haya salido antes.
export function nextSpinsOdds(k, pockets, n) {
  const p = k / pockets;
  const dist = new Array(n + 1);
  dist[0] = (1 - p) ** n;
  for (let j = 1; j <= n; j++) dist[j] = dist[j - 1] * ((n - j + 1) / j) * (p / (1 - p));
  // Apostando 1 unidad a la zona en cada tirada: beneficio si W·36/k > n.
  let profit = 0;
  for (let j = 0; j <= n; j++) if (j * 36 > n * k + 1e-9) profit += dist[j];
  return {
    p,
    none: dist[0],
    atLeastOnce: 1 - dist[0],
    expected: n * p,
    dist,
    profit,
  };
}

// Veces que la zona salió en las últimas n tiradas del historial.
export function recentHits(spins, numbers, n) {
  const set = new Set(numbers);
  const last = spins.slice(-n);
  return { spins: last.length, hits: last.filter((s) => set.has(s)).length };
}
