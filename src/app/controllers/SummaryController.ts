import * as THREE from 'three';
import { money, t } from '../../core/i18n';
import { NPC_MAP } from '../../data/npcs';
import { BLUEPRINT_MAP } from '../../data/units';
import { itemDef } from '../../data/items';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { eventChip, profitClass } from '../../ui/common';
import type { App, Controller } from '../App';

/**
 * End of the auction day: every unit's hidden truth is revealed.
 * Learning what you passed on (and what the Shark overpaid for) is the lesson.
 */
export class SummaryController implements Controller {
  readonly name = 'summary';

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    const game = app.game;
    if (game.search.active) { app.route('search'); return; }
    game.auctions.leave();
    app.setHudVisible(true);
    const fs = app.facility;
    fs.setMood('dusk');
    fs.openDoor(0, 0.8);
    app.showFacility();
    fs.rig.goTo(new THREE.Vector3(fs.lotX + 8, 4.5, -11), new THREE.Vector3(fs.lotX - 2, 1, 0), 2.5, 50);
    fs.rig.driftAmount = 0.3;
    app.audio.music('summary');
    app.audio.ambience('outdoor');
    app.audio.crowd(0);
    for (const [id, f] of fs.figures) if (id !== 'auctioneer') f.walkTo(new THREE.Vector3(f.root.position.x + 2, 0, -9.5), 0);
    this.render();
  }

  private render() {
    const { app } = this;
    const game = app.game;
    const rows = game.auctions.summary();
    const won = rows.filter((r) => r.result.winner === 'player');
    const spent = won.reduce((s, r) => s + r.result.price, 0);
    const list = rows.map(({ unit, result, margin }) => {
      const who = result.winner === 'player' ? t('You') : result.winner ? t(NPC_MAP[result.winner].nickname) : t('No sale');
      const bp = BLUEPRINT_MAP[unit.blueprintId];
      const best = unit.hidden.bestItem ? itemDef(unit.hidden.bestItem) : null;
      return h('div', { class: ['lot-card', result.winner === 'player' ? 'current' : ''] },
        h('div', { class: 'lot-door' }, unit.number),
        h('div', { class: 'lot-meta' },
          h('div', { class: 'row wrap' }, h('b', null, t(bp.name)), eventChip(unit.event)),
          h('div', { class: 'line' }, result.winner ? t('{who} paid {price}', { who, price: money(result.price) }) : t('Nobody bid.')),
          h('div', { class: 'line faint' }, t('Real value inside: {value}', { value: money(unit.hidden.hiddenValue) }), best && best.baseValue > 100 ? ` · ${t('best piece: {name}', { name: t(best.name) })}` : ''),
        ),
        h('div', { class: 'lot-result' },
          result.winner ? h('div', { class: ['num', profitClass(margin)] }, money(margin, { sign: true })) : null,
          result.winner ? h('span', { class: 'faint', style: { fontSize: '11px' } }, t('value − price')) : null,
        ),
      );
    });
    const panel = h('div', { class: 'panel bracketed hub-panel' },
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, t('Day {n} is over', { n: game.state.day })),
          h('h2', { class: 'panel-title' }, t('What was inside')),
          h('div', { class: 'panel-sub' }, won.length ? t('You won {n} units for {amount}', { n: won.length, amount: money(spent) }) : t('You went home empty-handed today')),
        ),
      ),
      h('div', { class: 'lot-list scroll' }, list.length ? list : h('p', { class: 'note' }, t('You skipped the auctions today.'))),
      h('div', { class: 'panel-body col', style: { borderTop: '1px solid var(--line)' } },
        h('p', { class: 'note' }, t('The real values are only revealed now. Compare them with what you saw at the doorway: that is how you learn to read a unit.')),
        h('div', { class: 'grid-2' },
          h('button', { class: 'btn', onClick: () => app.route('garage') }, icon('garage', 16), t('Garage')),
          h('button', { class: 'btn primary', onClick: () => this.nextDay() }, icon('sun', 16), t('Next day')),
        ),
      ),
    );
    app.ui.setScreen(h('div', { class: 'screen' }, panel));
  }

  private nextDay() {
    const rep = this.app.game.advanceDay();
    const sold = rep.market.sold;
    if (sold.length) this.app.ui.toast(t('{n} of your items sold overnight.', { n: sold.length }), 'good', 4000, 'cash');
    if (rep.bills) this.app.ui.toast(t('Weekly bills paid: {amount}.', { amount: money(rep.bills) }), 'warn', 4000);
    this.app.route('hub');
  }

  exit() {
    this.app.facility.rig.driftAmount = 0;
  }

  update(dt: number) {
    this.app.facility.update(dt);
  }
}
