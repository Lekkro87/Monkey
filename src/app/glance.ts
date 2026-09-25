import * as THREE from 'three';
import { t } from '../core/i18n';
import type { PlacedItem } from '../core/types';
import { FAMILIES, itemDef } from '../data/items';

/** What a bidder can tell about an item from the doorway. */
export function glance(p: PlacedItem): { title: string; marker?: string; sub?: string } {
  const def = itemDef(p.inst.defId);
  let title: string;
  if (def.container?.kind === 'box') title = t('Moving box');
  else if (def.container?.kind === 'tote') title = t('Plastic tote');
  else if (def.family && p.inst.knowledge.idLevel < 2) title = t(FAMILIES[def.family].unknownName);
  else title = t(def.name);
  const sub = p.visibility < 0.35 ? t('Partly hidden') : undefined;
  return { title, marker: p.label ? `“${p.label}”` : undefined, sub };
}

/** Walk up from a raycast hit to the item or tarp object it belongs to. */
export function pickTarget(obj: THREE.Object3D | null): { uid?: string; tarp?: number; obj: THREE.Object3D } | null {
  let o: THREE.Object3D | null = obj;
  while (o) {
    if (o.userData.uid) return { uid: o.userData.uid as string, obj: o };
    if (o.userData.tarp !== undefined) return { tarp: o.userData.tarp as number, obj: o };
    o = o.parent;
  }
  return null;
}
