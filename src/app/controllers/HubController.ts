import { money, t } from '../../core/i18n';
import type { UnitData } from '../../core/types';
import { FACILITY_MAP } from '../../data/facilities';
import { NPC_MAP } from '../../data/npcs';
import { EVENT_INFO } from '../../data/units';
import { h } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { eventChip, weekday } from '../../ui/common';
import type { App, Controller } from '../App';
import { newsModal } from '../screens/modals';

/** Today's lineup at the facility: pick when to head out, or skip the day. */
export class HubController implements Controller {
  readonly name = 'hub';

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    const game = app.game;
    app.setHudVisible(true);
    const today = game.auctions.ensureToday();
    const fs = app.facility;
    fs.setMood('golden');
    fs.buildRow(today.lots);
    const lot = game.auctions.currentLot() ?? today.lots[today.lots.length - 1];
    fs.focusLot(lot);
    fs.openDoor(0, 0.01);
    fs.flashlight.intensity = 0;
    fs.ensureFigures(today.attendees);
    fs.placeCrowd(today.attendees, true);
    for (const f of fs.figures.values()) f.root.visible = today.started;
    app.showFacility();
    const shot = fs.establishingShot();
    fs.rig.set(shot.pos, shot.look, 50);
    fs.rig.driftAmount = 0.35;
    app.audio.music('menu');
    app.audio.ambience('outdoor');
    this.render();
    if (!game.state.flags.introSeen) {
      game.state.flags.introSeen = true;
      this.intro();
    }
  }

  private intro() {
    this.app.ui.modal({
      title: t('Welcome to Lucky Lock'),
      sub: t('How storage hunting works'),
      body: h('div', { class: 'col' },
        h('p', { class: 'note' }, t('Every day a few storage units whose renters stopped paying go up for auction. You get 30 seconds to look inside from the doorway. You cannot step in and you cannot open anything.')),
        h('p', { class: 'note' }, t('Then the bidding starts. Rival hunters bid against you, each with their own taste, budget and tricks. Win a unit and everything inside is yours: open the boxes, check the drawers, load your van.')),
        h('p', { class: 'note' }, t('Back at your garage, inspect what you found, clean it, repair it, call an expert, spot the fakes, and sell it for more than you paid.')),
        h('p', { class: 'note' }, t('You start with $2,000 and a rusty van. Do not spend it all on the first unit.')),
      ),
      actions: [{ label: t('Let\'s go'), kind: 'primary', onClick: () => true }],
    });
  }

  private lotCard(unit: UnitData, index: number) {
    const game = this.app.game;
    const today = game.state.today!;
    const res = today.results.find((r) => r.unitId === unit.id);
    const current = !res && index === today.index;
    let result: HTMLElement | null = null;
    if (res) {
      const who = res.winner === 'player' ? t('You') : res.winner ? t(NPC_MAP[res.winner].nickname) : t('No sale');
      result = h('div', { class: 'lot-result' }, h('div', { class: res.winner === 'player' ? 'pos' : 'dim' }, who), res.winner ? h('div', { class: 'num' }, money(res.price)) : null);
    } else if (current) {
      result = h('span', { class: 'chip solid' }, t('Next'));
    }
    return h('div', { class: ['lot-card', res ? 'done' : '', current ? 'current' : ''] },
      h('div', { class: 'lot-door' }, unit.number),
      h('div', { class: 'lot-meta' },
        h('div', { class: 'row wrap' }, h('b', null, t('{size} unit', { size: unit.size.replace('x', '×') })), eventChip(unit.event)),
        h('div', { class: 'line' }, t('Tenant: {name} · {months} months unpaid', { name: unit.tenant, months: unit.monthsUnpaid })),
        unit.event ? h('div', { class: 'line faint' }, t(EVENT_INFO[unit.event].text)) : null,
        unit.rumor ? h('div', { class: 'rumor' }, h('q', null, t(unit.rumor))) : null,
      ),
      result,
    );
  }

  private render() {
    const { app } = this;
    const game = app.game;
    const today = game.auctions.ensureToday();
    const facility = FACILITY_MAP[today.facilityId];
    const over = game.auctions.isDayOver();
    const searching = game.search.active;
    const actions: HTMLElement[] = [];
    if (searching) {
      actions.push(h('button', { class: 'btn primary block', onClick: () => app.route('search') }, icon('box', 18), t('Continue clearing unit {n}', { n: game.search.unit!.number })));
    } else if (!over) {
      const next = game.auctions.currentLot()!;
      actions.push(h('button', {
        class: 'btn primary block',
        onClick: () => {
          app.audio.play('click');
          game.auctions.begin();
          app.route('auction');
        },
      }, icon('gavel', 18), today.started ? t('Go to unit {n}', { n: next.number }) : t('Head to the auction ({cost} fuel)', { cost: money(facility.travelCost) })));
    } else {
      actions.push(h('button', { class: 'btn primary block', onClick: () => app.route('summary') }, icon('chart', 18), t('Review the day')));
    }
    const secondary = h('div', { class: 'grid-2' },
      h('button', { class: 'btn', onClick: () => app.route('garage') }, icon('garage', 16), t('Garage')),
      h('button', { class: 'btn', onClick: () => app.route('market') }, icon('store', 16), t('Market')),
      !today.started && !searching
        ? h('button', { class: 'btn', onClick: () => this.skipDay() }, icon('skip', 16), t('Skip today'))
        : h('button', { class: 'btn', disabled: searching, onClick: () => this.leave() }, icon('left', 16), t('Leave early')),
      h('button', { class: 'btn', onClick: () => newsModal(app) }, icon('bell', 16), t('News'), game.state.news.length ? h('span', { class: 'chip' }, String(Math.min(99, game.state.news.filter((n) => n.day >= game.state.day - 1).length))) : null),
    );
    const panel = h('div', { class: 'panel bracketed hub-panel' },
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, `${weekday(game.state.day)} · ${t('Day {n}', { n: game.state.day })}`),
          h('h2', { class: 'panel-title' }, t(facility.name)),
          h('div', { class: 'panel-sub' }, t('{n} units up for auction today', { n: today.lots.length })),
        ),
      ),
      h('div', { class: 'lot-list scroll' }, today.lots.map((u, i) => this.lotCard(u, i))),
      h('div', { class: 'panel-body col', style: { borderTop: '1px solid var(--line)' } },
        game.canDayJob() && game.inventory.owned().length === 0 && !today.started
          ? h('button', { class: 'btn block', onClick: () => this.dayJob() }, icon('hammer', 16), t('Work a shift at the hardware store (+{pay})', { pay: money(140) }))
          : null,
        actions,
        secondary,
      ),
    );
    app.ui.setScreen(h('div', { class: 'screen' }, panel));
  }

  private async skipDay() {
    const ok = await this.app.ui.confirm(t('Skip today?'), t('The day passes without you. Listings and consignments keep running.'), t('Skip day'));
    if (!ok) return;
    this.app.game.auctions.leave();
    this.app.game.advanceDay();
    this.app.route('hub');
  }

  private async leave() {
    const ok = await this.app.ui.confirm(t('Leave the facility?'), t('The remaining units get auctioned without you.'), t('Leave'));
    if (!ok) return;
    this.app.game.auctions.leave();
    this.app.route('summary');
  }

  private dayJob() {
    this.app.game.dayJob();
    this.app.ui.toast(t('You worked a shift and earned {pay}.', { pay: money(140) }), 'good');
    this.app.route('hub');
  }

  exit() {
    this.app.facility.rig.driftAmount = 0;
  }

  update(dt: number) {
    this.app.facility.update(dt);
  }
}
