// Control de gasto: estado de una sesión de juego real frente a sus límites.

export const WARN_AT = 0.8;

export function newSession({ lossLimit, timeLimitMin, winStop = 0 }, now = Date.now()) {
  return { start: now, lossLimit, timeLimitMin, winStop, entries: [] };
}

export function sessionNet(session) {
  return session.entries.reduce((s, e) => s + e.amount, 0);
}

const levelOf = (share) => (share >= 1 ? 'stop' : share >= WARN_AT ? 'warn' : 'ok');
const RANK = { ok: 0, warn: 1, stop: 2 };

export function sessionStatus(session, now = Date.now()) {
  const net = sessionNet(session);
  const elapsedMin = (now - session.start) / 60000;
  const lossShare = session.lossLimit > 0 ? Math.max(0, -net) / session.lossLimit : 0;
  const timeShare = session.timeLimitMin > 0 ? elapsedMin / session.timeLimitMin : 0;
  const money = levelOf(lossShare);
  const time = levelOf(timeShare);
  const winReached = session.winStop > 0 && net >= session.winStop;

  const messages = [];
  if (money === 'stop') messages.push('Has llegado a tu límite de pérdida. Para aquí: intentar recuperar lo perdido suele aumentar la pérdida.');
  else if (money === 'warn') messages.push('Has usado más del 80 % de tu límite de pérdida.');
  if (time === 'stop') messages.push('Se acabó el tiempo que te diste para esta sesión.');
  else if (time === 'warn') messages.push('Te queda poco tiempo de sesión.');
  if (winReached) messages.push('Has alcanzado tu objetivo de ganancia. Es un buen momento para retirarte con él.');

  let level = RANK[money] >= RANK[time] ? money : time;
  if (winReached) level = 'stop';

  return {
    net,
    elapsedMin,
    lossShare,
    timeShare,
    lossLeft: session.lossLimit > 0 ? Math.max(0, session.lossLimit + net) : null,
    timeLeftMin: session.timeLimitMin > 0 ? Math.max(0, session.timeLimitMin - elapsedMin) : null,
    money,
    time,
    winReached,
    level,
    messages,
  };
}

export function closeSession(session, now = Date.now()) {
  return { start: session.start, end: now, net: sessionNet(session), bets: session.entries.length };
}
