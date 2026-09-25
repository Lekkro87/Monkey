/** Tiny DOM builder. Keeps screens declarative without a framework. */

export type Child = Node | string | number | null | undefined | false | Child[];

export interface Props {
  class?: string | (string | false | null | undefined)[];
  style?: Partial<CSSStyleDeclaration> | string;
  id?: string;
  title?: string;
  html?: string;
  text?: string;
  disabled?: boolean;
  type?: string;
  value?: string | number;
  href?: string;
  target?: string;
  role?: string;
  tabIndex?: number;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  checked?: boolean;
  ariaLabel?: string;
  dataset?: Record<string, string>;
  onClick?: (e: MouseEvent) => void;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
  on?: Record<string, (e: Event) => void>;
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) applyProps(el, props);
  append(el, children);
  return el;
}

function applyProps(el: HTMLElement, p: Props) {
  if (p.class) el.className = Array.isArray(p.class) ? p.class.filter(Boolean).join(' ') : p.class;
  if (p.style) {
    if (typeof p.style === 'string') el.setAttribute('style', p.style);
    else Object.assign(el.style, p.style);
  }
  if (p.id) el.id = p.id;
  if (p.title) el.title = p.title;
  if (p.html !== undefined) el.innerHTML = p.html;
  if (p.text !== undefined) el.textContent = p.text;
  if (p.role) el.setAttribute('role', p.role);
  if (p.ariaLabel) el.setAttribute('aria-label', p.ariaLabel);
  if (p.tabIndex !== undefined) el.tabIndex = p.tabIndex;
  if (p.dataset) Object.assign(el.dataset, p.dataset);
  const anyEl = el as HTMLInputElement & HTMLButtonElement & HTMLAnchorElement;
  if (p.disabled !== undefined) anyEl.disabled = p.disabled;
  if (p.type) el.setAttribute('type', p.type);
  if (p.value !== undefined) anyEl.value = String(p.value);
  if (p.href) anyEl.href = p.href;
  if (p.target) anyEl.target = p.target;
  if (p.placeholder) anyEl.placeholder = p.placeholder;
  if (p.min !== undefined) anyEl.min = String(p.min);
  if (p.max !== undefined) anyEl.max = String(p.max);
  if (p.step !== undefined) anyEl.step = String(p.step);
  if (p.checked !== undefined) anyEl.checked = p.checked;
  if (p.onClick) el.addEventListener('click', p.onClick as EventListener);
  if (p.onInput) el.addEventListener('input', p.onInput);
  if (p.onChange) el.addEventListener('change', p.onChange);
  if (p.on) for (const [k, fn] of Object.entries(p.on)) el.addEventListener(k, fn);
}

export function append(el: Node, children: Child[]) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

export function clear(el: Element) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

export function replace(el: Element, ...children: Child[]) {
  clear(el);
  append(el, children);
}

export function frag(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/** Animate a number in an element from its previous value. */
export function countTo(el: HTMLElement, value: number, format: (v: number) => string, ms = 600) {
  const from = Number(el.dataset.v ?? value);
  el.dataset.v = String(value);
  if (from === value || ms <= 0) {
    el.textContent = format(value);
    return;
  }
  const start = performance.now();
  const step = () => {
    const k = Math.min(1, (performance.now() - start) / ms);
    const e = 1 - Math.pow(1 - k, 3);
    el.textContent = format(from + (value - from) * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
