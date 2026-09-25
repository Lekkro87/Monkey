import { CONFIG } from '../core/config';
import { RNG } from '../core/rng';
import type { ItemInstance, QuestState, UnitBlueprint } from '../core/types';
import { itemDef } from '../data/items';
import { QUEST_MAP } from '../data/progression';
import type { Game } from './game';
import { createInstance } from './items';

/**
 * Story quests built from story items. The Lost Photographer: collect three
 * belongings of Evelyn Marlow, find her granddaughter, decide what to do.
 */
export class QuestSystem {
  constructor(private readonly game: Game) {}

  get(id: string): QuestState | null {
    return this.game.state.quests[id] ?? null;
  }

  /** Which story item (if any) should be hidden in the next generated unit. */
  storyCandidate(rng: RNG, bp: UnitBlueprint): string | null {
    const q = QUEST_MAP.photographer;
    const st = this.get(q.id);
    if (st?.resolved) return null;
    const found = new Set(st?.found ?? []);
    const pending = q.items.filter((i) => !found.has(i) && !this.inCirculation(i));
    if (pending.length === 0) return null;
    const chance = bp.storyChance + (st ? st.pity : 0);
    if (!rng.chance(chance)) {
      if (st) st.pity += CONFIG.loot.storyPity;
      return null;
    }
    if (st) st.pity = 0;
    return rng.pick(pending);
  }

  /** A story item is already waiting in today's lineup or the unit being searched. */
  private inCirculation(defId: string): boolean {
    const st = this.game.state;
    const units = [...(st.today?.lots ?? []), ...(st.searchUnit ? [st.searchUnit] : [])];
    return units.some((u) => u.items.some((p) => p.inst.defId === defId || (p.contents ?? []).some((c) => c.defId === defId)));
  }

  onFound(inst: ItemInstance): void {
    const def = itemDef(inst.defId);
    if (!def.quest) return;
    const q = QUEST_MAP[def.quest];
    const st = this.game.state;
    let qs = st.quests[q.id];
    if (!qs) {
      qs = { id: q.id, stage: 0, found: [], resolved: null, startedDay: st.day, pity: 0, developed: false };
      st.quests[q.id] = qs;
      this.game.news('New story: {quest}.', { quest: q.name }, 'quest');
    }
    if (!qs.found.includes(def.id)) qs.found.push(def.id);
    const stage = Math.min(q.stages.length - 1, qs.found.length - 1 + (qs.developed ? 1 : 0));
    this.setStage(qs, stage);
  }

  onDeveloped(): void {
    const qs = this.get('photographer');
    if (!qs) return;
    qs.developed = true;
    const q = QUEST_MAP.photographer;
    this.setStage(qs, Math.min(q.stages.length - 1, qs.found.length - 1 + 1));
    this.game.progression.addXp(40, 'quest');
  }

  private setStage(qs: QuestState, stage: number) {
    if (stage <= qs.stage && qs.found.length > 1) return;
    qs.stage = Math.max(qs.stage, stage);
    this.game.bus.emit('quest:update', { id: qs.id, stage: qs.stage });
    const q = QUEST_MAP[qs.id];
    this.game.news('{quest}: {stage}', { quest: q.name, stage: q.stages[qs.stage].title }, 'quest');
  }

  canResolve(id: string): boolean {
    const q = QUEST_MAP[id];
    const qs = this.get(id);
    if (!q || !qs || qs.resolved) return false;
    const owned = q.items.filter((defId) => this.ownedStoryItem(defId));
    return owned.length >= q.needed;
  }

  private ownedStoryItem(defId: string): ItemInstance | undefined {
    return Object.values(this.game.state.items).find((i) => i.defId === defId && ['garage', 'display', 'van'].includes(i.location));
  }

  resolve(id: string, choice: string, rng: RNG): boolean {
    const q = QUEST_MAP[id];
    const qs = this.get(id);
    if (!q || !qs || !this.canResolve(id)) return false;
    const st = this.game.state;
    const story = q.items.map((d) => this.ownedStoryItem(d)).filter(Boolean) as ItemInstance[];
    for (const it of story) {
      it.location = 'gifted';
      const slot = st.garage.display.indexOf(it.uid);
      if (slot >= 0) st.garage.display[slot] = null;
    }
    const add = (defId: string) => {
      const inst = createInstance(itemDef(defId), rng, { uid: this.game.nextUid(), unitId: null, day: st.day, dirt: 0 });
      inst.knowledge.idLevel = 3;
      inst.knowledge.conditionKnown = true;
      inst.knowledge.authKnown = true;
      this.game.inventory.add(inst, 'garage');
      this.game.bus.emit('item:found', { item: inst, rarity: itemDef(defId).rarity, secret: false });
    };
    if (choice === 'return') {
      this.game.economy.earn(3000, 'reward', { note: q.id });
      add('marlow_camera');
    } else if (choice === 'sell') {
      this.game.economy.earn(14000, 'reward', { note: q.id });
    } else {
      add('marlow_archive');
    }
    qs.resolved = choice;
    qs.stage = q.stages.length - 1;
    this.game.progression.unlock('full_circle');
    this.game.progression.addXp(300, 'quest');
    this.game.bus.emit('quest:update', { id, stage: qs.stage });
    return true;
  }
}
