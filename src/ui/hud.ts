import { money, t } from '../core/i18n';
import type { Game } from '../systems/game';
import { countTo, h } from './dom';
import { weekday } from './common';
import { FACILITY_MAP } from '../data/facilities';

/** Persistent top bar: day, facility, cash, net worth, level. */
export class Hud {
  readonly el: HTMLElement;
  private moneyEl: HTMLElement;
  private netEl: HTMLElement;
  private dayEl: HTMLElement;
  private subEl: HTMLElement;
  private lvlBadge: HTMLElement;
  private lvlName: HTMLElement;
  private xpBar: HTMLElement;

  constructor(private readonly game: Game, onLevel: () => void, onMenu: () => void) {
    this.moneyEl = h('span', { class: 'value num' });
    this.netEl = h('span', { class: 'value small num' });
    this.dayEl = h('b');
    this.subEl = h('span');
    this.lvlBadge = h('span', { class: 'lvl-badge' });
    this.lvlName = h('b');
    this.xpBar = h('i');
    this.el = h('div', { class: 'hud-top' },
      h('div', { class: 'panel hud-brand interactive', role: 'button', tabIndex: 0, title: t('Main menu'), onClick: onMenu, style: { cursor: 'pointer' } },
        h('span', { class: 'mark' }, 'SH'),
        h('div', { class: 'hud-day' }, this.dayEl, this.subEl),
      ),
      h('div', { class: 'hud-spacer' }),
      h('div', { class: 'panel hud-money' },
        h('div', { class: 'hud-stat' }, h('span', { class: 'label' }, t('Your money')), this.moneyEl),
        h('div', { class: 'hud-stat net' }, h('span', { class: 'label' }, t('Net worth')), this.netEl),
      ),
      h('div', { class: 'panel hud-level interactive', role: 'button', tabIndex: 0, title: t('Progress'), onClick: onLevel, style: { cursor: 'pointer' } },
        this.lvlBadge,
        h('div', { class: 'lvl-text' }, this.lvlName, h('div', { class: 'meter segmented' }, this.xpBar)),
      ),
    );
    this.refresh(true);
    game.bus.on('money:changed', ({ delta }) => {
      this.refresh();
      this.moneyEl.classList.remove('flash-gain', 'flash-loss');
      void this.moneyEl.offsetWidth;
      this.moneyEl.classList.add(delta >= 0 ? 'flash-gain' : 'flash-loss');
    });
    game.bus.on('xp:gained', () => this.refresh());
    game.bus.on('day:started', () => this.refresh());
  }

  refresh(instant = false) {
    const st = this.game.state;
    countTo(this.moneyEl, st.money, (v) => money(v), instant ? 0 : 650);
    this.netEl.textContent = money(this.game.economy.netWorth());
    this.dayEl.textContent = `${t('Day {n}', { n: st.day })} · ${weekday(st.day)}`;
    this.subEl.textContent = t(FACILITY_MAP[st.facilityId].name);
    const p = this.game.progression.progress();
    this.lvlBadge.textContent = String(p.level);
    this.lvlName.textContent = t(this.game.progression.levelName(p.level));
    this.xpBar.style.width = `${Math.round(p.frac * 100)}%`;
  }
}
