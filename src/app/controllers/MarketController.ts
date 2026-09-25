import { CONFIG } from '../../core/config';
import { money, moneyRange, N_, pct, t } from '../../core/i18n';
import type { ItemInstance, SaleChannel, TrendTag } from '../../core/types';
import { itemDef } from '../../data/items';
import { AUCTION_HOUSE, BUYER_TYPES, COLLECTORS, ONLINE, PAWN } from '../../data/people';
import { RARITY_NAMES } from '../../data/items';
import { TREND_NAMES, TREND_TAGS } from '../../data/progression';
import { BLUEPRINT_MAP } from '../../data/units';
import { CONDITION_NAMES } from '../../core/config';
import { accept, counter, suggestedCounters, walkAway, type Negotiation } from '../../systems/negotiation';
import { estimateMid, roundNice } from '../../systems/items';
import { avatar, itemName, profitClass, thumb, valueText } from '../../ui/common';
import { h, replace } from '../../ui/dom';
import { icon } from '../../ui/icons';
import { sparkline } from '../../ui/sparkline';
import type { App, Controller } from '../App';
import { itemHeader } from '../screens/itemPanel';

type Tab = 'sell' | 'offers' | 'listings' | 'trends' | 'reports';

const SELLABLE = ['garage', 'display', 'listed'];

/** Every way to turn stock into cash, plus market intelligence and unit reports. */
export class MarketController implements Controller {
  readonly name = 'market';
  private tab: Tab = 'sell';
  private selected: string | null;
  private panel = h('div', { class: 'panel bracketed hub-panel', style: { width: 'min(620px, 100%)' } });
  private onlinePrice: Record<string, number> = {};
  private reserve: Record<string, number> = {};

  constructor(private readonly app: App, item: string | null = null, tab: Tab = 'sell') {
    this.selected = item;
    this.tab = tab;
  }

  enter() {
    const { app } = this;
    app.setHudVisible(true);
    const g = app.garage;
    g.applyCosmetics(app.game.state.garage);
    app.showGarage();
    g.view('desk', 0.9);
    app.audio.ambience('garage');
    app.audio.music('garage');
    app.ui.setScreen(h('div', { class: 'screen' }, this.panel));
    this.render();
  }

  private sellable(): ItemInstance[] {
    return this.app.game.inventory.sort(this.app.game.inventory.all().filter((i) => SELLABLE.includes(i.location)), 'value');
  }

  private setTab(tab: Tab) {
    this.tab = tab;
    this.render();
  }

  private render() {
    const game = this.app.game;
    const m = game.state.market;
    const tabBtn = (id: Tab, label: string, count?: number) => h('button', { class: ['tab', this.tab === id ? 'active' : ''], onClick: () => this.setTab(id) }, t(label), count ? h('span', { class: 'count' }, String(count)) : null);
    const body = h('div', { class: 'scroll', style: { flex: '1', minHeight: '0' } });
    switch (this.tab) {
      case 'sell': replace(body, this.selected && game.state.items[this.selected] && SELLABLE.concat(['consigned']).includes(game.state.items[this.selected].location) ? this.renderItem(game.state.items[this.selected]) : this.renderSellList()); break;
      case 'offers': replace(body, this.renderOffers()); break;
      case 'listings': replace(body, this.renderListings()); break;
      case 'trends': replace(body, this.renderTrends()); break;
      case 'reports': replace(body, this.renderReports()); break;
    }
    replace(this.panel,
      h('div', { class: 'hazard-strip' }),
      h('div', { class: 'panel-head' },
        h('div', { class: 'grow' },
          h('div', { class: 'eyebrow' }, t('Buy low, sell high')),
          h('h2', { class: 'panel-title' }, t('Market')),
        ),
      ),
      h('div', { class: 'tabs' },
        tabBtn('sell', N_('Sell')),
        tabBtn('offers', N_('Offers'), m.offers.length),
        tabBtn('listings', N_('Listings'), m.listings.length + m.consignments.length),
        tabBtn('trends', N_('Trends')),
        tabBtn('reports', N_('Unit reports')),
      ),
      body,
      h('div', { class: 'panel-body grid-2', style: { borderTop: '1px solid var(--line)' } },
        h('button', { class: 'btn', onClick: () => this.app.route('garage') }, icon('garage', 16), t('Garage')),
        h('button', { class: 'btn primary', onClick: () => this.app.route(game.search.active ? 'search' : 'hub') }, icon('van', 16), t('Drive to Lucky Lock')),
      ),
    );
  }

  // ── Sell ───────────────────────────────────────────────────────────────────

  private renderSellList() {
    const game = this.app.game;
    const items = this.sellable();
    if (!items.length) return h('div', { class: 'panel-body' }, h('p', { class: 'note' }, t('Nothing to sell yet. Items in your garage show up here.')));
    return h('div', { class: 'panel-body col', style: { gap: '6px' } },
      h('p', { class: 'note' }, t('Pick an item to see what every buyer would pay.')),
      items.map((it) => h('button', { class: 'sell-row', onClick: () => { this.selected = it.uid; this.render(); } },
        thumb(it),
        h('div', null, h('b', null, itemName(it)), h('span', null, valueText(it, game.state.market))),
        it.location === 'listed' ? h('span', { class: 'chip', style: { color: 'var(--cool)' } }, t('Listed')) : icon('right', 16),
      )),
    );
  }

  private renderItem(inst: ItemInstance) {
    const game = this.app.game;
    const market = game.market;
    const m = game.state.market;
    const def = itemDef(inst.defId);
    const consigned = inst.location === 'consigned';
    const cards: HTMLElement[] = [];

    // Pawn shop.
    const pawn = market.pawnOffer(inst);
    cards.push(h('div', { class: 'channel' },
      h('h4', null, icon('cash', 18), t(PAWN.name)),
      h('div', { class: 'blurb' }, t('Instant cash, low price. Gus checks everything himself: no fakes slip past him.')),
      h('div', { class: 'row between' },
        h('span', { class: 'offer' }, pawn > 0 ? money(pawn) : t('No offer')),
        h('div', { class: 'row' },
          h('button', { class: 'btn small', disabled: pawn <= 0 || consigned, onClick: () => this.haggleGus(inst) }, icon('hand', 14), t('Haggle')),
          h('button', { class: 'btn small primary', disabled: pawn <= 0 || consigned, onClick: () => this.sold(market.sellPawn(inst.uid), inst, 'pawn') }, t('Sell now')),
        ),
      ),
    ));

    // SwapBay.
    const listing = m.listings.find((l) => l.itemUid === inst.uid);
    const suggested = market.suggestedPrice(inst);
    const price = this.onlinePrice[inst.uid] ?? listing?.price ?? suggested;
    const readout = h('div', { class: 'faint', style: { fontSize: '13px' } });
    const priceOut = h('span', { class: 'offer' }, money(price));
    const update = (p: number) => {
      this.onlinePrice[inst.uid] = p;
      priceOut.textContent = money(p);
      const fee = Math.round(p * CONFIG.market.onlineFee);
      readout.textContent = t('Fee {fee} · you get {net} · sells in about {d} days', { fee: money(fee), net: money(p - fee), d: market.expectedDays(inst, p) });
    };
    update(price);
    const maxP = Math.max(20, roundNice(suggested * 3));
    cards.push(h('div', { class: 'channel' },
      h('h4', null, icon('phone', 18), t(ONLINE.name)),
      h('div', { class: 'blurb' }, listing
        ? t('Listed on day {d} · {v} views · {w} watchers', { d: listing.listedDay, v: listing.views, w: listing.watchers })
        : t('Set your price. Cheaper sells faster. 10% fee, $2 to list.')),
      h('div', { class: 'row' }, priceOut, h('input', {
        type: 'range', id: `price-${inst.uid}`, class: 'grow', min: Math.max(1, roundNice(suggested * 0.3)), max: maxP, step: Math.max(1, roundNice(suggested / 50)), value: price,
        onInput: (e) => update(Number((e.target as HTMLInputElement).value)),
      })),
      readout,
      h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
        listing ? h('button', { class: 'btn small danger', onClick: () => { market.delist(inst.uid); this.app.ui.toast(t('Listing removed.'), 'info'); this.render(); } }, t('Take down')) : null,
        h('button', { class: 'btn small primary', disabled: consigned, onClick: () => this.list(inst) }, listing ? t('Update price') : t('List it')),
      ),
    ));

    // Auction house.
    const [aLo, aHi] = market.auctionEstimate(inst);
    const eligible = market.auctionHouseEligible(inst);
    const consignment = m.consignments.find((c) => c.itemUid === inst.uid);
    const reserve = this.reserve[inst.uid] ?? 0;
    const reserveOut = h('b', { class: 'num' }, reserve ? money(reserve) : t('No reserve'));
    cards.push(h('div', { class: 'channel' },
      h('h4', null, icon('gavel', 18), t(AUCTION_HOUSE.name)),
      h('div', { class: 'blurb' }, consignment
        ? t('Goes under the hammer on day {d}.', { d: consignment.saleDay })
        : t('Big upside for rare pieces, but results swing. 15% commission. Unverified pieces are authenticated for $75.')),
      consignment ? null : h('div', { class: 'row between' }, h('span', null, t('Estimate')), h('b', { class: 'num' }, moneyRange(aLo, aHi))),
      consignment || !eligible.ok ? null : h('div', { class: 'row' }, h('span', { class: 'faint' }, t('Reserve')), h('input', {
        type: 'range', id: `reserve-${inst.uid}`, class: 'grow', min: 0, max: aHi, step: Math.max(5, roundNice(aHi / 40)), value: reserve,
        onInput: (e) => {
          const v = Number((e.target as HTMLInputElement).value);
          this.reserve[inst.uid] = v;
          reserveOut.textContent = v ? money(v) : t('No reserve');
        },
      }), reserveOut),
      !eligible.ok ? h('div', { class: 'faint', style: { fontSize: '13px', color: 'var(--orange)' } }, t(eligible.reason ?? '')) : null,
      consignment ? null : h('div', { class: 'row', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn small primary', disabled: !eligible.ok, onClick: () => this.consign(inst) }, t('Consign')),
      ),
    ));

    // Collectors.
    const reqs = m.requests.filter((r) => market.requestMatches(r, inst).ok || (r.tag && def.tags.includes(r.tag)));
    if (reqs.length) {
      cards.push(h('div', { class: 'channel' },
        h('h4', null, icon('star', 18), t('Collectors')),
        reqs.map((r) => {
          const ok = market.requestMatches(r, inst);
          return h('div', { class: 'row between' },
            h('div', null, h('b', null, r.collector), h('div', { class: 'faint', style: { fontSize: '12px' } }, ok.ok ? t('Pays {p} of market value', { p: pct(r.premium, 0) }) : t(ok.reason ?? ''))),
            h('button', { class: 'btn small primary', disabled: !ok.ok || consigned, onClick: () => this.sold(market.fulfillRequest(r.id, inst.uid), inst, 'collector') }, ok.ok ? money(market.requestPayout(r, inst)) : t('Not yet')),
          );
        }),
      ));
    }

    // Private offers on this item.
    const offers = m.offers.filter((o) => o.itemUid === inst.uid);
    for (const o of offers) {
      cards.push(h('div', { class: 'channel' },
        h('h4', null, icon('user', 18), t('{buyer} wants it', { buyer: o.buyer })),
        h('div', { class: 'row between' }, h('span', { class: 'offer' }, money(o.offer)), h('button', { class: 'btn small primary', onClick: () => this.negotiate(o.id) }, t('Negotiate'))),
      ));
    }

    return h('div', { class: 'panel-body col' },
      h('button', { class: 'btn ghost small', style: { alignSelf: 'flex-start' }, onClick: () => { this.selected = null; this.render(); } }, icon('left', 14), t('All items')),
      itemHeader(this.app, inst),
      consigned ? h('p', { class: 'note' }, t('This item is at the auction house.')) : null,
      cards,
    );
  }

  private sold(res: { ok: boolean; price: number; fee: number; profit: number; reason?: string }, inst: ItemInstance, _channel: SaleChannel) {
    if (!res.ok) {
      this.app.audio.play('error');
      this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad');
      return;
    }
    this.app.ui.toast(t('Sold {name} for {price} ({profit} profit)', { name: itemName(inst), price: money(res.price - res.fee), profit: money(res.profit, { sign: true }) }), res.profit >= 0 ? 'good' : 'bad', 4200, 'cash');
    this.selected = null;
    this.render();
  }

  private list(inst: ItemInstance) {
    const price = this.onlinePrice[inst.uid] ?? this.app.game.market.suggestedPrice(inst);
    if (!this.app.game.market.listOnline(inst.uid, price)) {
      this.app.audio.play('error');
      this.app.ui.toast(t('Could not list the item.'), 'bad');
      return;
    }
    this.app.audio.play('notify');
    this.app.ui.toast(t('Listed on SwapBay for {price}. Buyers show up as days pass.', { price: money(price) }), 'good', 3600, 'phone');
    this.render();
  }

  private consign(inst: ItemInstance) {
    const res = this.app.game.market.consign(inst.uid, this.reserve[inst.uid] ?? 0);
    if (!res.ok) {
      this.app.audio.play('error');
      this.app.ui.toast(t(res.reason ?? 'Not possible.'), 'bad', 4200);
      this.render();
      return;
    }
    this.app.audio.play('gavel', 0.6);
    this.app.ui.toast(t('Consigned to Hollister & Crane. Sale in {d} days.', { d: CONFIG.market.auctionHouseDays }), 'good', 3600, 'gavel');
    this.selected = null;
    this.render();
  }

  // ── Negotiation ────────────────────────────────────────────────────────────

  private haggleGus(inst: ItemInstance) {
    const n = this.app.game.market.pawnNegotiation(inst.uid, this.app.game.rng);
    if (n) this.negotiationModal(n, 'pawn', inst);
  }

  private negotiate(offerId: string) {
    const game = this.app.game;
    const n = game.market.offerNegotiation(offerId, game.rng);
    if (!n) return;
    this.negotiationModal(n, 'private', game.state.items[n.offer.itemUid]);
  }

  private negotiationModal(n: Negotiation, channel: SaleChannel, inst: ItemInstance) {
    const app = this.app;
    const rng = app.game.rng;
    const type = BUYER_TYPES[n.offer.personality];
    const body = h('div');
    let customInput: HTMLInputElement;
    const personaHint: Record<string, string> = {
      lowballer: N_('Starts low and expects you to push back.'), fair: N_('Makes reasonable offers.'), enthusiast: N_('Really wants this.'),
      impatient: N_('Has no time for games.'), hardball: N_('A tough negotiator.'),
    };
    const draw = () => {
      const line = t(n.line, { offer: money(Number(n.lineParams.offer ?? n.current)) });
      const counters = suggestedCounters(n);
      customInput = h('input', { type: 'number', class: 'input', id: 'nego-custom', min: 1, value: counters[1], style: { width: '120px' } }) as HTMLInputElement;
      const moodOn = Math.max(0, n.patience);
      replace(body,
        h('div', { class: 'nego' },
          h('div', { class: 'col', style: { alignItems: 'center' } },
            h('div', { class: 'nego-face', style: { background: channel === 'pawn' ? '#c9a45c' : '#7fb0cc' } }, n.offer.buyer.split(' ').map((p) => p[0]).join('').slice(0, 2)),
            h('b', null, n.offer.buyer),
            h('span', { class: 'faint', style: { fontSize: '12px', textAlign: 'center' } }, t(personaHint[type.id])),
            h('div', { class: ['mood-meter', moodOn <= 1 ? 'low' : ''], title: t('Patience') }, [0, 1, 2, 3, 4].map((i) => h('i', { class: i < moodOn ? 'on' : '' }))),
          ),
          h('div', { class: 'col' },
            h('div', { class: 'row' }, thumb(inst), h('b', null, itemName(inst))),
            h('div', { class: 'nego-line' }, line),
            h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, t('Current offer')), h('span', { class: 'offer num', style: { font: '800 30px/1 var(--font-ui)' } }, money(n.current))),
            n.outcome === 'open' ? h('div', { class: 'col', style: { gap: '6px' } },
              h('div', { class: 'row wrap' }, counters.map((c) => h('button', { class: 'btn small', onClick: () => { counter(n, c, rng); after(); } }, t('Counter {amount}', { amount: money(c) })))),
              h('div', { class: 'row' }, customInput, h('button', { class: 'btn small', onClick: () => { counter(n, Number(customInput.value) || n.current, rng); after(); } }, t('Counter'))),
            ) : h('p', { class: ['note', n.outcome === 'accepted' ? 'pos' : 'neg'] }, n.outcome === 'accepted' ? t('Deal at {amount}!', { amount: money(n.price) }) : t('The buyer walked away.')),
          ),
        ),
      );
    };
    const finish = () => {
      const res = app.game.market.closeNegotiation(n, channel);
      if (res && res.ok) {
        const gain = n.price / Math.max(1, n.start) - 1;
        app.ui.toast(t('Sold {name} for {price}{extra}', { name: itemName(inst), price: money(res.price), extra: gain > 0.01 ? ` (${t('+{p} over the first offer', { p: pct(gain, 0) })})` : '' }), 'good', 4200, 'cash');
      }
      this.selected = null;
      this.render();
    };
    const after = () => {
      app.audio.play(n.outcome === 'accepted' ? 'cash' : n.outcome === 'left' ? 'fail' : 'click');
      draw();
      if (n.outcome !== 'open') {
        setTimeout(() => { close(); finish(); }, 1200);
      }
    };
    draw();
    const close = app.ui.modal({
      title: channel === 'pawn' ? t(PAWN.name) : t('Private buyer'),
      body,
      wide: true,
      actions: [
        { label: t('Walk away'), kind: 'ghost', onClick: () => { walkAway(n, rng); if (n.outcome === 'open') { app.audio.play('notify'); draw(); return false; } finish(); return true; } },
        { label: t('Accept'), kind: 'primary', onClick: () => { accept(n); app.audio.play('cash'); finish(); return true; } },
      ],
      onClose: () => { if (n.outcome === 'open' && channel !== 'pawn') { /* offer stays open */ } },
    });
  }

  // ── Other tabs ─────────────────────────────────────────────────────────────

  private renderOffers() {
    const game = this.app.game;
    const offers = game.state.market.offers;
    if (!offers.length) return h('div', { class: 'panel-body' }, h('p', { class: 'note' }, t('No offers right now. Buyers call about items in your garage as the days pass.')));
    return h('div', { class: 'panel-body col', style: { gap: '8px' } }, offers.map((o) => {
      const it = game.state.items[o.itemUid];
      if (!it) return null;
      return h('div', { class: 'sell-row', style: { cursor: 'default' } },
        thumb(it),
        h('div', null, h('b', null, t('{buyer} offers {amount}', { buyer: o.buyer, amount: money(o.offer) })), h('span', null, `${itemName(it)} · ${t('expires day {d}', { d: o.expires })}`)),
        h('button', { class: 'btn small primary', onClick: () => this.negotiate(o.id) }, t('Negotiate')),
      );
    }));
  }

  private renderListings() {
    const game = this.app.game;
    const m = game.state.market;
    const rows: HTMLElement[] = [];
    for (const l of m.listings) {
      const it = game.state.items[l.itemUid];
      if (!it) continue;
      rows.push(h('button', { class: 'sell-row', onClick: () => { this.selected = it.uid; this.setTab('sell'); } },
        thumb(it),
        h('div', null, h('b', null, itemName(it)), h('span', null, t('SwapBay · {price} · {v} views · since day {d}', { price: money(l.price), v: l.views, d: l.listedDay }))),
        icon('phone', 16)));
    }
    for (const c of m.consignments) {
      const it = game.state.items[c.itemUid];
      if (!it) continue;
      rows.push(h('div', { class: 'sell-row', style: { cursor: 'default' } },
        thumb(it),
        h('div', null, h('b', null, itemName(it)), h('span', null, t('Hollister & Crane · sale on day {d}{reserve}', { d: c.saleDay, reserve: c.reserve ? ` · ${t('reserve {r}', { r: money(c.reserve) })}` : '' }))),
        icon('gavel', 16)));
    }
    return h('div', { class: 'panel-body col', style: { gap: '8px' } }, rows.length ? rows : h('p', { class: 'note' }, t('Nothing listed. List items on SwapBay or consign them to the auction house from the Sell tab.')));
  }

  private renderTrends() {
    const game = this.app.game;
    const m = game.state.market;
    const all = TREND_TAGS.flatMap((tag) => m.history[tag] ?? []);
    const domain: [number, number] = [Math.min(0.8, ...all) - 0.05, Math.max(1.25, ...all) + 0.05];
    const len = Math.max(1, ...TREND_TAGS.map((tag) => (m.history[tag] ?? []).length));
    const startDay = Math.max(1, game.state.day - len + 1);
    const sorted = [...TREND_TAGS].sort((a, b) => game.market.trend(b) - game.market.trend(a));
    const row = (tag: TrendTag) => {
      const v = game.market.trend(tag);
      const p = Math.round((v - 1) * 100);
      const ev = m.events.find((e) => e.tag === tag);
      return h('div', { class: 'trend-row' },
        h('div', null, h('b', null, t(TREND_NAMES[tag])), ev ? h('div', { class: 'faint', style: { fontSize: '12px' } }, `${ev.mult > 1 ? t('Boom') : t('Slump')} · ${t('until day {d}', { d: ev.until })}`) : null),
        sparkline(m.history[tag] ?? [v], { domain, baseline: 1, startDay }),
        h('span', { class: ['pct', p > 2 ? 'pos' : p < -2 ? 'neg' : 'dim'] }, p > 2 ? icon('up', 14) : p < -2 ? icon('down', 14) : null, `${p > 0 ? '+' : ''}${p}%`),
      );
    };
    const requests = m.requests;
    return h('div', { class: 'panel-body col' },
      m.events.length ? h('div', { class: 'col', style: { gap: '6px' } }, h('span', { class: 'eyebrow' }, t('Headlines')), m.events.map((e) => h('div', { class: 'row', style: { alignItems: 'flex-start' } }, icon(e.mult > 1 ? 'flame' : 'down', 16), h('span', { class: 'note' }, t(e.headline))))) : null,
      h('span', { class: 'eyebrow' }, t('Prices vs normal, last {n} days', { n: len })),
      h('div', null, sorted.map(row)),
      h('span', { class: 'eyebrow' }, t('Collector requests')),
      game.level() < 3
        ? h('p', { class: 'note' }, t('Collectors start calling once you reach level 3.'))
        : requests.length === 0 ? h('p', { class: 'note' }, t('No open requests.'))
          : requests.map((r) => h('div', { class: 'row', style: { padding: '6px 0', borderBottom: '1px solid var(--line)' } },
            avatar(r.collector, '#c9a45c'),
            h('div', { class: 'grow' },
              h('b', null, r.collector),
              h('div', { class: 'faint', style: { fontSize: '12px' } }, t('Wants {what}: {rarity}+ in {cond}+ condition. Pays {p}. Until day {d}.', {
                what: r.tag ? t(TREND_NAMES[r.tag]) : '—', rarity: t(RARITY_NAMES[r.minRarity]), cond: t(CONDITION_NAMES[r.minCondition]), p: pct(r.premium, 0), d: r.expires,
              })),
              h('div', { class: 'faint', style: { fontSize: '12px' } }, t(COLLECTORS.find((c) => c.name === r.collector)?.blurb ?? '')),
            ),
          )),
    );
  }

  private renderReports() {
    const game = this.app.game;
    const units = Object.values(game.state.units).sort((a, b) => b.day - a.day);
    if (!units.length) return h('div', { class: 'panel-body' }, h('p', { class: 'note' }, t('Win a unit to see its profit report here.')));
    return h('div', { class: 'panel-body col', style: { gap: '8px' } }, units.map((u) => {
      const p = game.economy.unitPnL(u.id);
      return h('button', { class: 'sell-row', style: { gridTemplateColumns: '64px 1fr auto' }, onClick: () => this.reportModal(u.id) },
        h('div', { class: 'lot-door', style: { height: '44px', fontSize: '15px' } }, u.number),
        h('div', null, h('b', null, t(BLUEPRINT_MAP[u.blueprintId].name)), h('span', null, `${t('Day {n}', { n: u.day })} · ${p.complete ? t('closed') : t('{s} of {n} items sold', { s: p.sold, n: p.total })}`)),
        h('div', { style: { textAlign: 'right' } }, h('b', { class: ['num', profitClass(p.profit)] }, money(p.profit, { sign: true })), h('span', { class: 'num', style: { display: 'block' } }, `ROI ${pct(p.roi)}`)),
      );
    }));
  }

  private reportModal(unitId: string) {
    const game = this.app.game;
    const u = game.state.units[unitId];
    const p = game.economy.unitPnL(unitId);
    const line = (label: string, v: number) => h('tr', null, h('td', null, t(label)), h('td', { class: profitClass(v) }, money(v, { sign: v > 0 })));
    this.app.ui.modal({
      title: t('Unit #{n}', { n: u.number }),
      sub: `${t(BLUEPRINT_MAP[u.blueprintId].name)} · ${t('Day {n}', { n: u.day })}`,
      body: h('div', { class: 'col' },
        h('table', { class: 'ledger' },
          line(N_('Purchase'), p.purchase),
          line(N_('Transportation'), p.transport),
          line(N_('Dumpster'), p.disposal),
          line(N_('Cleaning'), p.cleaning),
          line(N_('Repair'), p.repair),
          line(N_('Experts & services'), p.experts),
          line(N_('Fees'), p.fees),
          p.other ? line(N_('Other'), p.other) : null,
          line(N_('Sales'), p.sales),
          h('tr', { class: 'total' }, h('td', null, t('Total profit')), h('td', { class: profitClass(p.profit) }, money(p.profit, { sign: true }))),
        ),
        h('div', { class: 'row between' }, h('span', { class: 'eyebrow' }, 'ROI'), h('span', { class: ['big-profit', profitClass(p.profit)] }, pct(p.roi))),
        !p.complete ? h('p', { class: 'note' }, t('{n} items still unsold, estimated at {v}.', { n: p.total - p.sold, v: money(p.unsoldEstimate) })) : null,
        h('p', { class: 'faint', style: { fontSize: '12px' } }, t('The real value inside was {v}.', { v: money(u.trueValue) })),
      ),
    });
    void estimateMid;
  }

  exit() { /* nothing */ }

  update(dt: number) {
    this.app.garage.update(dt);
  }
}
