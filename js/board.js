// Tablero de números con la disposición del tapete (fila superior 3, 6, 9…).

import { DOUBLE_ZERO, pocketColor, pocketLabel } from './roulette.js';

export function renderBoard(container, wheel, { pressed } = {}) {
  container.innerHTML = '';
  const make = (n) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = pocketLabel(n);
    b.dataset.n = n;
    b.className = `p-${pocketColor(n)}`;
    if (pressed) b.setAttribute('aria-pressed', pressed(n));
    b.setAttribute('aria-label', `Número ${pocketLabel(n)}`);
    return b;
  };
  const zeros = document.createElement('div');
  zeros.className = 'zeros';
  zeros.append(make(0));
  if (wheel === 'american') zeros.append(make(DOUBLE_ZERO));
  container.append(zeros);
  for (const row of [3, 2, 1]) for (let col = 0; col < 12; col++) container.append(make(col * 3 + row));
}

export function onBoardTap(container, handler) {
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-n]');
    if (btn) handler(Number(btn.dataset.n), btn);
  });
}
