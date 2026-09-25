import { CONDITION_NAMES } from '../../core/config';
import { money, moneyRange, t, decimal } from '../../core/i18n';
import type { ClueNote, ItemInstance } from '../../core/types';
import { CATEGORY_NAMES, FAMILIES, itemDef, volumeOf } from '../../data/items';
import { authenticityRead, estimateRange } from '../../systems/items';
import { itemWeight } from '../../systems/vehicle';
import { conditionPips, conditionText, isUnknown, itemName, rarityChip } from '../../ui/common';
import { h } from '../../ui/dom';
import type { App } from '../App';
import { visibleRarity } from '../../systems/items';

export function clueText(c: ClueNote): string {
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(c.p ?? {})) p[k] = typeof v === 'string' ? t(v) : v;
  return t(c.k, p);
}

export function notebook(inst: ItemInstance) {
  const clues = inst.knowledge.clues;
  return h('div', { class: 'notebook' },
    clues.length === 0
      ? h('p', { class: 'empty' }, t('No notes yet. Inspect it to learn more.'))
      : clues.slice(-8).map((c) => h('p', { class: c.tone === 1 ? 'good' : c.tone === -1 ? 'bad' : '' }, `– ${clueText(c)}`)),
  );
}

/** Header block for an item: name, rarity, condition, value estimate. */
export function itemHeader(app: App, inst: ItemInstance) {
  const def = itemDef(inst.defId);
  const m = app.game.state.market;
  const [lo, hi] = estimateRange(inst, m);
  const auth = authenticityRead(inst);
  const authLabel: Record<string, string> = {
    verified: t('Verified genuine'), fake: t('Counterfeit'), 'genuine?': t('Looks genuine'), suspicious: t('Suspicious'), unknown: t('Authenticity unknown'),
  };
  const unitRec = inst.unitId ? app.game.state.units[inst.unitId] : null;
  return h('div', { class: 'item-title' },
    h('div', { class: 'row wrap' },
      rarityChip(visibleRarity(inst)),
      h('span', { class: 'chip', style: { color: 'var(--text-faint)' } }, t(CATEGORY_NAMES[def.category])),
      auth ? h('span', { class: ['chip', auth === 'fake' || auth === 'suspicious' ? 'neg' : auth === 'verified' || auth === 'genuine?' ? 'pos' : ''] }, authLabel[auth]) : null,
      inst.fromSecret ? h('span', { class: 'chip r-legendary' }, t('Secret find')) : null,
    ),
    h('h2', { class: isUnknown(inst) ? 'unknown' : '' }, itemName(inst)),
    isUnknown(inst) && def.family ? h('span', { class: 'faint', style: { fontSize: '13px' } }, t(FAMILIES[def.family].hint)) : null,
    h('div', { class: 'row wrap', style: { gap: '14px' } },
      h('span', { class: 'price-tag' }, hi <= 0 ? t('Worthless') : moneyRange(lo, hi)),
      h('div', { class: 'col', style: { gap: '4px' } },
        h('div', { class: 'row' }, conditionPips(inst), h('span', { class: 'dim', style: { fontSize: '13px' } }, conditionText(inst))),
        h('span', { class: 'faint', style: { fontSize: '12px' } },
          `${decimal(itemWeight(inst), 1)} kg · ${decimal(volumeOf(def), 2)} m³`,
          inst.knowledge.workingKnown && def.brokenChance ? ` · ${inst.broken ? t('not working') : t('working')}` : '',
          inst.dirt > 0.45 ? ` · ${t('dirty')}` : ''),
      ),
    ),
    h('span', { class: 'faint', style: { fontSize: '12px' } },
      unitRec ? t('From unit {n}, day {d}', { n: unitRec.number, d: unitRec.day }) : t('Gift'),
      inst.costBasis ? ` · ${t('your cost ≈ {c}', { c: money(inst.costBasis) })}` : ''),
    inst.knowledge.idLevel >= 2 ? h('p', { class: 'note', style: { margin: '2px 0 0' } }, t(def.flavor)) : null,
  );
}

export function conditionLabel(c: number): string {
  return t(CONDITION_NAMES[c]);
}
