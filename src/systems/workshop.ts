import { CONFIG } from '../core/config';
import type { ItemInstance } from '../core/types';
import { itemDef } from '../data/items';
import type { Game } from './game';
import {
  appraise, canClean, canRepair, clean, cleaningCost, expertFee, expertFor, inspectionSteps, performStep, repair,
  repairOptions, type StepResult,
} from './items';

export interface WorkshopResult {
  ok: boolean;
  reason?: string;
  step?: StepResult;
  valueBefore?: number;
  valueAfter?: number;
  success?: boolean;
  revealed?: ItemInstance[];
  hurt?: boolean;
}

const WORKSHOP_LOCATIONS = ['garage', 'display', 'listed'];

/** Everything that happens on the garage workbench. */
export class WorkshopSystem {
  constructor(private readonly game: Game) {}

  private item(uid: string): ItemInstance | null {
    const it = this.game.state.items[uid];
    return it && WORKSHOP_LOCATIONS.includes(it.location) ? it : null;
  }

  steps(uid: string) {
    const it = this.game.state.items[uid];
    return it ? inspectionSteps(it, this.game.state.garage.upgrades) : [];
  }

  inspect(uid: string, stepId: string): WorkshopResult {
    const it = this.item(uid);
    if (!it) return { ok: false, reason: 'Bring the item to the garage first.' };
    const step = this.steps(uid).find((s) => s.id === stepId);
    if (!step) return { ok: false, reason: 'Not possible.' };
    if (!step.available) return { ok: false, reason: 'You need better tools for that.' };
    if (step.cost > 0 && !this.game.economy.spend(step.cost, stepId === 'develop' ? 'lab' : 'misc', { unitId: it.unitId, itemUid: uid })) {
      return { ok: false, reason: 'Not enough money.' };
    }
    const wasAuthKnown = it.knowledge.authKnown;
    const res = performStep(it, stepId, this.game.rng);
    if (res.identified) this.game.bus.emit('item:identified', { item: it });
    else if (!wasAuthKnown && it.knowledge.authKnown) this.game.progression.valueKnown(it);
    if (res.fakeExposed && !wasAuthKnown) this.fakeExposed(it);
    if (res.questProgress) this.game.quests.onDeveloped();
    this.game.touch();
    return { ok: true, step: res };
  }

  private fakeExposed(it: ItemInstance) {
    this.game.state.stats.fakesFound++;
    this.game.bus.emit('item:fake', { item: it });
  }

  cleaningCost(uid: string): number {
    const it = this.game.state.items[uid];
    return it ? cleaningCost(it, this.game.state.garage.upgrades) : 0;
  }

  canClean(uid: string): boolean {
    const it = this.game.state.items[uid];
    return !!it && canClean(it);
  }

  clean(uid: string): WorkshopResult {
    const it = this.item(uid);
    if (!it || !canClean(it)) return { ok: false, reason: 'Nothing to clean.' };
    const cost = this.cleaningCost(uid);
    if (!this.game.economy.spend(cost, 'cleaning', { unitId: it.unitId, itemUid: uid })) return { ok: false, reason: 'Not enough money.' };
    const r = clean(it);
    this.game.bus.emit('item:cleaned', { item: it });
    this.game.touch();
    return { ok: true, valueBefore: r.valueBefore, valueAfter: r.valueAfter, hurt: r.hurt };
  }

  canRepair(uid: string): boolean {
    const it = this.game.state.items[uid];
    return !!it && canRepair(it);
  }

  repairOptions(uid: string) {
    const it = this.game.state.items[uid];
    return it ? repairOptions(it, this.game.state.garage.upgrades) : null;
  }

  repair(uid: string, mode: 'diy' | 'pro'): WorkshopResult {
    const it = this.item(uid);
    if (!it || !canRepair(it)) return { ok: false, reason: 'Nothing to repair.' };
    const opts = repairOptions(it, this.game.state.garage.upgrades);
    const cost = mode === 'pro' ? opts.proCost : opts.diyCost;
    if (!this.game.economy.spend(cost, 'repair', { unitId: it.unitId, itemUid: uid })) return { ok: false, reason: 'Not enough money.' };
    const r = repair(it, mode, this.game.state.garage.upgrades, this.game.rng);
    this.game.bus.emit('item:repaired', { item: it, success: r.success });
    this.game.touch();
    return { ok: true, success: r.success, valueBefore: r.valueBefore, valueAfter: r.valueAfter };
  }

  expertFee(uid: string): number {
    const it = this.game.state.items[uid];
    return it ? expertFee(it) : 0;
  }

  expert(uid: string) {
    const it = this.game.state.items[uid];
    return it ? expertFor(it) : null;
  }

  appraise(uid: string): WorkshopResult {
    const it = this.item(uid);
    if (!it || !expertFor(it)) return { ok: false, reason: 'No expert for this item.' };
    if (it.knowledge.idLevel >= 3) return { ok: false, reason: 'Already appraised.' };
    const fee = expertFee(it);
    if (!this.game.economy.spend(fee, 'expert', { unitId: it.unitId, itemUid: uid })) return { ok: false, reason: 'Not enough money.' };
    const wasIdentified = it.knowledge.idLevel >= 2;
    const r = appraise(it, this.game.state.market);
    if (!wasIdentified) this.game.bus.emit('item:identified', { item: it });
    else this.game.progression.valueKnown(it);
    if (r.fakeExposed) this.fakeExposed(it);
    this.game.touch();
    return { ok: true, valueAfter: r.value };
  }

  /** Hidden compartments can still be found at home if nobody checked in the unit. */
  canCheckSecret(uid: string): boolean {
    const it = this.game.state.items[uid];
    if (!it) return false;
    const spec = itemDef(it.defId).container;
    return !!spec?.secretChance && !it.secretChecked;
  }

  checkSecret(uid: string): WorkshopResult {
    const it = this.item(uid);
    if (!it || !this.canCheckSecret(uid)) return { ok: false, reason: 'Nothing to check.' };
    const found = this.game.revealSecret(it, 'garage');
    this.game.touch();
    return { ok: true, revealed: found };
  }

  canCrack(uid: string): boolean {
    const it = this.game.state.items[uid];
    return !!it && !!it.lockedContents;
  }

  locksmith(uid: string): WorkshopResult {
    const it = this.item(uid);
    if (!it || !it.lockedContents) return { ok: false, reason: 'Nothing locked.' };
    if (!this.game.economy.spend(CONFIG.workshop.locksmith, 'locksmith', { unitId: it.unitId, itemUid: uid })) return { ok: false, reason: 'Not enough money.' };
    const contents = it.lockedContents;
    delete it.lockedContents;
    for (const c of contents) {
      c.unitId = it.unitId;
      this.game.acquire(c, 'garage', true);
    }
    this.game.progression.unlock('safecracker');
    this.game.touch();
    return { ok: true, revealed: contents };
  }
}
