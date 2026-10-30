import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSpins, chiSquarePValue, chiSquare, analyzeHistory, spinsToDetect, interpret } from '../js/stats.js';
import { newSession, sessionStatus, closeSession } from '../js/session.js';
import { createRng } from '../js/simulator.js';
import { DOUBLE_ZERO } from '../js/roulette.js';

const close = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} ≉ ${b} (±${tol})`);

test('lectura de tiradas pegadas', () => {
  assert.deepEqual(parseSpins('12, 0 35\n00; 7 40 x', 'european'), { spins: [12, 0, 35, 7], invalid: ['00', '40', 'x'] });
  assert.deepEqual(parseSpins('00 1', 'american').spins, [DOUBLE_ZERO, 1]);
});

test('valor p del chi-cuadrado', () => {
  close(chiSquarePValue(3.841, 1), 0.05, 1e-3);
  close(chiSquarePValue(5.991, 2), 0.05, 1e-3);
  close(chiSquarePValue(50.998, 36), 0.05, 1e-3);
  close(chiSquarePValue(36, 36), 0.46865, 1e-4); // = P(Poisson(18) ≤ 17)
  close(chiSquarePValue(0, 10), 1, 1e-12);
  close(chiSquarePValue(200, 36), 0, 1e-12);
  const t = chiSquare([10, 20, 30], [1 / 3, 1 / 3, 1 / 3]);
  close(t.stat, 10, 1e-12);
  assert.equal(t.df, 2);
});

test('análisis de historial', () => {
  const rng = createRng(3);
  const spins = Array.from({ length: 3700 }, () => Math.floor(rng() * 37));
  const a = analyzeHistory(spins, 'european');
  assert.equal(a.total, 3700);
  assert.equal(a.counts.reduce((s, v) => s + v, 0), 3700);
  for (const g of a.groups) {
    close(g.rows.reduce((s, r) => s + r.expectedP, 0), 1, 1e-12);
    assert.equal(g.rows.reduce((s, r) => s + r.observed, 0), 3700, g.title);
  }
  assert.ok(a.numberTest.p > 0.001);

  const biased = analyzeHistory(new Array(200).fill(17), 'european');
  assert.equal(interpret(biased.numberTest).level, 'rare');
  assert.equal(analyzeHistory([], 'american').numberTest, null);
});

test('tiradas para detectar un sesgo', () => {
  const n = spinsToDetect(0.2, 37);
  assert.ok(n > 5000 && n < 10000, String(n));
});

test('control de gasto', () => {
  const s = newSession({ lossLimit: 100, timeLimitMin: 60, winStop: 50 }, 0);
  assert.equal(sessionStatus(s, 0).level, 'ok');
  s.entries.push({ t: 1, amount: -85 });
  let st = sessionStatus(s, 10 * 60000);
  assert.equal(st.money, 'warn');
  assert.equal(st.lossLeft, 15);
  assert.equal(st.timeLeftMin, 50);
  s.entries.push({ t: 2, amount: -20 });
  assert.equal(sessionStatus(s, 0).money, 'stop');
  assert.equal(sessionStatus(newSession({ lossLimit: 100, timeLimitMin: 60 }, 0), 61 * 60000).time, 'stop');
  s.entries.push({ t: 3, amount: 160 });
  st = sessionStatus(s, 0);
  assert.ok(st.winReached);
  assert.equal(st.level, 'stop');
  assert.deepEqual(closeSession(s, 5), { start: 0, end: 5, net: 55, bets: 3 });
});
