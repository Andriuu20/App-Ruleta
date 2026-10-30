// Gráficos en <canvas> sin librerías: evolución de la banca e histograma.
// Ambos leen los colores de las variables CSS, así respetan el tema claro/oscuro.

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const PAD = { top: 12, right: 12, bottom: 26, left: 48 };

function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

const compact = new Intl.NumberFormat('es-ES', { notation: 'compact', maximumFractionDigits: 1 });

class CanvasChart {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('canvas');
    this.tooltip = root.querySelector('.tooltip');
    this.ctx = this.canvas.getContext('2d');
    this.hover = null;
    new ResizeObserver(() => this.render()).observe(root);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.render());
    const move = (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.hover = { x: e.clientX - r.left, y: e.clientY - r.top };
      this.render();
    };
    this.canvas.addEventListener('pointermove', move);
    this.canvas.addEventListener('pointerdown', move);
    this.canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') { this.hover = null; this.render(); }
    });
  }

  setData(data) {
    this.data = data;
    this.hover = null;
    this.render();
  }

  render() {
    if (!this.data) return;
    const dpr = window.devicePixelRatio || 1;
    const w = this.root.clientWidth, h = this.root.clientHeight;
    if (!w || !h) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    this.w = w; this.h = h;
    this.plotW = w - PAD.left - PAD.right;
    this.plotH = h - PAD.top - PAD.bottom;
    this.tooltip.hidden = true;
    this.draw();
  }

  axes(xMin, xMax, yMin, yMax, formatX) {
    const { ctx } = this;
    this.sx = (x) => PAD.left + ((x - xMin) / (xMax - xMin || 1)) * this.plotW;
    this.sy = (y) => PAD.top + (1 - (y - yMin) / (yMax - yMin || 1)) * this.plotH;
    ctx.font = '11px system-ui, sans-serif';
    ctx.lineWidth = 1;
    ctx.fillStyle = css('--muted');
    ctx.strokeStyle = css('--grid');
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const t of niceTicks(yMin, yMax, 4)) {
      const y = Math.round(this.sy(t)) + 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(this.w - PAD.right, y); ctx.stroke();
      ctx.fillText(compact.format(t), PAD.left - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xt = niceTicks(xMin, xMax, Math.max(2, Math.floor(this.plotW / 70)));
    for (const t of xt) ctx.fillText(formatX(t), this.sx(t), this.h - PAD.bottom + 8);
  }

  showTooltip(html, x, y) {
    const tt = this.tooltip;
    tt.innerHTML = html;
    tt.hidden = false;
    const tw = tt.offsetWidth, th = tt.offsetHeight;
    let left = x + 12, top = y - th - 10;
    if (left + tw > this.w) left = x - tw - 12;
    if (left < 0) left = 0;
    if (top < 0) top = y + 14;
    tt.style.left = `${left}px`;
    tt.style.top = `${top}px`;
  }
}

const OUTCOME_COLOR = ['--series-target', '--series-ruin', '--series-timeout'];
const OUTCOME_TEXT = ['llegó al objetivo', 'ruina', 'se acabaron las tiradas'];

export class PathsChart extends CanvasChart {
  // data = { paths: [{outcome, points, stride, spins}], bankroll, goal, format }
  draw() {
    const { ctx, data } = this;
    const maxX = Math.max(1, ...data.paths.map((p) => p.spins));
    let yMin = 0, yMax = data.bankroll;
    for (const p of data.paths) for (const v of p.points) if (v > yMax) yMax = v;
    if (Number.isFinite(data.goal)) yMax = Math.max(yMax, data.goal);
    yMax *= 1.05;
    this.axes(0, maxX, yMin, yMax, (t) => compact.format(t));

    const xOf = (p, i) => Math.min(i * p.stride, p.spins);

    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = css('--ref');
    ctx.lineWidth = 1;
    for (const ref of [data.bankroll, data.goal]) {
      if (!Number.isFinite(ref)) continue;
      const y = Math.round(this.sy(ref)) + 0.5;
      ctx.beginPath(); ctx.moveTo(PAD.left, y); ctx.lineTo(this.w - PAD.right, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Línea más cercana al dedo/cursor.
    let active = -1;
    if (this.hover) {
      let best = 28;
      data.paths.forEach((p, idx) => {
        const i = Math.round(Math.max(0, ((this.hover.x - PAD.left) / this.plotW) * maxX) / p.stride);
        if (i >= p.points.length) return;
        const d = Math.abs(this.sy(p.points[i]) - this.hover.y);
        if (d < best) { best = d; active = idx; }
      });
    }

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    data.paths.forEach((p, idx) => {
      if (idx === active) return;
      ctx.globalAlpha = active >= 0 ? 0.25 : 0.85;
      this.line(p, xOf, css(OUTCOME_COLOR[p.outcome]), 1.5);
    });
    ctx.globalAlpha = 1;

    if (active >= 0) {
      const p = data.paths[active];
      const color = css(OUTCOME_COLOR[p.outcome]);
      this.line(p, xOf, color, 2.5);
      const i = Math.min(p.points.length - 1, Math.round(Math.max(0, ((this.hover.x - PAD.left) / this.plotW) * maxX) / p.stride));
      const x = this.sx(xOf(p, i)), y = this.sy(p.points[i]);
      ctx.strokeStyle = css('--grid');
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, PAD.top + this.plotH); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = css('--surface'); ctx.stroke();
      this.showTooltip(
        `<div><span class="tt-dot" style="background:${color}"></span><strong>Sesión ${active + 1}</strong></div>` +
        `<div>Tirada ${xOf(p, i)}: banca ${data.format(p.points[i])}</div>` +
        `<div>Final: ${OUTCOME_TEXT[p.outcome]} en la tirada ${p.spins}</div>`,
        x, y);
    }
  }

  line(p, xOf, color, width) {
    const { ctx } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    p.points.forEach((v, i) => {
      const x = this.sx(xOf(p, i)), y = this.sy(v);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
  }
}

export class HistogramChart extends CanvasChart {
  // data = { bins: [{from, to, count}], total, format }
  draw() {
    const { ctx, data } = this;
    const { bins } = data;
    const xMin = bins[0].from, xMax = bins[bins.length - 1].to === xMin ? xMin + 1 : bins[bins.length - 1].to;
    const yMax = Math.max(...bins.map((b) => b.count)) * 1.08;
    this.axes(xMin, xMax, 0, yMax, (t) => compact.format(t));

    const n = bins.length;
    const slot = this.plotW / n;
    const gap = Math.min(2, slot * 0.2);
    const hoverIdx = this.hover ? Math.floor((this.hover.x - PAD.left) / slot) : -1;
    const base = this.sy(0);
    const bar = css('--bar');

    bins.forEach((b, i) => {
      if (!b.count) return;
      const x = PAD.left + i * slot + gap / 2;
      const y = this.sy(b.count);
      const bw = Math.max(1, slot - gap);
      const r = Math.min(4, bw / 2, base - y);
      ctx.globalAlpha = hoverIdx >= 0 && hoverIdx !== i ? 0.45 : 1;
      ctx.fillStyle = bar;
      ctx.beginPath();
      ctx.moveTo(x, base);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.lineTo(x + bw - r, y);
      ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.lineTo(x + bw, base);
      ctx.closePath();
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (xMin < 0 && xMax > 0) {
      const x = Math.round(this.sx(0)) + 0.5;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = css('--ref');
      ctx.beginPath(); ctx.moveTo(x, PAD.top); ctx.lineTo(x, base); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = css('--text-2');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText('0', x + 4, PAD.top);
    }

    if (hoverIdx >= 0 && hoverIdx < n) {
      const b = bins[hoverIdx];
      const share = (b.count / data.total) * 100;
      this.showTooltip(
        `<div><strong>${data.format(b.from)} a ${data.format(b.to)}</strong></div>` +
        `<div>${b.count.toLocaleString('es-ES')} sesiones (${share.toLocaleString('es-ES', { maximumFractionDigits: 1 })} %)</div>`,
        PAD.left + (hoverIdx + 0.5) * slot, this.sy(b.count));
    }
  }
}
