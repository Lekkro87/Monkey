import * as THREE from 'three';
import { t } from '../core/i18n';
import { h, replace, type Child } from './dom';
import { icon } from './icons';

export interface ModalOptions {
  title: string;
  sub?: string;
  body: Child;
  actions?: { label: string; kind?: 'primary' | 'danger' | 'ghost'; icon?: string; disabled?: boolean; onClick: () => void | boolean }[];
  wide?: boolean;
  dismissable?: boolean;
  onClose?: () => void;
}

interface Bubble {
  el: HTMLElement;
  anchor: () => THREE.Vector3 | null;
  until: number;
}

/**
 * Owns the DOM overlay: HUD, the active screen, world-anchored speech bubbles,
 * big cinematic banners, modals and toasts.
 */
export class UIManager {
  readonly root: HTMLElement;
  readonly hud: HTMLElement;
  readonly screen: HTMLElement;
  readonly world: HTMLElement;
  readonly overlay: HTMLElement;
  readonly modals: HTMLElement;
  readonly toasts: HTMLElement;
  private bubbles = new Map<string, Bubble>();
  private modalStack: { el: HTMLElement; opts: ModalOptions }[] = [];

  constructor(parent: HTMLElement) {
    this.root = h('div', { id: 'ui' });
    this.hud = h('div', { class: 'hud-layer' });
    this.screen = h('div', { class: 'screen-layer' });
    this.world = h('div', { class: 'bubbles' });
    this.overlay = h('div', { class: 'overlay-layer' });
    this.modals = h('div', { class: 'modal-layer' });
    this.toasts = h('div', { class: 'toasts' });
    for (const layer of [this.world, this.screen, this.hud, this.overlay, this.modals, this.toasts]) {
      layer.style.position = 'absolute';
      layer.style.inset = '0';
      this.root.appendChild(layer);
    }
    this.toasts.style.inset = '';
    parent.appendChild(this.root);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalStack.length) {
        const top = this.modalStack[this.modalStack.length - 1];
        if (top.opts.dismissable !== false) this.closeModal(top.el);
      }
    });
  }

  setScreen(...children: Child[]) {
    replace(this.screen, ...children);
  }

  setHud(...children: Child[]) {
    replace(this.hud, ...children);
  }

  get modalOpen(): boolean {
    return this.modalStack.length > 0;
  }

  // ── Toasts ────────────────────────────────────────────────────────────────

  toast(text: string, kind: 'info' | 'good' | 'bad' | 'achievement' | 'warn' = 'info', ms = 3400, ico?: string) {
    const iconName = ico ?? (kind === 'good' ? 'check' : kind === 'bad' ? 'alert' : kind === 'achievement' ? 'trophy' : kind === 'warn' ? 'alert' : 'info');
    const el = h('div', { class: ['toast', kind] }, icon(iconName, 18), h('span', null, text));
    this.toasts.prepend(el);
    while (this.toasts.children.length > 4) this.toasts.lastElementChild?.remove();
    setTimeout(() => {
      el.classList.add('leaving');
      setTimeout(() => el.remove(), 320);
    }, ms);
  }

  // ── Cinematic overlays ────────────────────────────────────────────────────

  banner(text: string, cls = '', ms = 1400) {
    this.overlay.querySelectorAll('.banner').forEach((b) => b.remove());
    const el = h('div', { class: ['banner', cls] }, h('div', { class: 'strip' }, h('span', null, text)));
    this.overlay.appendChild(el);
    if (ms > 0) setTimeout(() => el.remove(), ms);
    return el;
  }

  clearBanners() {
    this.overlay.querySelectorAll('.banner').forEach((b) => b.remove());
  }

  stamp(text: string, sub: string, cls = '', ms = 2200) {
    this.overlay.querySelectorAll('.stamp').forEach((b) => b.remove());
    const el = h('div', { class: ['stamp', cls] }, text, h('small', null, sub));
    this.overlay.appendChild(el);
    if (ms > 0) setTimeout(() => el.remove(), ms);
    return el;
  }

  jackpot(title: string, line: string, name: string, ms = 4200) {
    const el = h('div', { class: 'jackpot' }, h('div', { class: 'inner' }, h('h2', null, title), h('p', null, line), h('div', { class: 'name' }, name)));
    this.overlay.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  // ── Speech bubbles anchored to 3D points ─────────────────────────────────

  bubble(key: string, anchor: () => THREE.Vector3 | null, text: string, who: string, cls = '', ms = 2600) {
    this.bubbles.get(key)?.el.remove();
    const el = h('div', { class: ['bubble', cls] }, who ? h('span', { class: 'who' }, who) : null, text);
    this.world.appendChild(el);
    this.bubbles.set(key, { el, anchor, until: performance.now() + ms });
  }

  clearBubbles() {
    for (const b of this.bubbles.values()) b.el.remove();
    this.bubbles.clear();
  }

  updateWorld(camera: THREE.Camera) {
    const now = performance.now();
    const w = window.innerWidth;
    const hgt = window.innerHeight;
    for (const [key, b] of this.bubbles) {
      if (now > b.until) {
        b.el.classList.add('fade');
        if (now > b.until + 400) {
          b.el.remove();
          this.bubbles.delete(key);
        }
      }
      const p = b.anchor();
      if (!p) { b.el.style.display = 'none'; continue; }
      const v = p.clone().project(camera);
      if (v.z > 1 || v.z < -1) { b.el.style.display = 'none'; continue; }
      b.el.style.display = '';
      const x = Math.max(90, Math.min(w - 90, (v.x * 0.5 + 0.5) * w));
      const y = Math.max(60, (-v.y * 0.5 + 0.5) * hgt);
      b.el.style.left = `${x}px`;
      b.el.style.top = `${y}px`;
    }
  }

  // ── Modals ─────────────────────────────────────────────────────────────────

  modal(opts: ModalOptions): () => void {
    const actions = (opts.actions ?? [{ label: t('Close'), kind: 'ghost' as const, onClick: () => true }]).map((a) =>
      h('button', {
        class: ['btn', a.kind ?? ''],
        disabled: a.disabled,
        onClick: () => {
          const keep = a.onClick();
          if (keep !== false) close();
        },
      }, a.icon ? icon(a.icon, 16) : null, a.label),
    );
    const panel = h('div', { class: ['panel', 'bracketed', 'modal', opts.wide ? 'wide' : ''], role: 'dialog' },
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' }, h('h2', { class: 'panel-title' }, opts.title), opts.sub ? h('div', { class: 'panel-sub' }, opts.sub) : null),
        opts.dismissable === false ? null : h('button', { class: 'icon-btn', ariaLabel: t('Close'), onClick: () => close() }, icon('x', 18)),
      ),
      h('div', { class: 'panel-body scroll' }, opts.body),
      actions.length ? h('div', { class: 'modal-foot' }, actions) : null,
    );
    const wrap = h('div', { class: 'modal-wrap interactive' }, panel);
    wrap.addEventListener('pointerdown', (e) => {
      if (e.target === wrap && opts.dismissable !== false) close();
    });
    this.modals.appendChild(wrap);
    const entry = { el: wrap, opts };
    this.modalStack.push(entry);
    const first = panel.querySelector<HTMLElement>('.modal-foot .btn.primary, .modal-foot .btn');
    first?.focus();
    const close = () => this.closeModal(wrap);
    return close;
  }

  private closeModal(el: HTMLElement) {
    const i = this.modalStack.findIndex((m) => m.el === el);
    if (i < 0) return;
    const [m] = this.modalStack.splice(i, 1);
    m.el.remove();
    m.opts.onClose?.();
  }

  closeAllModals() {
    for (const m of [...this.modalStack]) this.closeModal(m.el);
  }

  confirm(title: string, text: string, ok = t('Confirm'), cancel = t('Cancel'), danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;
      this.modal({
        title,
        body: h('p', { class: 'note' }, text),
        actions: [
          { label: cancel, kind: 'ghost', onClick: () => { answered = true; resolve(false); } },
          { label: ok, kind: danger ? 'danger' : 'primary', onClick: () => { answered = true; resolve(true); } },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });
  }
}
