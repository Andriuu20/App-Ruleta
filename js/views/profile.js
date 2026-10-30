// Vista "Perfil": recomendación según lo que busca el jugador, nunca según el historial.

import { houseEdge } from '../roulette.js';
import { simulate } from '../simulator.js';
import { pct, money, signed, int, loadJSON, saveJSON } from '../format.js';
import { loadPreset } from './simulator.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#profile');
const STORAGE_KEY = 'ruleta.profile.v1';
const FIELDS = ['goal', 'pwheel', 'budget', 'bet', 'spinsPerHour', 'hours'];

const OPTIONS = [
  { id: 'simple', name: 'Sencilla (rojo, par, falta…)', bet: 'red', numbers: Array.from({ length: 18 }, (_, i) => i + 1) },
  { id: 'dozen', name: 'Docena o columna', bet: 'dozen1', numbers: Array.from({ length: 12 }, (_, i) => i + 1) },
  { id: 'six', name: 'Seisena (6 números)', bet: 'numbers', numbers: [1, 2, 3, 4, 5, 6] },
  { id: 'straight', name: 'Pleno (1 número)', bet: 'numbers', numbers: [17] },
];

const PROFILES = {
  last: {
    pick: 'simple',
    title: 'Apuestas sencillas',
    text: 'Ganas casi la mitad de las tiradas y cobras lo mismo que apuestas, así que el saldo sube y baja poco y el dinero dura más. A cambio, el premio nunca es grande.',
  },
  balance: {
    pick: 'dozen',
    title: 'Docenas o columnas',
    text: 'Ganas una de cada tres tiradas y cobras el doble de lo apostado. Más altibajos que las sencillas, sin llegar al todo o nada del pleno.',
  },
  big: {
    pick: 'straight',
    title: 'Plenos o grupos pequeños',
    text: 'Un pleno paga 35 veces la apuesta, pero solo acierta 1 de cada 37 tiradas: lo normal es encadenar muchas pérdidas. Una seisena o un sector pequeño (huérfanos) suaviza algo las rachas.',
  },
};

function read() {
  const num = (k) => Number(form[k].value);
  return {
    goal: form.goal.value,
    wheel: form.pwheel.value,
    budget: num('budget'),
    bet: num('bet'),
    spinsPerHour: Math.round(num('spinsPerHour')),
    hours: num('hours'),
  };
}

function validate(p) {
  if (!(p.budget > 0)) return 'El presupuesto debe ser mayor que 0.';
  if (!(p.bet > 0) || p.bet > p.budget) return 'La apuesta debe ser mayor que 0 y no superar el presupuesto.';
  if (!(p.spinsPerHour >= 1 && p.spinsPerHour <= 300)) return 'Las tiradas por hora deben estar entre 1 y 300.';
  if (!(p.hours > 0 && p.hours <= 12)) return 'Las horas deben estar entre 0 y 12.';
  return null;
}

function render() {
  const p = read();
  saveJSON(STORAGE_KEY, Object.fromEntries(FIELDS.map((f) => [f, form[f].value])));
  const error = validate(p);
  $('#p-error').hidden = !error;
  $('#p-error').textContent = error || '';
  $('#p-results').hidden = !!error;
  if (error) return;

  const maxSpins = Math.max(1, Math.round(p.spinsPerHour * p.hours));
  const results = OPTIONS.map((o) => ({
    option: o,
    r: simulate({
      wheel: p.wheel, numbers: o.numbers, bankroll: p.budget, baseBet: p.bet, target: 0,
      maxSpins, sessions: 3000, tableMax: 0, strategy: 'flat', samplePaths: 0, seed: 12345,
    }),
  }));

  const profile = PROFILES[p.goal];
  const reco = $('#p-reco');
  reco.innerHTML = '';
  const h = document.createElement('h3');
  h.textContent = `Te encaja: ${profile.title}`;
  const t = document.createElement('p');
  t.textContent = profile.text;
  reco.append(h, t);

  const share = p.bet / p.budget;
  const advice = document.createElement('p');
  advice.className = 'hint';
  if (p.goal === 'last' && share > 0.02) {
    advice.textContent = `Tu apuesta es el ${pct(share, 0)} del presupuesto. Para que dure, conviene no pasar del 2 % (unos ${money(p.budget * 0.02)} por tirada).`;
  } else if (share > 0.1) {
    advice.textContent = `Cada apuesta es el ${pct(share, 0)} del presupuesto: unas pocas tiradas malas pueden acabar con él.`;
  }
  if (advice.textContent) reco.append(advice);

  const expectedLoss = houseEdge(p.wheel) * p.bet * maxSpins;
  const same = document.createElement('p');
  same.className = 'hint';
  same.textContent = `Ninguna opción tiene ventaja: si apostaras ${money(p.bet)} en las ${int(maxSpins)} tiradas, perderías de media unos ` +
    `${money(expectedLoss)} con cualquiera de ellas. Lo único que cambia es el riesgo.`;
  reco.append(same);

  const body = $('#p-body');
  body.innerHTML = '';
  for (const { option, r } of results) {
    const card = document.createElement('div');
    card.className = option.id === profile.pick ? 'option picked' : 'option';
    const title = document.createElement('p');
    title.className = 'option-title';
    title.textContent = option.name;
    if (option.id === profile.pick) title.insertAdjacentHTML('beforeend', ' <span class="badge">Tu perfil</span>');
    const dl = document.createElement('dl');
    for (const [k, v] of [
      ['Gana cada tirada', pct(r.winProbability)],
      ['Se queda sin dinero', pct(r.ruin.p, 0)],
      ['Acaba ganando', pct(r.endedInProfit.p, 0)],
      ['Dobla el presupuesto', pct(r.doubled.p, 0)],
      ['Resultado medio (simulado)', signed(r.meanProfit)],
      ['El 90 % acaba entre', `${signed(r.p05)} y ${signed(r.p95)}`],
    ]) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
    card.append(title, dl);
    body.append(card);
  }
  $('#p-caption').textContent =
    `Apostando ${money(p.bet)} fijos durante ${int(maxSpins)} tiradas con ${money(p.budget)} de presupuesto (3.000 sesiones simuladas).`;

  $('#p-try').onclick = () => {
    const pick = OPTIONS.find((o) => o.id === profile.pick);
    loadPreset({
      wheel: p.wheel, bet: pick.bet, numbers: pick.numbers, strategy: 'flat',
      bankroll: p.budget, baseBet: p.bet, target: p.budget, maxSpins, tableMax: 0,
    });
    location.hash = '#simulador';
  };
}

const saved = loadJSON(STORAGE_KEY, null);
if (saved) for (const f of FIELDS) if (saved[f] != null) form[f].value = saved[f];
form.addEventListener('change', render);
form.addEventListener('submit', (e) => e.preventDefault());
render();
