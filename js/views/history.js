// Vista "Historial": registro de tiradas reales y estadística descriptiva.

import { WHEELS, DOUBLE_ZERO, pocketColor, pocketLabel } from '../roulette.js';
import { parseSpins, analyzeHistory, interpret, spinsToDetect } from '../stats.js';
import { FrequencyChart } from '../chart.js';
import { renderBoard, onBoardTap } from '../board.js';
import { pct, int, pValue, loadJSON, saveJSON } from '../format.js';

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = 'ruleta.history.v1';
const VERDICT_ICON = { normal: '✓', unusual: '!', rare: '!!' };
const VERDICT_TITLE = { normal: 'Normal', unusual: 'Inusual', rare: 'Poco habitual' };

const state = loadJSON(STORAGE_KEY, { wheel: 'european', spins: [] });
if (!Array.isArray(state.spins)) state.spins = [];

const chart = new FrequencyChart($('#h-chart'));
const panel = $('#history');

function save() {
  saveJSON(STORAGE_KEY, state);
}

function setSpins(spins) {
  state.spins = spins;
  save();
  render();
}

function render() {
  const N = WHEELS[state.wheel].pockets;
  state.spins = state.spins.filter((n) => n < N);
  $('#h-count').textContent = int(state.spins.length);
  $('#h-undo').disabled = $('#h-clear').disabled = !state.spins.length;

  const recent = $('#h-recent');
  recent.innerHTML = '';
  for (const n of state.spins.slice(-40).reverse()) {
    const chip = document.createElement('span');
    chip.className = `chip p-${pocketColor(n)}`;
    chip.textContent = pocketLabel(n);
    recent.append(chip);
  }
  if (!state.spins.length) recent.innerHTML = '<span class="hint">Todavía no hay tiradas.</span>';

  const results = $('#h-results');
  results.hidden = !state.spins.length;
  if (!state.spins.length) return;

  const a = analyzeHistory(state.spins, state.wheel);
  renderVerdict(a);

  const order = Array.from({ length: N }, (_, i) => i);
  chart.setData({
    labels: order.map(pocketLabel),
    counts: order.map((n) => a.counts[n]),
    expected: a.total / N,
    total: a.total,
  });

  const groups = $('#h-groups');
  groups.innerHTML = '';
  for (const g of a.groups) groups.append(groupTable(g, a.total));

  $('#h-power').textContent =
    `Para detectar que un número concreto sale un 20 % más de lo normal harían falta unas ${int(spinsToDetect(0.2, N))} tiradas; ` +
    `para un 50 % más, unas ${int(spinsToDetect(0.5, N))}. Con pocas tiradas, las rachas y los huecos son pura casualidad.`;
}

function renderVerdict(a) {
  const v = interpret(a.numberTest);
  const box = $('#h-verdict');
  box.className = `status status-${v.level}`;
  box.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'status-head';
  head.innerHTML = `<span class="status-icon" aria-hidden="true">${VERDICT_ICON[v.level]}</span>`;
  head.append(`${VERDICT_TITLE[v.level]} · χ² = ${a.numberTest.stat.toLocaleString('es-ES', { maximumFractionDigits: 1 })}, ` +
    `${a.numberTest.df} g.l., p = ${pValue(a.numberTest.p)}`);
  const body = document.createElement('p');
  body.textContent = v.text;
  box.append(head, body);
  if (v.few) {
    const few = document.createElement('p');
    few.textContent = `Con ${int(a.total)} tiradas cada número debería salir solo ${(a.total / a.pockets).toLocaleString('es-ES', { maximumFractionDigits: 1 })} veces: ` +
      'el test es poco fiable por debajo de 5 por número (unas 190 tiradas).';
    box.append(few);
  }
}

function groupTable(g, total) {
  const wrap = document.createElement('div');
  wrap.className = 'group-block';
  const v = interpret(g.test);
  const table = document.createElement('table');
  table.className = 'odds';
  table.innerHTML = `<caption>${g.title}</caption><thead><tr><th scope="col">Grupo</th><th scope="col">Veces</th>` +
    '<th scope="col">Observado</th><th scope="col">Esperado</th></tr></thead>';
  const body = table.createTBody();
  for (const r of g.rows) {
    const tr = body.insertRow();
    for (const val of [r.name, int(r.observed), pct(r.observed / total), pct(r.expectedP)]) tr.insertCell().textContent = val;
  }
  const note = document.createElement('p');
  note.className = `hint verdict-line verdict-${v.level}`;
  note.innerHTML = `<span class="status-icon" aria-hidden="true">${VERDICT_ICON[v.level]}</span>`;
  note.append(`${VERDICT_TITLE[v.level]} (p = ${pValue(g.test.p)})`);
  wrap.append(table, note);
  return wrap;
}

// ---------- Eventos ----------

function renderBoardInput() {
  renderBoard($('#h-board'), state.wheel);
  panel.querySelector(`input[name="hwheel"][value="${state.wheel}"]`).checked = true;
}

onBoardTap($('#h-board'), (n) => {
  setSpins([...state.spins, n]);
  if (navigator.vibrate) navigator.vibrate(10);
});

$('#h-undo').addEventListener('click', () => setSpins(state.spins.slice(0, -1)));
$('#h-clear').addEventListener('click', () => {
  if (confirm(`¿Borrar las ${state.spins.length} tiradas del historial?`)) setSpins([]);
});

for (const radio of panel.querySelectorAll('input[name="hwheel"]')) {
  radio.addEventListener('change', () => {
    const removed = state.wheel === 'american' ? state.spins.filter((n) => n === DOUBLE_ZERO).length : 0;
    if (removed && !confirm(`La ruleta europea no tiene 00: se quitarán ${removed} tiradas. ¿Seguir?`)) {
      renderBoardInput();
      return;
    }
    state.wheel = radio.value;
    renderBoardInput();
    setSpins(state.spins);
  });
}

$('#h-add').addEventListener('click', () => {
  const { spins, invalid } = parseSpins($('#h-paste').value, state.wheel);
  const msg = $('#h-paste-msg');
  if (!spins.length) {
    msg.textContent = 'No se ha encontrado ningún número válido (0-36' + (state.wheel === 'american' ? ' o 00' : '') + ').';
    return;
  }
  setSpins([...state.spins, ...spins]);
  $('#h-paste').value = '';
  msg.textContent = `Añadidas ${spins.length} tiradas.` +
    (invalid.length ? ` Ignorados ${invalid.length} valores no válidos: ${invalid.slice(0, 5).join(', ')}${invalid.length > 5 ? '…' : ''}` : '');
});

renderBoardInput();
render();
