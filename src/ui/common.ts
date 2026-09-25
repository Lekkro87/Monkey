import { CONDITION_NAMES } from '../core/config';
import { money, moneyRange, t } from '../core/i18n';
import type { ItemInstance, Rarity, UnitEventId } from '../core/types';
import { CATEGORY_NAMES, RARITY_NAMES, itemDef } from '../data/items';
import { EVENT_INFO } from '../data/units';
import { Thumbs } from '../render/thumbnails';
import { authenticityRead, conditionRange, displayName, estimateOpenEnded, estimateRange, visibleRarity } from '../systems/items';
import type { MarketState } from '../core/types';
import { h } from './dom';
import { icon } from './icons';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekday(day: number): string {
  return t(WEEKDAYS[(day - 1) % 7]);
}

export function itemName(inst: ItemInstance): string {
  return t(displayName(inst));
}

export function isUnknown(inst: ItemInstance): boolean {
  const def = itemDef(inst.defId);
  return !!def.family && inst.knowledge.idLevel < 2;
}

export function rarityChip(r: Rarity | null) {
  if (!r) return h('span', { class: 'chip r-unknown' }, t('Unidentified'));
  return h('span', { class: ['chip', `r-${r}`] }, t(RARITY_NAMES[r]));
}

export function eventChip(e: UnitEventId | null) {
  if (!e) return null;
  const info = EVENT_INFO[e];
  return h('span', { class: 'chip event', style: { background: info.color } }, t(info.title));
}

export function conditionPips(inst: ItemInstance) {
  const [lo, hi] = conditionRange(inst);
  const known = inst.knowledge.conditionKnown;
  const wrap = h('span', { class: ['pips', known ? '' : 'unknown'], title: known ? t(CONDITION_NAMES[inst.condition]) : `${t(CONDITION_NAMES[lo])} – ${t(CONDITION_NAMES[hi])}?` });
  for (let i = 1; i <= 6; i++) wrap.appendChild(h('i', { class: i <= (known ? inst.condition : hi) ? 'on' : '' }));
  return wrap;
}

export function conditionText(inst: ItemInstance): string {
  const [lo, hi] = conditionRange(inst);
  if (inst.knowledge.conditionKnown) return t(CONDITION_NAMES[inst.condition]);
  return `${t(CONDITION_NAMES[lo])} – ${t(CONDITION_NAMES[hi])}?`;
}

export function valueText(inst: ItemInstance, market: MarketState): string {
  const [lo, hi] = estimateRange(inst, market);
  if (hi <= 0) return t('Worthless');
  return moneyRange(lo, hi) + (estimateOpenEnded(inst) ? '+' : '');
}

export function thumb(inst: ItemInstance) {
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.src = Thumbs.forItem(inst);
  return img;
}

export function itemCard(inst: ItemInstance, market: MarketState, opts: { selected?: boolean; onClick?: () => void; extra?: HTMLElement | null } = {}) {
  const r = visibleRarity(inst);
  const auth = authenticityRead(inst);
  const badges = h('div', { class: 'badges' });
  if (inst.broken && inst.knowledge.workingKnown) badges.appendChild(h('span', { class: 'badge-dot warn', title: t('Broken') }, icon('wrench', 13)));
  if (inst.dirt > 0.45) badges.appendChild(h('span', { class: 'badge-dot', title: t('Dirty') }, icon('sparkle', 13)));
  if (auth === 'fake') badges.appendChild(h('span', { class: 'badge-dot warn', title: t('Fake') }, icon('x', 13)));
  if (auth === 'verified') badges.appendChild(h('span', { class: 'badge-dot good', title: t('Verified') }, icon('check', 13)));
  if (inst.lockedContents) badges.appendChild(h('span', { class: 'badge-dot warn', title: t('Locked') }, icon('lock', 13)));
  return h('button', {
    class: ['item-card', r ? `r-${r}` : 'r-unknown', opts.selected ? 'selected' : ''],
    onClick: opts.onClick,
  },
  badges,
  h('div', { class: 'thumb' }, thumb(inst)),
  h('div', { class: ['name', isUnknown(inst) ? 'unknown' : ''] }, itemName(inst)),
  h('div', { class: 'row between' }, h('span', { class: 'value' }, valueText(inst, market)), conditionPips(inst)),
  opts.extra ?? null,
  );
}

export function categoryName(inst: ItemInstance): string {
  return t(CATEGORY_NAMES[itemDef(inst.defId).category]);
}

export function signed(n: number): string {
  return money(n, { sign: true });
}

export function profitClass(n: number): string {
  return n > 0.5 ? 'pos' : n < -0.5 ? 'neg' : '';
}

/** Deterministic avatar colour + initials for people. */
export function avatar(name: string, color: string) {
  const initials = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return h('span', { class: 'avatar', style: { background: color } }, initials);
}
