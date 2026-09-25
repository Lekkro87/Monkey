import * as THREE from 'three';
import { hashString } from '../../core/rng';
import type { ItemDef, ItemInstance } from '../../core/types';
import { itemDef } from '../../data/items';
import { M, dirtLevel, type DirtLevel } from '../materials';
import { ELECTRONICS } from './electronics';
import { FURNITURE } from './furniture';
import { Kit, type Parts } from './kit';
import { SMALLS } from './smalls';

export type { Parts } from './kit';

const BUILDERS: Record<string, (k: Kit) => void> = { ...FURNITURE, ...ELECTRONICS, ...SMALLS };

export function hasBuilder(model: string): boolean {
  return model in BUILDERS;
}

export interface ModelOptions {
  label?: string;
  dirt?: number;
  seed?: string;
  detail?: number;
}

/** Build the 3D model of an item, centred on its bounding box. */
export function buildModel(def: ItemDef, opts: ModelOptions = {}): THREE.Group {
  const [w, h, d] = def.dims;
  const params: Record<string, string | number | boolean> = { ...(def.modelParams ?? {}) };
  if (opts.label !== undefined) params.label = opts.label;
  const dl: DirtLevel = dirtLevel(opts.dirt ?? 0.2);
  const kit = new Kit(w, h, d, params, dl, hashString(opts.seed ?? def.id), opts.detail ?? 1);
  const builder = BUILDERS[def.model];
  if (builder) {
    try {
      builder(kit);
    } catch (err) {
      console.error(`[models] builder ${def.model} failed`, err);
      kit.box(w, h, d, M.cardboard(1, dl));
    }
  } else {
    kit.box(w, h, d, M.cardboard(1, dl));
  }
  const g = kit.finish();
  g.userData.defId = def.id;
  return g;
}

export function buildItem(inst: ItemInstance, label?: string): THREE.Group {
  const g = buildModel(itemDef(inst.defId), { label, dirt: inst.dirt, seed: inst.uid });
  g.userData.uid = inst.uid;
  return g;
}

export function partsOf(obj: THREE.Object3D): Parts {
  return (obj.userData.parts as Parts) ?? {};
}
