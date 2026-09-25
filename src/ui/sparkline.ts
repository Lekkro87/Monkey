import { t } from '../core/i18n';

const NS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
}

export interface SparkOptions {
  width?: number;
  height?: number;
  /** Shared y-domain so rows are comparable. */
  domain: [number, number];
  /** Reference line (market normal = 1.0). */
  baseline?: number;
  /** First day number of the series, for the tooltip. */
  startDay: number;
}

/**
 * Trend sparkline: de-emphasised line with a faint area, a dashed baseline at
 * "normal", the current value as an accent dot, and a crosshair + tooltip on hover.
 */
export function sparkline(values: number[], opts: SparkOptions): HTMLElement {
  const w = opts.width ?? 110;
  const hgt = opts.height ?? 30;
  const pad = 4;
  const [lo, hi] = opts.domain;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (w - pad * 2);
  const y = (v: number) => pad + (1 - (v - lo) / Math.max(1e-6, hi - lo)) * (hgt - pad * 2);
  const wrap = document.createElement('div');
  wrap.className = 'spark-wrap';
  wrap.style.position = 'relative';
  const svg = el('svg', { viewBox: `0 0 ${w} ${hgt}`, width: w, height: hgt, class: 'spark', role: 'img' });
  const last = values[values.length - 1] ?? 1;
  svg.setAttribute('aria-label', t('Trend over the last {n} days, now {v}', { n: values.length, v: `${Math.round(last * 100)}%` }));
  if (opts.baseline !== undefined) {
    svg.appendChild(el('line', { x1: pad, x2: w - pad, y1: y(opts.baseline), y2: y(opts.baseline), stroke: 'var(--text-faint)', 'stroke-width': 1, 'stroke-dasharray': '2 3', opacity: 0.6 }));
  }
  if (values.length > 1) {
    const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const area = `M${x(0).toFixed(1)},${hgt - pad} L${pts.join(' L')} L${x(values.length - 1).toFixed(1)},${hgt - pad} Z`;
    svg.appendChild(el('path', { d: area, fill: 'var(--text-dim)', opacity: 0.1 }));
    svg.appendChild(el('polyline', { points: pts.join(' '), fill: 'none', stroke: 'var(--text-dim)', 'stroke-width': 1.6, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
  }
  const cx = x(values.length - 1);
  const cy = y(last);
  svg.appendChild(el('circle', { cx, cy, r: 3.6, fill: 'var(--steel-850)' }));
  svg.appendChild(el('circle', { cx, cy, r: 2.6, fill: 'var(--hazard)' }));
  const hair = el('line', { x1: 0, x2: 0, y1: pad - 2, y2: hgt - pad + 2, stroke: 'var(--text)', 'stroke-width': 1, opacity: 0 });
  const dot = el('circle', { cx: 0, cy: 0, r: 2.6, fill: 'var(--text)', opacity: 0 });
  svg.appendChild(hair);
  svg.appendChild(dot);
  const tip = document.createElement('div');
  tip.className = 'spark-tip';
  tip.hidden = true;
  wrap.appendChild(svg);
  wrap.appendChild(tip);
  const show = (clientX: number) => {
    const r = svg.getBoundingClientRect();
    const rel = ((clientX - r.left) / r.width) * w;
    const i = Math.max(0, Math.min(values.length - 1, Math.round(((rel - pad) / (w - pad * 2)) * (values.length - 1))));
    hair.setAttribute('x1', String(x(i)));
    hair.setAttribute('x2', String(x(i)));
    hair.setAttribute('opacity', '0.5');
    dot.setAttribute('cx', String(x(i)));
    dot.setAttribute('cy', String(y(values[i])));
    dot.setAttribute('opacity', '1');
    const pctv = Math.round((values[i] - 1) * 100);
    tip.textContent = '';
    const strong = document.createElement('b');
    strong.textContent = `${pctv >= 0 ? '+' : ''}${pctv}%`;
    tip.appendChild(strong);
    tip.appendChild(document.createTextNode(` · ${t('Day {n}', { n: opts.startDay + i })}`));
    tip.style.left = `${(x(i) / w) * 100}%`;
    tip.hidden = false;
  };
  const hide = () => {
    hair.setAttribute('opacity', '0');
    dot.setAttribute('opacity', '0');
    tip.hidden = true;
  };
  wrap.tabIndex = 0;
  wrap.addEventListener('pointermove', (e) => show(e.clientX));
  wrap.addEventListener('pointerleave', hide);
  wrap.addEventListener('focus', () => { const r = svg.getBoundingClientRect(); show(r.right - 1); });
  wrap.addEventListener('blur', hide);
  return wrap;
}
