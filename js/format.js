// Formato de números en español.

export const pct = (p, digits = 1) =>
  `${(p * 100).toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;

export const money = (v) => {
  const s = Math.abs(v).toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return v < -0.005 ? `−${s}` : s;
};

export const signed = (v) => (v > 0.005 ? `+${money(v)}` : money(v));

export const int = (v) => Math.round(v).toLocaleString('es-ES');

export const ratio = (payout) => {
  const r = Math.round(payout * 100) / 100;
  return `${r.toLocaleString('es-ES')}:1`;
};

export const pValue = (p) =>
  p < 0.001 ? '< 0,001' : p.toLocaleString('es-ES', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function duration(min) {
  const total = Math.max(0, Math.floor(min * 60));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = String(m).padStart(2, '0'), ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Lectura y escritura en localStorage que nunca rompen la app.
export function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* sin almacenamiento disponible */ }
}
