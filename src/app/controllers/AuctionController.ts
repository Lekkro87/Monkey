import * as THREE from 'three';
import { CONFIG, incrementFor } from '../../core/config';
import { RNG } from '../../core/rng';
import { money, N_, t } from '../../core/i18n';
import type { NpcId, UnitData } from '../../core/types';
import { FAMILIES, itemDef } from '../../data/items';
import { AUCTIONEER, NPC_MAP } from '../../data/npcs';
import { EVENT_INFO } from '../../data/units';
import type { AuctionEvent, AuctionRun } from '../../systems/auction';
import { bark, inspectionBark, type Bidder } from '../../systems/npc';
import { avatar, eventChip } from '../../ui/common';
import { h, replace } from '../../ui/dom';
import { icon } from '../../ui/icons';
import type { App, Controller } from '../App';
import { glance, pickTarget } from '../glance';

type Phase = 'arrive' | 'inspect' | 'bidding' | 'sold' | 'result';

const MAX_LEAN = 0.45;

/**
 * One lot: the crowd gathers, the lock is cut, the door rolls up part-way,
 * 30 seconds of flashlight inspection, then live bidding until SOLD.
 */
export class AuctionController implements Controller {
  readonly name = 'auction';
  private phase: Phase = 'arrive';
  private unit!: UnitData;
  private preview: Bidder[] = [];
  private run: AuctionRun | null = null;
  private stare: Record<string, number> = {};
  private timer = 0;
  private phaseT = 0;
  private yaw = 0;
  private pitch = -0.18;
  private lean = 0;
  private crouch = false;
  private eyeY = 1.62;
  private flash = true;
  private insideView = true;
  private rng = new RNG(Date.now());
  private raycaster = new THREE.Raycaster();
  private barkQueue: { at: number; id: NpcId }[] = [];
  private autoOpen = false;
  private speed = 1;
  private lookShift = new THREE.Vector3();
  private lookShiftT = 0;
  private soldAt = 0;
  private lastTick = -1;
  private staredWarned = false;
  // HUD nodes
  private hoverEl = h('div', { class: 'hover-label hidden' });
  private hudRoot = h('div');
  private timerEl = h('div');
  private tickerEl = h('div', { class: 'panel ticker' });
  private dockEl = h('div');
  private biddersEl = h('div', { class: 'bidders' });
  private resultEl = h('div');

  constructor(private readonly app: App) {}

  enter() {
    const { app } = this;
    const game = app.game;
    const unit = game.auctions.currentLot();
    if (!unit) { app.route('summary'); return; }
    this.unit = unit;
    const today = game.state.today!;
    const fs = app.facility;
    app.setHudVisible(false);
    fs.setMood('golden');
    if (!fs.lotSlot(unit.id)) fs.buildRow(today.lots);
    fs.focusLot(unit);
    fs.openDoor(0, 0.01);
    fs.flashlight.intensity = 0;
    fs.ensureFigures(today.attendees);
    const first = today.index === 0 || !today.results.length;
    for (const f of fs.figures.values()) f.root.visible = true;
    if (first) {
      // Everyone arrives from the parking lane.
      [...fs.figures.values()].forEach((f, i) => {
        f.root.position.set(fs.lotX - 6 + i * 2.2 + this.rng.range(-0.5, 0.5), 0, -9.2 + this.rng.range(-0.4, 0.4));
        f.out = false;
      });
    }
    fs.placeCrowd(today.attendees, false);
    app.showFacility();
    const shot = fs.crowdShot();
    fs.rig.goTo(shot.pos, shot.look, 2.2, 45);
    app.audio.music(null);
    app.audio.ambience('outdoor');
    app.audio.crowd(0.4);
    this.preview = game.auctions.bidders(unit);
    this.phase = 'arrive';
    this.phaseT = 0;
    this.buildHud();
  }

  // ── HUD ────────────────────────────────────────────────────────────────────

  private buildHud() {
    const u = this.unit;
    const lotBanner = h('div', { class: 'panel bracketed lot-banner' },
      h('span', { class: 'unitno' }, u.number),
      h('div', { class: 'info' },
        h('div', { class: 'row wrap' }, h('b', { class: 'num' }, t('{size} unit', { size: u.size.replace('x', '×') })), eventChip(u.event)),
        h('span', { class: 'faint', style: { fontSize: '13px' } }, t('Tenant: {name} · {months} months unpaid', { name: u.tenant, months: u.monthsUnpaid })),
      ),
      h('div', { class: 'grow' }),
      h('div', { class: 'hud-stat', style: { textAlign: 'right' } }, h('span', { class: 'label' }, t('Your money')), h('span', { class: 'value num', id: 'auction-money' }, money(this.app.game.state.money))),
    );
    replace(this.hudRoot,
      h('div', { class: 'auction-top' }, lotBanner, this.timerEl, this.tickerEl),
      this.hoverEl,
      this.dockEl,
      this.biddersEl,
      this.resultEl,
    );
    this.app.ui.setScreen(this.hudRoot);
    this.ticker(t('The crowd gathers at unit {n}…', { n: u.number }), t(AUCTIONEER.name));
  }

  private ticker(text: string, who?: string) {
    replace(this.tickerEl, who ? h('span', { class: 'who' }, who) : null, text);
  }

  private say(line: string, params: Record<string, string | number> = {}) {
    const text = t(line, params);
    this.ticker(text, t(AUCTIONEER.name));
    this.app.audio.speak(text.replace(/\$/g, ''));
    this.app.facility.figures.get('auctioneer')?.talk(1.4);
  }

  private renderInspectHud() {
    const left = Math.max(0, Math.ceil(this.timer));
    replace(this.timerEl,
      h('div', { class: ['panel', 'timer', left <= 8 ? 'low' : ''] },
        icon('flashlight', 20),
        h('span', { class: 'eyebrow' }, t('Inspection')),
        h('div', { class: 'meter' }, h('i', { style: { width: `${(this.timer / CONFIG.inspection.seconds) * 100}%` } })),
        h('span', { class: 'count' }, `${left}s`),
      ),
    );
  }

  private hintsEl() {
    const touch = this.app.input.touch;
    return h('div', { class: 'hints' },
      h('span', null, icon('hand', 14), touch ? t('Drag to look') : t('Drag to look around')),
      touch ? null : h('span', null, h('span', { class: 'kbd' }, 'A'), h('span', { class: 'kbd' }, 'D'), t('Lean')),
      touch ? null : h('span', null, h('span', { class: 'kbd' }, 'C'), t('Crouch')),
      touch ? null : h('span', null, h('span', { class: 'kbd' }, 'F'), t('Flashlight')),
    );
  }

  private renderInspectDock() {
    replace(this.dockEl,
      h('div', { class: 'crosshair' }),
      this.app.settings.hints ? this.hintsEl() : null,
      h('div', { class: 'bid-dock panel', style: { gridTemplateColumns: '1fr auto' } },
        h('div', { class: 'col', style: { gap: '4px' } },
          h('span', { class: 'eyebrow' }, t('Look closely')),
          h('span', { class: 'note' }, this.unit.event ? t(EVENT_INFO[this.unit.event].text) : t('What is valuable? What is junk? What might be hiding behind that box?')),
        ),
        h('div', { class: 'bid-actions' },
          h('button', { class: 'btn', onClick: () => this.toggleCrouch() }, icon('down', 16), t('Crouch')),
          h('button', { class: 'btn primary', onClick: () => this.endInspection() }, t('Start bidding'), h('span', { class: 'kbd' }, '↵')),
        ),
      ),
    );
  }

  private renderBidders() {
    const run = this.run;
    const rows = this.app.game.state.today!.attendees.map((id) => {
      const npc = NPC_MAP[id];
      const b = run?.bidders.find((x) => x.id === id);
      const lead = run?.leader === id;
      const out = b?.dropped && b.outAt === null;
      return h('div', { class: ['bidder', lead ? 'lead' : '', out ? 'out' : ''] },
        avatar(t(npc.nickname).replace(/^(The|Der|Die|Das) /, ''), npc.look.shirt),
        h('div', null, h('b', null, t(npc.nickname)), h('span', null, out ? t('Out') : lead ? t('High bid') : t('In'))),
        h('span', { class: 'paddle num' }, `#${npc.paddle}`),
      );
    });
    const you = h('div', { class: ['bidder', 'you', run?.leader === 'player' ? 'lead' : '', run?.passed ? 'out' : ''] },
      avatar(t('You'), '#f5b300'),
      h('div', null, h('b', null, t('You')), h('span', null, run?.passed ? t('Passed') : run?.leader === 'player' ? t('High bid') : t('In'))),
      h('span', { class: 'paddle num' }, '#99'),
    );
    replace(this.biddersEl, rows, you);
  }

  private renderDock() {
    const run = this.run;
    if (!run) return;
    const game = this.app.game;
    const canBid = run.canPlayerBid();
    const leaderName = run.leader === 'player' ? t('You') : run.leader ? t(NPC_MAP[run.leader].nickname) : '—';
    const c = CONFIG.auction.calls;
    const phaseLabel = run.phase === 'opening' ? t('Opening') : run.phase === 'once' ? t('Going once') : run.phase === 'twice' ? t('Going twice') : run.phase === 'final' ? t('Final call') : run.phase === 'sold' ? t('Sold') : t('Bidding');
    const hot = run.phase === 'twice' || run.phase === 'final';
    const bidLabel = !canBid.ok && canBid.reason === 'funds' ? t('Not enough money') : run.leader === 'player' ? t('You lead') : t('Bid');
    const autoBtn = run.auto !== null
      ? h('button', { class: 'btn', onClick: () => { run.setAuto(null); this.renderDock(); } }, icon('x', 16), t('Auto ≤ {max}', { max: money(run.auto) }))
      : h('button', { class: 'btn', disabled: run.passed || run.finished, onClick: () => { this.autoOpen = !this.autoOpen; this.renderDock(); } }, icon('bolt', 16), t('Auto bid'), h('span', { class: 'kbd' }, 'A'));
    const dock = h('div', { class: 'bid-dock panel bracketed' },
      h('div', { class: 'bid-figures' },
        h('div', { class: 'bid-fig' }, h('div', { class: 'label' }, t('Your money')), h('div', { class: 'value num' }, money(game.state.money))),
        h('div', { class: ['bid-fig', 'lead'] }, h('div', { class: 'label' }, t('Current bid')), h('div', { class: 'value num' }, run.current ? money(run.current) : '—'), h('div', { class: 'who' }, leaderName)),
        h('div', { class: 'bid-fig' }, h('div', { class: 'label' }, t('Next bid')), h('div', { class: 'value num' }, money(run.ask))),
      ),
      h('div', { class: 'bid-actions' },
        h('button', { class: 'btn primary bid', disabled: !canBid.ok, onClick: () => this.playerBid() }, h('span', null, bidLabel, h('br'), h('small', { class: 'num' }, money(run.ask))), h('span', { class: 'kbd' }, '␣')),
        h('div', { class: 'col', style: { gap: '6px' } },
          autoBtn,
          h('button', { class: 'btn danger', disabled: run.passed || run.finished, onClick: () => this.pass() }, icon('x', 16), t('Pass'), h('span', { class: 'kbd' }, 'P')),
        ),
      ),
      h('div', { class: ['call-bar', hot ? 'hot' : ''] },
        h('button', { class: 'btn ghost small', onClick: () => this.toggleView() }, icon('eye', 14), this.insideView ? t('Watch the crowd') : t('Look inside'), h('span', { class: 'kbd' }, 'V')),
        h('div', { class: 'meter' }, h('i', { id: 'call-progress', style: { width: `${Math.min(100, (run.since / c.sold) * 100)}%` } })),
        h('span', { class: 'phase' }, phaseLabel),
      ),
      this.autoOpen && run.auto === null ? this.autoPanel(run) : null,
    );
    replace(this.dockEl, this.insideView ? h('div', { class: 'crosshair' }) : null, dock);
  }

  private autoPanel(run: AuctionRun) {
    const money$ = this.app.game.state.money;
    const minV = run.ask;
    const maxV = Math.max(minV, Math.floor(money$ / incrementFor(money$)) * incrementFor(money$));
    let value = Math.min(maxV, Math.max(minV, Math.round((run.ask * 2) / incrementFor(run.ask * 2)) * incrementFor(run.ask * 2)));
    const out = h('b', { class: 'num', style: { minWidth: '90px', textAlign: 'right' } }, money(value));
    const slider = h('input', {
      type: 'range', min: minV, max: maxV, step: incrementFor(minV), value,
      id: 'auto-max',
      onInput: (e) => {
        value = Number((e.target as HTMLInputElement).value);
        out.textContent = money(value);
      },
    });
    return h('div', { class: 'auto-panel' },
      h('span', { class: 'eyebrow' }, t('Max')),
      slider,
      out,
      h('button', { class: 'btn primary small', onClick: () => { run.setAuto(value); this.autoOpen = false; this.renderDock(); this.app.audio.play('click'); } }, t('Set')),
    );
  }

  // ── Phase control ─────────────────────────────────────────────────────────

  private startInspection() {
    this.phase = 'inspect';
    this.phaseT = 0;
    this.timer = CONFIG.inspection.seconds;
    this.yaw = 0;
    this.pitch = -0.2;
    this.lean = 0;
    this.crouch = false;
    this.eyeY = 1.62;
    this.insideView = true;
    const fs = this.app.facility;
    const eye = fs.doorwayEye(0);
    fs.rig.goTo(eye, this.lookTarget(eye), 1.1, 62);
    fs.flashlight.intensity = this.flash ? 38 : 0;
    this.app.audio.ambience('unit');
    this.app.audio.crowd(0.25);
    this.app.audio.music('search');
    // Everybody gets one comment in, spread over the inspection.
    const ids = this.app.game.state.today!.attendees;
    this.barkQueue = ids.map((id, i) => ({ at: 3 + i * (22 / Math.max(1, ids.length)) + this.rng.range(0, 3), id }));
    this.renderInspectHud();
    this.renderInspectDock();
    this.ticker(t('You have 30 seconds. No touching, no stepping inside.'), t(AUCTIONEER.name));
  }

  private endInspection() {
    if (this.phase !== 'inspect') return;
    this.phase = 'bidding';
    this.phaseT = 0;
    this.hoverEl.classList.add('hidden');
    replace(this.timerEl);
    this.app.ui.banner(t('Bidding starts'), 'once', 1300);
    this.app.audio.play('gavel', 0.6);
    this.app.audio.ambience('outdoor');
    this.app.audio.crowd(0.7);
    this.app.audio.music('auction');
    this.app.audio.intensity = 0.2;
    this.run = this.app.game.auctions.startRun(this.unit, this.stare);
    this.insideView = false;
    this.setBiddingCamera(1.2);
    this.renderBidders();
    this.renderDock();
    this.handle(this.run.drain());
  }

  private setBiddingCamera(dur: number) {
    const fs = this.app.facility;
    if (this.insideView) {
      const eye = fs.doorwayEye(this.lean * -MAX_LEAN, this.crouch);
      fs.rig.goTo(eye, this.lookTarget(eye), dur, 62);
      fs.flashlight.intensity = this.flash ? 38 : 0;
    } else {
      const s = fs.crowdShot();
      fs.rig.goTo(s.pos, s.look, dur, 46);
      fs.flashlight.intensity = 0;
    }
  }

  private toggleView() {
    if (this.phase !== 'bidding') return;
    this.insideView = !this.insideView;
    this.setBiddingCamera(0.7);
    this.renderDock();
  }

  private toggleCrouch() {
    this.crouch = !this.crouch;
  }

  private playerBid() {
    const run = this.run;
    if (!run || this.phase !== 'bidding') return;
    const res = run.playerBid();
    if (!res.ok) {
      this.app.audio.play('error');
      if (res.reason === 'funds') this.app.ui.toast(t('Not enough money for that bid.'), 'bad', 2200);
      return;
    }
    this.handle(run.drain());
  }

  private pass() {
    const run = this.run;
    if (!run || run.passed) return;
    run.pass();
    this.speed = CONFIG.auction.fastForward;
    this.app.audio.play('click');
    this.ticker(t('You passed on this one.'));
    this.renderDock();
    this.renderBidders();
  }

  // ── Auction events ────────────────────────────────────────────────────────

  private npcName(id: NpcId) {
    return t(NPC_MAP[id].nickname);
  }

  private handle(events: AuctionEvent[]) {
    const fs = this.app.facility;
    const audio = this.app.audio;
    let dirty = false;
    for (const e of events) {
      switch (e.type) {
        case 'open':
          this.say(this.rng.pick(AUCTIONEER.lines.open), { unit: this.unit.number, amount: money(e.amount) });
          break;
        case 'drop':
          this.say(this.rng.pick(AUCTIONEER.lines.drop), { amount: money(e.amount) });
          dirty = true;
          break;
        case 'ask':
          if (this.rng.chance(0.75)) this.say(this.rng.pick(AUCTIONEER.lines.ask), { current: money(e.current), next: money(e.next) });
          dirty = true;
          break;
        case 'bid': {
          audio.play('bid', e.bidder === 'player' ? 1 : 0.7);
          this.app.ui.clearBanners();
          if (e.bidder !== 'player') {
            const f = fs.figures.get(e.bidder);
            f?.raisePaddle();
            if (f) {
              this.lookShift.copy(f.headWorld()).sub(this.app.facility.rig.look).multiplyScalar(0.25);
              this.lookShiftT = 1.1;
            }
            this.app.ui.bubble(`bid:${e.bidder}`, () => fs.figures.get(e.bidder as NpcId)?.headWorld() ?? null, money(e.amount), this.npcName(e.bidder), 'bid', 1500);
          } else {
            this.app.ui.toast(t('You bid {amount}', { amount: money(e.amount) }), 'info', 1200, 'gavel');
          }
          if (e.jump) audio.play('ooh', 0.7);
          this.app.audio.intensity = 0.25;
          dirty = true;
          break;
        }
        case 'call': {
          if (e.call === 'once') { this.app.ui.banner(t('Going once…'), 'once', 1300); this.say(AUCTIONEER.lines.once[0], { amount: money(e.amount) }); audio.intensity = 0.5; }
          if (e.call === 'twice') { this.app.ui.banner(t('Going twice…'), 'twice', 1300); this.say(AUCTIONEER.lines.twice[0]); audio.intensity = 0.75; }
          if (e.call === 'final') { this.app.ui.banner(t('FINAL CALL!'), 'final', 1500); this.say(AUCTIONEER.lines.final[0], { amount: money(e.amount) }); audio.play('riser'); audio.intensity = 1; }
          dirty = true;
          break;
        }
        case 'out': {
          const f = fs.figures.get(e.npc);
          if (f) f.out = true;
          dirty = true;
          break;
        }
        case 'bark': {
          const npc = NPC_MAP[e.npc];
          const line = bark(this.rng, npc, e.key);
          if (line) {
            const params: Record<string, string | number> = {};
            if (e.params?.amount !== undefined) params.amount = money(Number(e.params.amount));
            this.app.ui.bubble(`bark:${e.npc}`, () => fs.figures.get(e.npc)?.headWorld() ?? null, t(line, params), this.npcName(e.npc), '', 2400);
          }
          break;
        }
        case 'autoStop':
          this.app.ui.toast(e.reason === 'funds' ? t('Auto bid stopped: not enough money.') : t('Auto bid reached your limit.'), 'warn', 2400);
          dirty = true;
          break;
        case 'sold':
          this.onSold(e.winner, e.price);
          break;
        case 'nosale':
          this.say(AUCTIONEER.lines.nosale[0]);
          this.app.ui.banner(t('No sale'), 'once', 1800);
          this.phase = 'sold';
          this.soldAt = this.phaseT;
          break;
      }
    }
    if (dirty && this.phase === 'bidding') {
      this.renderDock();
      this.renderBidders();
    }
  }

  private onSold(winner: NpcId | 'player', price: number) {
    const fs = this.app.facility;
    const audio = this.app.audio;
    this.phase = 'sold';
    this.soldAt = this.phaseT;
    this.app.ui.clearBanners();
    audio.play('gavel');
    audio.intensity = 0;
    if (winner === 'player') {
      this.say(AUCTIONEER.lines.soldPlayer[0], { amount: money(price) });
      this.app.ui.stamp(t('SOLD!'), t('to you for {amount}', { amount: money(price) }), 'won', 2600);
      audio.play('cash', 0.6);
      audio.play('ooh', 0.6);
      for (const id of this.app.game.state.today!.attendees) {
        if (this.rng.chance(0.35)) {
          const line = bark(this.rng, NPC_MAP[id], 'player_wins');
          if (line) this.app.ui.bubble(`bark:${id}`, () => fs.figures.get(id)?.headWorld() ?? null, t(line), this.npcName(id), '', 2600);
        }
      }
    } else {
      const who = this.npcName(winner);
      this.say(AUCTIONEER.lines.sold[0], { winner: who, amount: money(price) });
      this.app.ui.stamp(t('SOLD!'), t('to {who} for {amount}', { who, amount: money(price) }), '', 2600);
      const npc = NPC_MAP[winner];
      const bluffStuck = npc.bluff > 0.5 || (npc.id === 'rookie' && this.unit.hidden.hiddenValue < price * 0.5);
      const line = bark(this.rng, npc, bluffStuck && npc.barks.stuck ? 'stuck' : 'win');
      if (line) this.app.ui.bubble(`bark:${winner}`, () => fs.figures.get(winner)?.headWorld() ?? null, t(line), this.npcName(winner), '', 2800);
      const f = fs.figures.get(winner);
      if (f) {
        const head = f.headWorld();
        const dir = head.clone().sub(fs.camera.position).setY(0).normalize();
        fs.rig.goTo(head.clone().sub(dir.multiplyScalar(2.2)).setY(1.75), head.clone().setY(1.5), 1.2, 38);
      }
    }
    this.renderDock();
    this.renderBidders();
  }

  private showResult() {
    this.phase = 'result';
    const game = this.app.game;
    const run = this.run;
    const res = run ? game.auctions.settle(run, this.unit) : game.auctions.skip(this.unit);
    if (res.winner === 'player') {
      this.transitionToSearch();
      return;
    }
    const who = res.winner ? this.npcName(res.winner) : null;
    const next = () => {
      const lot = game.auctions.nextLot();
      if (lot) this.app.route('auction');
      else this.app.route('summary');
    };
    replace(this.dockEl, h('div', { class: 'bid-dock panel bracketed' },
      h('div', { class: 'col', style: { gap: '4px' } },
        h('span', { class: 'eyebrow' }, t('Unit {n}', { n: this.unit.number })),
        h('b', { style: { font: '700 22px/1.2 var(--font-ui)' } }, who ? t('Sold to {who} for {amount}', { who, amount: money(res.price) }) : t('Nobody bid. The unit goes back to the office.')),
        h('span', { class: 'faint' }, t('What was inside gets revealed at the end of the day.')),
      ),
      h('div', { class: 'bid-actions' },
        h('button', { class: 'btn primary', onClick: next }, game.auctions.currentLot() && game.state.today!.index < game.state.today!.lots.length - 1 ? t('Next unit') : t('End of auctions'), icon('right', 16)),
      ),
    ));
    replace(this.biddersEl);
    this.ticker(t('On to the next one.'), t(AUCTIONEER.name));
  }

  private transitionToSearch() {
    const fs = this.app.facility;
    this.app.game.progression.checkThresholds();
    // The crowd heads back to their cars; the door goes all the way up.
    [...fs.figures.entries()].forEach(([id, f], i) => {
      if (id === 'auctioneer') return;
      f.out = false;
      f.walkTo(new THREE.Vector3(fs.lotX - 7 + i * 2.5, 0, -9.4), 0);
    });
    this.app.audio.play('door_roll');
    fs.openDoor(1, 1.6);
    const eye = fs.doorwayEye(0);
    fs.rig.goTo(eye, new THREE.Vector3(fs.lotX, 1.0, 2), 1.6, 62);
    replace(this.dockEl);
    replace(this.biddersEl);
    this.ticker(t('Unit {n} is yours. Everything inside belongs to you now.', { n: this.unit.number }), t(AUCTIONEER.name));
    setTimeout(() => {
      if (this.app.controller === this) this.app.route('search');
    }, 1900);
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  private lookTarget(eye: THREE.Vector3): THREE.Vector3 {
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    return eye.clone().add(dir.multiplyScalar(3));
  }

  private updateLook(dt: number) {
    const input = this.app.input;
    const fs = this.app.facility;
    const sens = 0.0042 * this.app.settings.sensitivity;
    if (input.dragging || (input.down && !this.app.input.touch)) {
      this.yaw += input.dx * sens;
      this.pitch += (this.app.settings.invertY ? 1 : -1) * input.dy * sens;
    }
    this.yaw = THREE.MathUtils.clamp(this.yaw, -1.05, 1.05);
    this.pitch = THREE.MathUtils.clamp(this.pitch, -0.8, 0.45);
    let leanTarget = 0;
    if (input.isDown('KeyA') || input.isDown('ArrowLeft')) leanTarget = -1;
    if (input.isDown('KeyD') || input.isDown('ArrowRight')) leanTarget = 1;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 6);
    if (input.pressedKey('KeyC') || input.pressedKey('ControlLeft')) this.toggleCrouch();
    if (input.pressedKey('KeyF')) {
      this.flash = !this.flash;
      this.app.audio.play('click');
    }
    this.eyeY += ((this.crouch ? 1.05 : 1.62) - this.eyeY) * Math.min(1, dt * 7);
    if (!fs.rig.moving) {
      const eye = fs.doorwayEye(-this.lean * MAX_LEAN, false);
      eye.y = this.eyeY;
      fs.camera.position.copy(eye);
      fs.rig.look.copy(this.lookTarget(eye));
    }
    fs.flashlight.intensity += ((this.flash ? 38 : 0) - fs.flashlight.intensity) * Math.min(1, dt * 12);
  }

  private updateHover(dt: number) {
    const fs = this.app.facility;
    const input = this.app.input;
    const usePointer = input.onCanvas && !input.touch && !input.down;
    const ndc = usePointer ? input.ndc() : { x: 0, y: 0 };
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), fs.camera);
    this.raycaster.far = 12;
    const hits = this.raycaster.intersectObjects(fs.unitRoot.children, true);
    const hit = hits.map((x) => ({ tgt: pickTarget(x.object), point: x.point })).find((x) => x.tgt);
    // Stare tracking always uses the screen centre, like the rivals watching your eyes.
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), fs.camera);
    const centre = this.raycaster.intersectObjects(fs.unitRoot.children, true).map((x) => pickTarget(x.object)).find(Boolean);
    if (centre?.uid && this.phase === 'inspect') {
      this.stare[centre.uid] = (this.stare[centre.uid] ?? 0) + dt;
      if (!this.staredWarned && this.stare[centre.uid] > 5) {
        this.staredWarned = true;
        const watcher = this.preview.filter((b) => b.profile.observant >= 0.5).sort((a, b) => b.profile.observant - a.profile.observant)[0];
        if (watcher) {
          const line = bark(this.rng, watcher.profile, 'watching_player');
          if (line) this.app.ui.bubble(`bark:${watcher.id}`, () => fs.figures.get(watcher.id)?.headWorld() ?? null, t(line), this.npcName(watcher.id), '', 2600);
        }
      }
    }
    if (!hit?.tgt) {
      this.hoverEl.classList.add('hidden');
      return;
    }
    let title = '';
    let marker: string | undefined;
    let sub: string | undefined;
    if (hit.tgt.tarp !== undefined) {
      title = t('Tarp');
      sub = t('Something bulky underneath');
    } else if (hit.tgt.uid) {
      const p = this.unit.items.find((x) => x.inst.uid === hit.tgt!.uid);
      if (!p) return;
      ({ title, marker, sub } = glance(p));
    }
    replace(this.hoverEl, title, marker ? h('span', { class: 'marker' }, ` ${marker}`) : null, sub ? h('span', { class: 'sub' }, sub) : null);
    const px = usePointer ? input.x : window.innerWidth / 2;
    const py = usePointer ? input.y : window.innerHeight / 2;
    this.hoverEl.style.left = `${px}px`;
    this.hoverEl.style.top = `${py}px`;
    this.hoverEl.classList.remove('hidden');
  }

  private npcInspectionChatter() {
    const fs = this.app.facility;
    const elapsed = CONFIG.inspection.seconds - this.timer;
    while (this.barkQueue.length && this.barkQueue[0].at <= elapsed) {
      const { id } = this.barkQueue.shift()!;
      const b = this.preview.find((x) => x.id === id);
      if (!b) continue;
      const scale = this.unit.dims.w * this.unit.dims.d * 110;
      const { key, item } = inspectionBark(this.rng, b, scale);
      const line = bark(this.rng, b.profile, key);
      if (!line) continue;
      const def = item ? itemDef(item) : null;
      const itemName = def ? t(def.family ? FAMILIES[def.family].unknownName : def.name) : '';
      this.app.ui.bubble(`bark:${id}`, () => fs.figures.get(id)?.headWorld() ?? null, t(line, { item: itemName }), this.npcName(id), '', 3000);
    }
  }

  update(dt: number) {
    const fs = this.app.facility;
    this.phaseT += dt;
    if (this.lookShiftT > 0) {
      this.lookShiftT -= dt;
      const k = Math.sin(Math.max(0, this.lookShiftT) / 1.1 * Math.PI);
      if (!this.insideView && !fs.rig.moving) fs.rig.look.add(this.lookShift.clone().multiplyScalar(k * dt * 2));
    }
    fs.update(dt);
    const input = this.app.input;
    switch (this.phase) {
      case 'arrive': {
        if (this.phaseT > 2.3 && this.phaseT - dt <= 2.3) {
          if (this.app.game.state.today!.index === 0) this.say(AUCTIONEER.lines.intro[0]);
          else this.say(N_('Next up: unit {unit}. Cutting the lock!'), { unit: this.unit.number });
        }
        if (this.phaseT > 4.2 && this.phaseT - dt <= 4.2) {
          this.app.audio.play('bolt');
          setTimeout(() => this.app.audio.play('door_roll'), 350);
          fs.openDoor(this.unit.doorOpen, 1.5);
        }
        if (this.phaseT > 6.1 || input.pressedKey('Enter')) {
          if (this.phaseT < 4.2) fs.openDoor(this.unit.doorOpen, 0.4);
          this.startInspection();
        }
        break;
      }
      case 'inspect': {
        this.updateLook(dt);
        this.updateHover(dt);
        this.npcInspectionChatter();
        const before = Math.ceil(this.timer);
        this.timer -= dt;
        const now = Math.ceil(this.timer);
        if (now !== before) {
          this.renderInspectHud();
          if (now <= 5 && now > 0) this.app.audio.play('tick', 0.8);
        }
        if (this.timer <= 0 || input.pressedKey('Enter')) this.endInspection();
        break;
      }
      case 'bidding': {
        const run = this.run!;
        if (this.insideView) {
          this.updateLook(dt);
          this.updateHover(dt);
        }
        if (input.pressedKey('Space') || input.pressedKey('KeyB')) this.playerBid();
        if (input.pressedKey('KeyP')) this.pass();
        if (input.pressedKey('KeyV')) this.toggleView();
        if (input.pressedKey('KeyA') && !this.insideView) { this.autoOpen = !this.autoOpen; this.renderDock(); }
        run.update(dt * this.speed);
        this.handle(run.drain());
        const bar = document.getElementById('call-progress');
        if (bar && this.phase === 'bidding') bar.style.width = `${Math.min(100, (run.since / (run.phase === 'opening' ? CONFIG.auction.openingWait : CONFIG.auction.calls.sold)) * 100)}%`;
        const secs = Math.floor(run.since);
        if (secs !== this.lastTick && (run.phase === 'final')) { this.lastTick = secs; this.app.audio.play('tick', 0.5); }
        break;
      }
      case 'sold': {
        if (this.phaseT - this.soldAt > 2.8) this.showResult();
        break;
      }
      case 'result':
        break;
    }
    const moneyEl = document.getElementById('auction-money');
    if (moneyEl) moneyEl.textContent = money(this.app.game.state.money);
  }

  exit() {
    this.app.audio.silenceVoice();
    this.app.audio.intensity = 0;
    this.app.facility.flashlight.intensity = 0;
    this.speed = 1;
  }
}
