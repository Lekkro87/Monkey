import { CONFIG, RARITY_ORDER } from '../../core/config';
import { money, N_, num, pct, t } from '../../core/i18n';
import type { Rarity } from '../../core/types';
import { ITEM_LIST, RARITY_NAMES } from '../../data/items';
import { ACHIEVEMENTS, LEVEL_NAMES, LEVEL_UNLOCKS, QUESTS } from '../../data/progression';
import { Thumbs } from '../../render/thumbnails';
import { rarityChip } from '../../ui/common';
import { h, replace } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App, Controller } from '../App';

type Tab = 'career' | 'stats' | 'achievements' | 'journal';

/** Level, statistics, achievements and the story journal. */
export class ProgressController implements Controller {
  readonly name = 'progress';
  private tab: Tab = 'career';
  private panel = h('div', { class: 'panel bracketed hub-panel', style: { width: 'min(620px, 100%)' } });

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    app.setHudVisible(true);
    app.garage.applyCosmetics(app.game.state.garage);
    app.showGarage();
    app.garage.view('display', 0.9);
    app.audio.ambience('garage');
    app.audio.music('garage');
    app.ui.setScreen(h('div', { class: 'screen' }, this.panel));
    this.render();
  }

  private render() {
    const tabBtn = (id: Tab, label: string) => h('button', { class: ['tab', this.tab === id ? 'active' : ''], onClick: () => { this.tab = id; this.render(); } }, t(label));
    const body = h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } });
    replace(body, this.tab === 'career' ? this.career() : this.tab === 'stats' ? this.stats() : this.tab === 'achievements' ? this.achievements() : this.journal());
    replace(this.panel,
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' }, h('div', { class: 'grow' }, h('div', { class: 'eyebrow' }, t('Your career')), h('h2', { class: 'panel-title' }, t('Progress')))),
      h('div', { class: 'tabs' }, tabBtn('career', N_('Career')), tabBtn('stats', N_('Statistics')), tabBtn('achievements', N_('Achievements')), tabBtn('journal', N_('Journal'))),
      body,
      h('div', { class: 'panel-body grid-2', style: { borderTop: '1px solid var(--line)' } },
        h('button', { class: 'btn', onClick: () => this.app.route('garage') }, icon('garage', 16), t('Garage')),
        h('button', { class: 'btn primary', onClick: () => this.app.route(this.app.game.search.active ? 'search' : 'hub') }, icon('van', 16), t('Drive to Lucky Lock')),
      ),
    );
  }

  private career() {
    const game = this.app.game;
    const p = game.progression.progress();
    return h('div', { class: 'panel-body col' },
      h('div', { class: 'row' },
        h('span', { class: 'lvl-badge', style: { width: '56px', height: '56px', fontSize: '28px' } }, String(p.level)),
        h('div', { class: 'grow col', style: { gap: '6px' } },
          h('b', { style: { font: '800 24px/1 var(--font-display)', textTransform: 'uppercase' } }, t(LEVEL_NAMES[p.level - 1])),
          h('div', { class: 'meter segmented' }, h('i', { style: { width: `${Math.round(p.frac * 100)}%` } })),
          h('span', { class: 'faint num', style: { fontSize: '13px' } }, p.to ? t('{xp} / {to} XP to {next}', { xp: num(p.xp), to: num(p.to), next: t(LEVEL_NAMES[p.level]) }) : t('Maximum level reached')),
        ),
      ),
      h('dl', { class: 'kv' },
        h('dt', null, t('Cash')), h('dd', null, money(game.state.money)),
        h('dt', null, t('Net worth')), h('dd', null, money(game.economy.netWorth())),
        h('dt', null, t('Days in business')), h('dd', null, String(game.state.day)),
        h('dt', null, t('Goal')), h('dd', null, t('Build a storage empire worth {v}', { v: money(CONFIG.net.legendThreshold) })),
      ),
      h('span', { class: 'eyebrow' }, t('Levels & unlocks')),
      h('div', { class: 'action-list' }, LEVEL_NAMES.map((name, i) => {
        const lvl = i + 1;
        const reached = p.level >= lvl;
        const unlocks = LEVEL_UNLOCKS.filter((u) => u.level === lvl);
        return h('div', { class: ['action-row', reached ? '' : 'done'], style: { cursor: 'default', opacity: reached ? '1' : '0.55' } },
          h('span', { class: 'lvl-badge', style: { width: '26px', height: '26px', fontSize: '14px', background: reached ? 'var(--hazard)' : 'var(--steel-600)' } }, String(lvl)),
          h('div', null, h('b', null, t(name)), unlocks.length ? h('span', { style: { display: 'block' } }, unlocks.map((u) => t(u.text)).join(' · ')) : null),
          h('span', { class: 'cost num' }, num(CONFIG.levels[i]), ' XP'),
        );
      })),
    );
  }

  private stats() {
    const s = this.app.game.state.stats;
    const units = Object.values(this.app.game.state.units);
    const rois = units.map((u) => this.app.game.economy.unitPnL(u.id)).filter((p) => p.complete).map((p) => p.roi);
    const avgRoi = rois.length ? rois.reduce((a, b) => a + b, 0) / rois.length : 0;
    const row = (label: string, value: string) => [h('dt', null, t(label)), h('dd', null, value)];
    return h('div', { class: 'panel-body' }, h('dl', { class: 'kv' },
      row(N_('Units purchased'), String(s.unitsWon)),
      row(N_('Auctions lost'), String(s.unitsLost)),
      row(N_('Auctions attended'), String(s.auctionsAttended)),
      row(N_('Total spent at auctions'), money(s.totalSpent)),
      row(N_('Total earned'), money(s.totalEarned)),
      row('Total profit', money(s.totalEarned - s.totalSpent, { sign: true })),
      row(N_('Average ROI (closed units)'), rois.length ? pct(avgRoi) : '—'),
      row(N_('Best find'), s.bestFind ? `${t(s.bestFind.name)} (${money(s.bestFind.value)})` : '—'),
      row(N_('Best unit'), s.bestPurchase ? `${s.bestPurchase.unit} (${money(s.bestPurchase.profit, { sign: true })})` : '—'),
      row(N_('Worst unit'), s.worstPurchase ? `${s.worstPurchase.unit} (${money(s.worstPurchase.profit, { sign: true })})` : '—'),
      row(N_('Rarest item'), s.rarestItem ? `${t(s.rarestItem.name)} · ${t(RARITY_NAMES[s.rarestItem.rarity])}` : '—'),
      row(N_('Highest sale'), s.highestSale ? `${t(s.highestSale.name)} (${money(s.highestSale.value)})` : '—'),
      row(N_('Items discovered'), num(s.itemsDiscovered)),
      row(N_('Rare items found'), num(s.rareItemsFound)),
      row(N_('Fakes exposed'), num(s.fakesFound)),
      row(N_('Secret compartments'), num(s.secretsFound)),
      row(N_('Items sold'), num(s.itemsSold)),
      row(N_('Items repaired'), num(s.itemsRepaired)),
      row(N_('Items cleaned'), num(s.itemsCleaned)),
      row(N_('Profitable units'), num(s.unitsProfitable)),
      row(N_('Losing units'), num(s.unitsLosing)),
      row(N_('Won on the final call'), num(s.finalCallWins)),
      row(N_('Times you beat the Shark'), num(s.sharkBeaten)),
    ));
  }

  private achievements() {
    const game = this.app.game;
    return h('div', { class: 'panel-body' }, h('div', { class: 'ach-grid' }, ACHIEVEMENTS.map((a) => {
      const day = game.state.achievements[a.id];
      const unlocked = day !== undefined;
      const prog = game.progression.achievementProgress(a.id);
      const secret = a.hidden && !unlocked;
      return h('div', { class: ['ach', unlocked ? 'unlocked' : 'locked'] },
        h('span', { class: 'medal' }, icon(unlocked ? 'trophy' : secret ? 'question' : 'lock', 18)),
        h('div', null,
          h('b', null, secret ? '???' : t(a.name)),
          h('span', null, secret ? t('A secret achievement.') : t(a.description)),
          unlocked ? h('span', { style: { display: 'block', color: 'var(--hazard)' } }, t('Unlocked on day {d}', { d: day })) : null,
          !unlocked && prog ? h('div', { class: 'meter', style: { marginTop: '6px' } }, h('i', { style: { width: `${Math.min(100, (prog.value / prog.goal) * 100)}%` } })) : null,
        ),
      );
    })));
  }

  private journal() {
    const game = this.app.game;
    const entries = QUESTS.map((q) => {
      const st = game.quests.get(q.id);
      if (!st) return h('div', { class: 'channel' }, h('h4', null, icon('lock', 16), '???'), h('p', { class: 'note' }, t('Some stories hide in storage units. Keep hunting.')));
      const stages = q.stages.slice(0, st.stage + 1);
      return h('div', { class: 'channel' },
        h('h4', null, icon('book', 16), t(q.name), st.resolved ? h('span', { class: 'chip solid' }, t('Resolved')) : null),
        stages.map((s) => h('div', null, h('b', null, t(s.title)), h('p', { class: 'note', style: { margin: '2px 0 8px' } }, t(s.text)))),
        h('span', { class: 'faint', style: { fontSize: '12px' } }, t('Clues found: {n} of {m}', { n: st.found.length, m: q.items.length })),
        game.quests.canResolve(q.id) ? h('button', { class: 'btn primary', onClick: () => this.app.route('garage') }, t('Decide in your garage')) : null,
      );
    });
    return h('div', { class: 'panel-body col' }, entries);
  }

  exit() { /* nothing */ }

  update(dt: number) {
    this.app.garage.update(dt);
  }
}

/** The collection book: every item type, found or not yet found. */
export class CollectionController implements Controller {
  readonly name = 'collection';
  private panel = h('div', { class: 'panel bracketed hub-panel', style: { width: 'min(680px, 100%)' } });
  private filter: Rarity | 'all' = 'all';

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    app.setHudVisible(true);
    app.garage.applyCosmetics(app.game.state.garage);
    app.showGarage();
    app.garage.view('display', 0.9);
    app.audio.ambience('garage');
    app.audio.music('garage');
    app.ui.setScreen(h('div', { class: 'screen' }, this.panel));
    this.render();
  }

  private render() {
    const game = this.app.game;
    const defs = ITEM_LIST.filter((d) => d.category !== 'trash' && d.category !== 'container' && d.id !== 'cash')
      .sort((a, b) => RARITY_ORDER[b.rarity] - RARITY_ORDER[a.rarity] || a.baseValue - b.baseValue);
    const found = defs.filter((d) => game.state.discovered[d.id]);
    const shown = this.filter === 'all' ? defs : defs.filter((d) => d.rarity === this.filter);
    const filterSel = h('select', { class: 'select', id: 'col-filter', onChange: (e) => { this.filter = (e.target as HTMLSelectElement).value as Rarity | 'all'; this.render(); } },
      (['all', 'common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'] as const).map((r) => {
        const o = h('option', { value: r }, r === 'all' ? t('All rarities') : t(RARITY_NAMES[r]));
        if (r === this.filter) o.selected = true;
        return o;
      }));
    replace(this.panel,
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, t('The collection book')),
          h('h2', { class: 'panel-title' }, t('Collection')),
          h('div', { class: 'panel-sub' }, t('{n} of {m} item types discovered', { n: found.length, m: defs.length })),
        ),
      ),
      h('div', { class: 'toolbar' }, filterSel, h('div', { class: 'meter grow' }, h('i', { style: { width: `${(found.length / defs.length) * 100}%` } }))),
      h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } },
        h('div', { class: 'item-grid' }, shown.map((d) => {
          const rec = game.state.discovered[d.id];
          const img = document.createElement('img');
          img.alt = '';
          img.src = Thumbs.forDef(d.id);
          if (!rec) img.style.filter = 'brightness(0) opacity(0.55)';
          return h('div', { class: ['item-card', `r-${d.rarity}`], style: { cursor: 'default' } },
            h('div', { class: 'thumb' }, img),
            h('div', { class: ['name', rec ? '' : 'unknown'] }, rec ? t(d.name) : '???'),
            h('div', { class: 'row between' }, rarityChip(d.rarity), rec ? h('span', { class: 'value' }, `×${rec.count}`) : null),
            rec && rec.best ? h('span', { class: 'faint', style: { fontSize: '12px' } }, t('Best: {v}', { v: money(rec.best) })) : null,
          );
        })),
      ),
      h('div', { class: 'panel-body grid-2', style: { borderTop: '1px solid var(--line)' } },
        h('button', { class: 'btn', onClick: () => this.app.route('garage') }, icon('garage', 16), t('Garage')),
        h('button', { class: 'btn primary', onClick: () => this.app.route(game.search.active ? 'search' : 'hub') }, icon('van', 16), t('Drive to Lucky Lock')),
      ),
    );
  }

  exit() { /* nothing */ }

  update(dt: number) {
    this.app.garage.update(dt);
  }
}
