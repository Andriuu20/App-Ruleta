// Arranque: pestañas, vistas y service worker.

import './views/simulator.js';
import './views/history.js';
import './views/profile.js';
import './views/control.js';

const VIEWS = ['simulador', 'historial', 'perfil', 'control'];

function show() {
  const current = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'simulador';
  for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== current;
  for (const tab of document.querySelectorAll('.tabs a')) {
    if (tab.hash === `#${current}`) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  }
}

window.addEventListener('hashchange', () => {
  show();
  window.scrollTo(0, 0);
});
show();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
