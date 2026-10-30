// Estrategias de progresión. Cada una devuelve la apuesta "deseada" de la
// siguiente tirada; el simulador la limita luego por banca y máximo de mesa.

export const STRATEGIES = [
  { id: 'flat', name: 'Apuesta fija',
    help: 'Siempre la misma apuesta. Es la referencia: pierde de media exactamente la ventaja de la casa por cada unidad apostada.' },
  { id: 'martingale', name: 'Martingala',
    help: 'Dobla tras cada pérdida y vuelve a la inicial al ganar. Gana poco muy a menudo, pero una racha mala arrasa la banca o choca con el máximo de mesa.' },
  { id: 'fibonacci', name: 'Fibonacci',
    help: 'Tras perder avanza un paso en la serie 1, 1, 2, 3, 5, 8…; tras ganar retrocede dos. Más lenta que la Martingala, mismo problema de fondo.' },
  { id: 'dalembert', name: "D'Alembert",
    help: 'Suma una unidad tras perder y resta una tras ganar (nunca por debajo de la inicial). Progresión suave.' },
  { id: 'custom', name: 'Personalizada',
    help: 'Define tú cómo cambia la apuesta tras ganar o perder. Ej.: Paroli = tras ganar ×2, tras perder volver, reiniciar tras 3 victorias.' },
];

export const DEFAULT_CUSTOM = {
  lossMode: 'apply', // 'apply' | 'reset' | 'keep'
  lossMult: 2,
  lossAdd: 0,
  winMode: 'reset',
  winMult: 1,
  winAdd: 0,
  resetAfterWins: 0, // 0 = nunca
  resetAfterLosses: 0,
};

function applyRule(mode, mult, addUnits, bet, base) {
  if (mode === 'reset') return base;
  if (mode === 'keep') return bet;
  return bet * mult + addUnits * base;
}

export function createStrategy(id, base, custom = DEFAULT_CUSTOM) {
  switch (id) {
    case 'flat':
      return { reset: () => base, next: () => base };

    case 'martingale': {
      let bet = base;
      return {
        reset: () => (bet = base),
        next: (won) => (bet = won ? base : bet * 2),
      };
    }

    case 'fibonacci': {
      const fib = [1, 1];
      const at = (i) => {
        while (fib.length <= i) fib.push(fib[fib.length - 1] + fib[fib.length - 2]);
        return fib[i];
      };
      let i = 0;
      return {
        reset: () => { i = 0; return base; },
        next: (won) => {
          i = won ? Math.max(0, i - 2) : i + 1;
          return base * at(i);
        },
      };
    }

    case 'dalembert': {
      let bet = base;
      return {
        reset: () => (bet = base),
        next: (won) => (bet = won ? Math.max(base, bet - base) : bet + base),
      };
    }

    case 'custom': {
      const c = { ...DEFAULT_CUSTOM, ...custom };
      let bet = base;
      let wins = 0;
      let losses = 0;
      return {
        reset: () => { wins = losses = 0; return (bet = base); },
        next: (won) => {
          if (won) { wins++; losses = 0; } else { losses++; wins = 0; }
          if ((won && c.resetAfterWins > 0 && wins >= c.resetAfterWins) ||
              (!won && c.resetAfterLosses > 0 && losses >= c.resetAfterLosses)) {
            wins = losses = 0;
            return (bet = base);
          }
          bet = won
            ? applyRule(c.winMode, c.winMult, c.winAdd, bet, base)
            : applyRule(c.lossMode, c.lossMult, c.lossAdd, bet, base);
          return (bet = Math.max(base, bet));
        },
      };
    }

    default:
      throw new Error(`Estrategia desconocida: ${id}`);
  }
}
