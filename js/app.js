import { BETS, WHEELS, DOUBLE_ZERO, getBet, betNumbers, betStats, houseEdge, pocketColor, pocketLabel } from './roulette.js';
import { STRATEGIES } from './strategies.js';
import { PathsChart, HistogramChart } from './chart.js';

const $ = (sel) => document.querySelector(sel);
const form = $('#config');
const STORAGE_KEY = 'ruleta.config.v1';

const pct = (p, digits = 1) => `${(p * 100).toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
const money = (v) => {
  const s = Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return v < -0.005 ? `−${s}` : s;
};
const signed = (v) => (v > 0.005 ? `+${money(v)}` : money(v));
const int = (v) => Math.round(v).toLocaleString('es-ES');
const ratio = (payout) => {
  const r = Math.round(payout * 100) / 100;
  return Number.isInteger(r) ? `${r}:1` : `${r.toLocaleString('es-ES')}:1`;
};

let selectedNumbers = new Set([17]);

// ---------- Construcción del formulario ----------

function buildBetSelect() {
  const select = $('#bet');
  const groups = new Map();
  for (const b of BETS) {
    if (!groups.has(b.group)) {
      const og = document.createElement('optgroup');
      og.label = b.group;
      groups.set(b.group, og);
      select.append(og);
    }
    groups.get(b.group).append(new Option(b.name, b.id));
  }
}

function buildStrategySelect() {
  const select = $('#strategy');
  for (const s of STRATEGIES) select.append(new Option(s.name, s.id));
}

function buildPicker() {
  const picker = $('#picker');
  picker.innerHTML = '';
  const make = (n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = pocketLabel(n);
    b.dataset.n = n;
    b.className = `p-${pocketColor(n)}`;
    b.setAttribute('aria-pressed', selectedNumbers.has(n));
    b.setAttribute('aria-label', `Número ${pocketLabel(n)}`);
    return b;
  };
  const zeros = document.createElement('div');
  zeros.className = 'zeros';
  zeros.append(make(0));
  if (wheel() === 'american') zeros.append(make(DOUBLE_ZERO));
  picker.append(zeros);
  // Disposición del tapete: fila superior 3, 6, 9…; inferior 1, 4, 7…
  for (const row of [3, 2, 1]) for (let col = 0; col < 12; col++) picker.append(make(col * 3 + row));
}

$('#picker').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-n]');
  if (!btn) return;
  const n = Number(btn.dataset.n);
  selectedNumbers.has(n) ? selectedNumbers.delete(n) : selectedNumbers.add(n);
  btn.setAttribute('aria-pressed', selectedNumbers.has(n));
  updateBetInfo();
  save();
});
$('#picker-clear').addEventListener('click', () => {
  selectedNumbers.clear();
  buildPicker();
  updateBetInfo();
  save();
});

const wheel = () => form.wheel.value;

function currentNumbers() {
  const nums = betNumbers(form.bet.value, [...selectedNumbers]);
  return wheel() === 'american' ? nums : nums.filter((n) => n !== DOUBLE_ZERO);
}

function updateBetOptions() {
  const american = wheel() === 'american';
  for (const opt of form.bet.options) opt.disabled = american && getBet(opt.value).europeanOnly;
  if (form.bet.selectedOptions[0]?.disabled) form.bet.value = 'red';
  if (!american) selectedNumbers.delete(DOUBLE_ZERO);
}

function updateBetInfo() {
  const bet = getBet(form.bet.value);
  $('#picker-wrap').hidden = !bet.custom;
  const k = currentNumbers().length;
  const info = $('#bet-info');
  if (!k) { info.textContent = 'Elige al menos un número.'; return; }
  const s = betStats(k, wheel());
  let text = `Cubre ${k} ${k === 1 ? 'número' : 'números'} · gana ${pct(s.probability)} de las tiradas · paga ${ratio(s.payout)}`;
  if (bet.group === 'Sectores' || (bet.custom && k > 1)) text += ' (la apuesta se reparte por igual entre los números)';
  info.textContent = text;
}

function updateStrategy() {
  const s = STRATEGIES.find((x) => x.id === form.strategy.value);
  $('#strategy-help').textContent = s.help;
  $('#custom').hidden = s.id !== 'custom';
  for (const mode of ['lossMode', 'winMode']) {
    for (const el of form.querySelectorAll(`[data-for="${mode}"]`)) el.hidden = form[mode].value !== 'apply';
  }
}

function renderOddsTable() {
  const w = wheel();
  const N = WHEELS[w].pockets;
  $('#odds-caption').textContent =
    `Ruleta ${w === 'european' ? 'europea' : 'americana'}: ${N} casillas. Ventaja de la casa ${pct(houseEdge(w), 2)}: ` +
    `por cada 100 apostados se pierden de media ${(houseEdge(w) * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })}, sea cual sea la apuesta.`;
  const body = $('#odds-body');
  body.innerHTML = '';
  let group = null;
  const rows = BETS.filter((b) => !b.custom && !(w === 'american' && b.europeanOnly))
    .map((b) => ({ id: b.id, group: b.group, name: b.name, k: b.numbers().length }));
  rows.push({ id: 'numbers', group: 'Números', name: 'Pleno (1 número)', k: 1 });
  for (const r of rows) {
    if (r.group !== group) {
      group = r.group;
      const tr = body.insertRow();
      tr.className = 'group';
      const td = tr.insertCell();
      td.colSpan = 5;
      td.textContent = group;
    }
    const s = betStats(r.k, w);
    const tr = body.insertRow();
    if (r.id === form.bet.value && (r.id !== 'numbers' || currentNumbers().length === 1)) tr.className = 'selected';
    for (const v of [r.name, r.k, pct(s.probability), ratio(s.payout), pct(s.expectedPerUnit, 2)]) tr.insertCell().textContent = v;
  }
}

// ---------- Lectura y validación ----------

function readConfig() {
  const num = (name) => Number(form[name].value);
  const cfg = {
    wheel: wheel(),
    bet: form.bet.value,
    numbers: currentNumbers(),
    bankroll: num('bankroll'),
    baseBet: num('baseBet'),
    target: num('target'),
    maxSpins: Math.round(num('maxSpins')),
    tableMax: num('tableMax'),
    sessions: num('sessions'),
    strategy: form.strategy.value,
    custom: {
      lossMode: form.lossMode.value, lossMult: num('lossMult'), lossAdd: num('lossAdd'),
      winMode: form.winMode.value, winMult: num('winMult'), winAdd: num('winAdd'),
      resetAfterWins: Math.round(num('resetAfterWins')), resetAfterLosses: Math.round(num('resetAfterLosses')),
    },
    samplePaths: 10,
  };

  const errors = [];
  const bad = (name, msg) => { errors.push(msg); form[name].setAttribute('aria-invalid', 'true'); };
  for (const el of form.querySelectorAll('[aria-invalid]')) el.removeAttribute('aria-invalid');

  if (!(cfg.bankroll > 0)) bad('bankroll', 'La banca inicial debe ser mayor que 0.');
  if (!(cfg.baseBet > 0)) bad('baseBet', 'La apuesta inicial debe ser mayor que 0.');
  else if (cfg.baseBet > cfg.bankroll) bad('baseBet', 'La apuesta inicial no puede superar la banca.');
  if (!(cfg.target >= 0)) bad('target', 'El objetivo no puede ser negativo.');
  if (!(cfg.maxSpins >= 1 && cfg.maxSpins <= 100000)) bad('maxSpins', 'El máximo de tiradas debe estar entre 1 y 100.000.');
  else if (cfg.maxSpins * cfg.sessions > 2e8) bad('maxSpins', 'Demasiado cálculo para el teléfono: reduce las tiradas o las sesiones (máx. 200 millones de tiradas en total).');
  if (!(cfg.tableMax >= 0)) bad('tableMax', 'El máximo de mesa no puede ser negativo.');
  else if (cfg.tableMax > 0 && cfg.tableMax < cfg.baseBet) bad('tableMax', 'El máximo de mesa debe ser al menos la apuesta inicial.');
  if (!cfg.numbers.length) errors.push('Elige al menos un número en el tablero.');
  if (cfg.strategy === 'custom') {
    for (const f of ['lossMult', 'lossAdd', 'winMult', 'winAdd', 'resetAfterWins', 'resetAfterLosses']) {
      if (!Number.isFinite(cfg.custom[f])) bad(f, 'Revisa las reglas personalizadas.');
    }
  }
  return { cfg, errors: [...new Set(errors)] };
}

// ---------- Persistencia (solo comodidad local) ----------

const SAVED_FIELDS = ['wheel', 'bet', 'strategy', 'bankroll', 'baseBet', 'target', 'maxSpins', 'tableMax', 'sessions',
  'lossMode', 'lossMult', 'lossAdd', 'winMode', 'winMult', 'winAdd', 'resetAfterWins', 'resetAfterLosses'];

function save() {
  try {
    const data = Object.fromEntries(SAVED_FIELDS.map((f) => [f, form[f].value]));
    data.numbers = [...selectedNumbers];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* sin almacenamiento disponible */ }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data) return;
    for (const f of SAVED_FIELDS) if (data[f] != null) form[f].value = data[f];
    if (Array.isArray(data.numbers)) selectedNumbers = new Set(data.numbers.filter(Number.isInteger));
  } catch { /* configuración ilegible: se usan los valores por defecto */ }
}

// ---------- Simulación ----------

let worker = null;

function runSimulation(cfg) {
  return new Promise((resolve, reject) => {
    if (worker) worker.terminate();
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch {
      // Sin workers de módulo: se calcula en el hilo principal.
      import('./simulator.js').then(({ simulate }) => resolve(simulate(cfg))).catch(reject);
      return;
    }
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') setProgress(data.progress);
      else if (data.type === 'done') resolve(data.result);
      else reject(new Error(data.message));
    };
    worker.onerror = (e) => reject(new Error(e.message || 'Error en la simulación'));
    worker.postMessage(cfg);
  });
}

function setProgress(p) {
  $('#progress div').style.width = `${Math.round(p * 100)}%`;
}

const pathsChart = new PathsChart($('#paths-chart'));
const histChart = new HistogramChart($('#hist-chart'));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const { cfg, errors } = readConfig();
  const errorBox = $('#form-error');
  errorBox.hidden = !errors.length;
  errorBox.textContent = errors.join(' ');
  if (errors.length) return;

  const btn = $('#run');
  btn.disabled = true;
  btn.textContent = 'Simulando…';
  $('#progress').hidden = false;
  setProgress(0);
  try {
    const result = await runSimulation(cfg);
    renderResults(cfg, result);
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = `No se pudo simular: ${err.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simular';
    $('#progress').hidden = true;
  }
});

function renderResults(cfg, r) {
  const section = $('#results');
  section.hidden = false;
  const hasTarget = cfg.target > 0;
  const ci = (x) => `±${(x.ci * 100).toLocaleString('es-ES', { maximumFractionDigits: 1 })} pts`;

  $('#t-target').textContent = hasTarget ? pct(r.target.p) : '—';
  $('#t-target-ci').textContent = hasTarget ? `${ci(r.target)} · objetivo +${money(cfg.target)}` : 'Sin objetivo';
  $('#t-ruin').textContent = pct(r.ruin.p);
  $('#t-ruin-sub').textContent = r.meanSpinsToRuin != null ? `de media en la tirada ${int(r.meanSpinsToRuin)}` : 'ninguna sesión';
  $('#t-timeout').textContent = pct(r.timeout.p);
  $('#t-timeout-sub').textContent = `tras ${int(cfg.maxSpins)} tiradas`;
  $('#t-profit').textContent = signed(r.meanProfit);
  $('#t-profit-sub').textContent = `teórica ${signed(r.theoreticalProfit)}`;

  $('#summary').textContent = summaryText(cfg, r);

  const details = [
    ['Probabilidad de ganar cada tirada', pct(r.winProbability)],
    ['Pago de la apuesta', ratio(r.payout)],
    ['Sesiones que terminan con beneficio', pct(r.endedInProfit.p)],
    ['Tiradas medias por sesión', int(r.meanSpins)],
    ['Tiradas medias hasta la ruina', r.meanSpinsToRuin != null ? int(r.meanSpinsToRuin) : '—'],
    ['Total apostado medio por sesión', money(r.meanWagered)],
    ['Pérdida teórica (ventaja × apostado)', signed(r.theoreticalProfit)],
    ['Ganancia media simulada', `${signed(r.meanProfit)} ±${money(r.meanProfitCI)}`],
    ['Resultado mediano', signed(r.median)],
    ['90 % de las sesiones entre', `${signed(r.p05)} y ${signed(r.p95)}`],
    ['Peor / mejor sesión', `${signed(r.worst)} / ${signed(r.best)}`],
    ['Apuesta máxima media por sesión', money(r.meanMaxBet)],
    ['Apuesta más alta vista', money(r.maxBet)],
    ['Racha perdedora más larga', `${int(r.longestLosing)} tiradas`],
  ];
  if (cfg.tableMax > 0 && cfg.strategy !== 'flat') details.push(['Sesiones que chocan con el máximo de mesa', pct(r.cappedShare)]);
  details.push(['Sesiones simuladas', int(r.sessions)]);
  const dl = $('#details');
  dl.innerHTML = '';
  for (const [k, v] of details) {
    const dt = document.createElement('dt'); dt.textContent = k;
    const dd = document.createElement('dd'); dd.textContent = v;
    dl.append(dt, dd);
  }

  pathsChart.setData({
    paths: r.paths,
    bankroll: cfg.bankroll,
    goal: hasTarget ? cfg.bankroll + cfg.target : NaN,
    format: money,
  });
  histChart.setData({ bins: r.histogram, total: r.sessions, format: signed });
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function summaryText(cfg, r) {
  const loss = -r.theoreticalProfit;
  const per100 = (r.houseEdge * 100).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  let s = '';
  if (cfg.target > 0) {
    s += `${pct(r.target.p, 0)} de las sesiones llegan a +${money(cfg.target)}`;
    s += r.ruin.p > 0 ? ` y ${pct(r.ruin.p, 0)} pierden la banca. ` : '. ';
  } else {
    s += `${pct(r.ruin.p, 0)} de las sesiones pierden la banca. `;
  }
  if (cfg.target > 0 && r.target.p > 0.5 && r.meanProfit < 0) {
    s += 'Ganar a menudo no compensa: cuando se pierde, se pierde mucho más de lo que se gana. ';
  }
  s += `De media se apuestan ${money(r.meanWagered)} por sesión, y la casa se queda con ${per100} de cada 100: unos ${money(loss)} por sesión.`;
  return s;
}

// ---------- Inicio ----------

buildBetSelect();
buildStrategySelect();
load();
updateBetOptions();
buildPicker();
updateBetInfo();
updateStrategy();
renderOddsTable();

form.addEventListener('change', (e) => {
  if (e.target.name === 'wheel') { updateBetOptions(); buildPicker(); }
  updateBetInfo();
  updateStrategy();
  renderOddsTable();
  save();
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
