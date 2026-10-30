import { test } from 'node:test';
import assert from 'node:assert/strict';
import { betNumbers, betStats, houseEdge, BETS, DOUBLE_ZERO } from '../js/roulette.js';
import { createStrategy } from '../js/strategies.js';
import { simulate, createRng } from '../js/simulator.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test('cada apuesta tiene la probabilidad y el pago correctos', () => {
  close(betStats(18, 'european').probability, 18 / 37, 1e-12);
  assert.equal(betStats(18, 'european').payout, 1);
  assert.equal(betStats(12, 'european').payout, 2);
  assert.equal(betStats(1, 'european').payout, 35);
  for (const k of [1, 7, 12, 17, 18]) {
    close(betStats(k, 'european').expectedPerUnit, -1 / 37, 1e-12);
    close(betStats(k, 'american').expectedPerUnit, -2 / 38, 1e-12);
  }
  close(houseEdge('european'), 0.027027, 1e-6);
});

test('las apuestas cubren los números esperados', () => {
  const sizes = { red: 18, black: 18, even: 18, odd: 18, low: 18, high: 18, dozen1: 12, col3: 12,
    voisins: 17, tiers: 12, orphelins: 8, jeuzero: 7 };
  for (const [id, size] of Object.entries(sizes)) assert.equal(betNumbers(id).length, size, id);
  const sectors = ['voisins', 'tiers', 'orphelins'].flatMap((id) => betNumbers(id));
  assert.equal(new Set(sectors).size, 37, 'los tres sectores cubren toda la rueda');
  assert.ok(BETS.every((b) => b.custom || !betNumbers(b.id).includes(DOUBLE_ZERO)));
  assert.deepEqual(betNumbers('numbers', [17, 3, 3]), [3, 17]);
});

test('progresiones', () => {
  const seq = (s, results) => [s.reset(), ...results.map((w) => s.next(w))];
  assert.deepEqual(seq(createStrategy('martingale', 5), [false, false, false, true]), [5, 10, 20, 40, 5]);
  assert.deepEqual(seq(createStrategy('fibonacci', 1), [false, false, false, false, true, true]), [1, 1, 2, 3, 5, 2, 1]);
  assert.deepEqual(seq(createStrategy('dalembert', 2), [false, false, true, true, true]), [2, 4, 6, 4, 2, 2]);
  const paroli = createStrategy('custom', 1, { winMode: 'apply', winMult: 2, winAdd: 0, lossMode: 'reset', resetAfterWins: 3 });
  assert.deepEqual(seq(paroli, [true, true, true, true, false]), [1, 2, 4, 1, 2, 1]);
});

test('el generador es reproducible y uniforme', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
  const counts = new Array(37).fill(0);
  const rng = createRng(7);
  for (let i = 0; i < 370000; i++) counts[Math.floor(rng() * 37)]++;
  for (const c of counts) close(c, 10000, 500);
});

const baseCfg = {
  wheel: 'european', numbers: betNumbers('red'), bankroll: 100, baseBet: 1, target: 0,
  maxSpins: 100, sessions: 20000, tableMax: 0, strategy: 'flat', samplePaths: 3, seed: 1,
};

test('apuesta fija: la pérdida media coincide con la ventaja de la casa', () => {
  const r = simulate(baseCfg);
  assert.equal(r.ruin.p, 0);
  assert.equal(r.meanWagered, 100);
  close(r.meanProfit, -100 / 37, 3 * r.meanProfitCI);
  close(r.theoreticalProfit, -100 / 37, 1e-9);
  assert.equal(r.paths.length, 3);
});

test('Martingala: gana a menudo pero sin ventaja', () => {
  const r = simulate({ ...baseCfg, strategy: 'martingale', target: 50, maxSpins: 10000, sessions: 20000 });
  assert.ok(r.target.p > 0.5 && r.target.p < 0.75, `P(objetivo) = ${r.target.p}`);
  close(r.target.p + r.ruin.p + r.timeout.p, 1, 1e-12);
  close(r.meanProfit, r.theoreticalProfit, 3 * r.meanProfitCI);
  assert.ok(r.meanSpinsToRuin > 0);
});

test('ruina de jugador con apuesta fija coincide con la fórmula', () => {
  // Banca 10, objetivo +10, apuesta 1 a rojo: P(objetivo) = (1 − (q/p)^10) / (1 − (q/p)^20)
  const p = 18 / 37, q = 19 / 37, ratio = q / p;
  const exact = (1 - ratio ** 10) / (1 - ratio ** 20);
  const r = simulate({ ...baseCfg, bankroll: 10, target: 10, maxSpins: 1e6, sessions: 40000 });
  close(r.target.p, exact, 3 * r.target.ci);
  assert.equal(r.timeout.p, 0);
});
