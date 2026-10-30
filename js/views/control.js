// Vista "Control de gasto": límites de dinero y tiempo para una sesión real.

import { newSession, sessionStatus, closeSession } from '../session.js';
import { pct, money, signed, duration, loadJSON, saveJSON } from '../format.js';

const $ = (sel) => document.querySelector(sel);
const STORAGE_KEY = 'ruleta.control.v1';
const LEVEL_TEXT = { ok: 'Dentro de tus límites', warn: 'Cerca del límite', stop: 'Hora de parar' };
const LEVEL_ICON = { ok: '✓', warn: '!', stop: '■' };

const state = loadJSON(STORAGE_KEY, { active: null, past: [] });
if (!Array.isArray(state.past)) state.past = [];
let lastLevel = null;
let timer = null;

const save = () => saveJSON(STORAGE_KEY, state);

function render() {
  const s = state.active;
  $('#s-setup').hidden = !!s;
  $('#s-active').hidden = !s;
  clearInterval(timer);
  if (s) {
    tick();
    timer = setInterval(tick, 1000);
  }
  renderEntries();
  renderPast();
}

function tick() {
  const s = state.active;
  if (!s) return;
  const st = sessionStatus(s);

  $('#s-elapsed').textContent = duration(st.elapsedMin);
  $('#s-time-sub').textContent = st.timeLeftMin != null ? `quedan ${duration(st.timeLeftMin)}` : 'sin límite de tiempo';
  $('#s-net').textContent = signed(st.net);
  $('#s-net-sub').textContent = s.winStop > 0 ? `objetivo +${money(s.winStop)}` : `${s.entries.length} anotaciones`;
  $('#s-left').textContent = st.lossLeft != null ? money(st.lossLeft) : '—';
  $('#s-left-sub').textContent = st.lossLeft != null ? `de ${money(s.lossLimit)} de límite` : 'sin límite';

  meter('#s-money-meter', st.lossShare, st.money, `Pérdida: ${pct(Math.min(st.lossShare, 9.99), 0)} del límite`);
  meter('#s-time-meter', st.timeShare, st.time, `Tiempo: ${pct(Math.min(st.timeShare, 9.99), 0)} del límite`);

  const box = $('#s-status');
  box.className = `status status-${st.level}`;
  box.innerHTML = '';
  const head = document.createElement('p');
  head.className = 'status-head';
  head.innerHTML = `<span class="status-icon" aria-hidden="true">${LEVEL_ICON[st.level]}</span>`;
  head.append(LEVEL_TEXT[st.level]);
  box.append(head);
  for (const m of st.messages) {
    const p = document.createElement('p');
    p.textContent = m;
    box.append(p);
  }

  if (lastLevel && st.level !== lastLevel && st.level !== 'ok' && navigator.vibrate) {
    navigator.vibrate(st.level === 'stop' ? [300, 150, 300] : 200);
  }
  lastLevel = st.level;
}

function meter(sel, share, level, label) {
  const el = $(sel);
  el.querySelector('.meter-fill').style.width = `${Math.min(100, share * 100)}%`;
  el.querySelector('.meter-fill').className = `meter-fill level-${level}`;
  el.querySelector('.meter-label').textContent = label;
  el.setAttribute('aria-valuenow', Math.round(share * 100));
}

function renderEntries() {
  const list = $('#s-entries');
  list.innerHTML = '';
  const entries = state.active?.entries ?? [];
  for (const e of entries.slice(-8).reverse()) {
    const li = document.createElement('li');
    const time = new Date(e.t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span class="muted">${time}</span>`;
    const v = document.createElement('strong');
    v.textContent = signed(e.amount);
    li.append(v);
    list.append(li);
  }
  $('#s-undo').disabled = !entries.length;
}

function renderPast() {
  const list = $('#s-past');
  list.innerHTML = '';
  $('#s-past-empty').hidden = state.past.length > 0;
  $('#s-past-clear').hidden = !state.past.length;
  for (const p of state.past.slice(-10).reverse()) {
    const li = document.createElement('li');
    const date = new Date(p.start).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    li.innerHTML = `<span>${date} · ${duration((p.end - p.start) / 60000)}</span>`;
    const v = document.createElement('strong');
    v.textContent = signed(p.net);
    li.append(v);
    list.append(li);
  }
  const total = state.past.reduce((s, p) => s + p.net, 0);
  $('#s-past-total').textContent = state.past.length
    ? `Resultado acumulado de ${state.past.length} ${state.past.length === 1 ? 'sesión' : 'sesiones'}: ${signed(total)}`
    : '';
}

$('#s-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const lossLimit = Number(f.lossLimit.value), timeLimitMin = Number(f.timeLimit.value), winStop = Number(f.winStop.value) || 0;
  const err = $('#s-error');
  if (!(lossLimit > 0) || !(timeLimitMin > 0)) {
    err.hidden = false;
    err.textContent = 'Pon un límite de pérdida y un tiempo máximo mayores que 0.';
    return;
  }
  err.hidden = true;
  state.active = newSession({ lossLimit, timeLimitMin, winStop });
  lastLevel = null;
  save();
  render();
});

function addEntry(sign) {
  const input = $('#s-amount');
  const amount = Number(input.value);
  if (!(amount > 0)) { input.setAttribute('aria-invalid', 'true'); input.focus(); return; }
  input.removeAttribute('aria-invalid');
  state.active.entries.push({ t: Date.now(), amount: sign * amount });
  save();
  tick();
  renderEntries();
}

$('#s-won').addEventListener('click', () => addEntry(1));
$('#s-lost').addEventListener('click', () => addEntry(-1));
$('#s-undo').addEventListener('click', () => {
  state.active.entries.pop();
  save();
  tick();
  renderEntries();
});
$('#s-end').addEventListener('click', () => {
  if (!confirm('¿Terminar la sesión?')) return;
  state.past.push(closeSession(state.active));
  state.past = state.past.slice(-100);
  state.active = null;
  save();
  render();
});
$('#s-past-clear').addEventListener('click', () => {
  if (!confirm('¿Borrar el registro de sesiones anteriores?')) return;
  state.past = [];
  save();
  renderPast();
});

// Al volver a la app (p. ej. tras bloquear el móvil) se recalcula al momento.
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

render();
