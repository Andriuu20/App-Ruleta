// Simulación Monte Carlo de sesiones de ruleta. Todo se calcula en local.

import { WHEELS, payoutFor, houseEdge } from './roulette.js';
import { createStrategy } from './strategies.js';

// Generador sfc32 con semilla: rápido y reproducible (útil para los tests).
export function createRng(seed = (Math.random() * 2 ** 32) >>> 0) {
  let a = 0x9e3779b9, b = 0x243f6a88, c = 0xb7e15162, d = seed >>> 0;
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ (b >>> 9);
    b = c + (c << 3) | 0;
    c = (c << 21) | (c >>> 11);
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
  for (let i = 0; i < 15; i++) next();
  return next;
}

export const OUTCOME = { TARGET: 0, RUIN: 1, TIMEOUT: 2 };

const round2 = (x) => Math.round(x * 100) / 100;
const MAX_PATH_POINTS = 600;

/**
 * cfg = {
 *   wheel: 'european' | 'american',
 *   numbers: number[]          // casillas cubiertas (0-36, 37 = "00")
 *   bankroll, baseBet, target, // target = ganancia objetivo (0 = sin objetivo)
 *   maxSpins, sessions,
 *   tableMax,                  // 0 = sin máximo de mesa
 *   strategy, custom,          // id de estrategia y reglas personalizadas
 *   samplePaths, seed
 * }
 * La sesión termina al alcanzar el objetivo, al no poder cubrir la apuesta
 * mínima (ruina) o al agotar las tiradas.
 */
export function simulate(cfg, onProgress) {
  const N = WHEELS[cfg.wheel].pockets;
  const hit = new Uint8Array(N);
  for (const n of cfg.numbers) if (n < N) hit[n] = 1;
  const k = hit.reduce((s, v) => s + v, 0);
  if (k === 0) throw new Error('La apuesta no cubre ningún número.');

  const payout = payoutFor(k);
  const { bankroll, baseBet, maxSpins, sessions } = cfg;
  const goal = cfg.target > 0 ? bankroll + cfg.target : Infinity;
  const tableMax = cfg.tableMax > 0 ? cfg.tableMax : Infinity;
  const samplePaths = cfg.samplePaths ?? 10;
  const pathStride = Math.max(1, Math.ceil(maxSpins / MAX_PATH_POINTS));
  const rng = createRng(cfg.seed);
  const strategy = createStrategy(cfg.strategy, baseBet, cfg.custom);

  const profits = new Float64Array(sessions);
  const counts = [0, 0, 0];
  let spinsTotal = 0, spinsToRuin = 0, wageredTotal = 0;
  let maxBetSum = 0, maxBetOverall = 0, cappedSessions = 0, longestLosing = 0;
  const paths = [];

  for (let s = 0; s < sessions; s++) {
    let bank = bankroll;
    let wanted = strategy.reset();
    let spins = 0, wagered = 0, maxBet = 0, losing = 0, capped = false;
    let outcome = OUTCOME.TIMEOUT;
    const path = s < samplePaths ? [bank] : null;

    while (true) {
      if (bank >= goal - 1e-9) { outcome = OUTCOME.TARGET; break; }
      if (bank < baseBet - 1e-9) { outcome = OUTCOME.RUIN; break; }
      if (spins >= maxSpins) break;

      let bet = wanted;
      if (bet > tableMax) { bet = tableMax; capped = true; }
      if (bet > bank) bet = bank;

      const won = hit[Math.floor(rng() * N)] === 1;
      bank = round2(won ? bank + bet * payout : bank - bet);
      wagered += bet;
      spins++;
      if (bet > maxBet) maxBet = bet;
      if (won) losing = 0; else if (++losing > longestLosing) longestLosing = losing;
      wanted = strategy.next(won);

      if (path && spins % pathStride === 0) path.push(bank);
    }

    if (path) {
      if (spins % pathStride !== 0) path.push(bank);
      paths.push({ outcome, points: path, stride: pathStride, spins });
    }
    counts[outcome]++;
    profits[s] = bank - bankroll;
    spinsTotal += spins;
    if (outcome === OUTCOME.RUIN) spinsToRuin += spins;
    wageredTotal += wagered;
    maxBetSum += maxBet;
    if (maxBet > maxBetOverall) maxBetOverall = maxBet;
    if (capped) cappedSessions++;

    if (onProgress && (s + 1) % 1000 === 0) onProgress((s + 1) / sessions);
  }

  return summarize({
    cfg, N, k, payout, profits, counts, spinsTotal, spinsToRuin, wageredTotal,
    maxBetSum, maxBetOverall, cappedSessions, longestLosing, paths,
  });
}

function summarize(r) {
  const n = r.cfg.sessions;
  const sorted = Float64Array.from(r.profits).sort();
  const pct = (q) => sorted[Math.min(n - 1, Math.floor(q * n))];
  const mean = r.profits.reduce((s, v) => s + v, 0) / n;
  const variance = r.profits.reduce((s, v) => s + (v - mean) ** 2, 0) / Math.max(1, n - 1);
  const prob = (c) => ({ p: c / n, ci: 1.96 * Math.sqrt((c / n) * (1 - c / n) / n) });
  const meanWagered = r.wageredTotal / n;
  let winners = 0, doubled = 0;
  for (const v of r.profits) {
    if (v > 1e-9) winners++;
    if (v >= r.cfg.bankroll - 1e-9) doubled++;
  }

  return {
    covered: r.k,
    pockets: r.N,
    payout: r.payout,
    winProbability: r.k / r.N,
    houseEdge: houseEdge(r.cfg.wheel),
    sessions: n,
    target: prob(r.counts[OUTCOME.TARGET]),
    ruin: prob(r.counts[OUTCOME.RUIN]),
    timeout: prob(r.counts[OUTCOME.TIMEOUT]),
    endedInProfit: prob(winners),
    doubled: prob(doubled),
    meanSpins: r.spinsTotal / n,
    meanSpinsToRuin: r.counts[OUTCOME.RUIN] ? r.spinsToRuin / r.counts[OUTCOME.RUIN] : null,
    meanProfit: mean,
    meanProfitCI: 1.96 * Math.sqrt(variance / n),
    theoreticalProfit: -houseEdge(r.cfg.wheel) * meanWagered,
    meanWagered,
    median: pct(0.5),
    p05: pct(0.05),
    p95: pct(0.95),
    worst: sorted[0],
    best: sorted[n - 1],
    meanMaxBet: r.maxBetSum / n,
    maxBet: r.maxBetOverall,
    cappedShare: r.cappedSessions / n,
    longestLosing: r.longestLosing,
    histogram: histogram(sorted),
    paths: r.paths,
  };
}

function histogram(sorted, bins = 24) {
  const lo = sorted[0], hi = sorted[sorted.length - 1];
  if (hi - lo < 1e-9) return [{ from: lo, to: hi, count: sorted.length }];
  const width = (hi - lo) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  for (const v of sorted) out[Math.min(bins - 1, Math.floor((v - lo) / width))].count++;
  return out;
}
