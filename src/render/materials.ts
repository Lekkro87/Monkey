import * as THREE from 'three';
import { Tex, type SurfaceTex } from './textures';

export type DirtLevel = 0 | 1 | 2;

export type Surface =
  | 'cardboard0' | 'cardboard1' | 'cardboard2' | 'cardboard3'
  | 'pine' | 'walnut' | 'oak' | 'dark_wood' | 'painted_white' | 'teak' | 'plywood'
  | 'leather' | 'leather_black' | 'leather_tan' | 'brushed' | 'rust' | 'concrete';

export interface MatSpec {
  color?: string;
  surface?: Surface;
  fabric?: { color: string; pattern?: 'plain' | 'floral' | 'check' | 'weave' };
  rough?: number;
  metal?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  side?: 'double';
  repeat?: [number, number];
  map?: THREE.Texture;
}

function surfaceTex(s: Surface): SurfaceTex {
  switch (s) {
    case 'cardboard0': return Tex.cardboard(0);
    case 'cardboard1': return Tex.cardboard(1);
    case 'cardboard2': return Tex.cardboard(2);
    case 'cardboard3': return Tex.cardboard(3);
    case 'pine': return Tex.wood('pine');
    case 'walnut': return Tex.wood('walnut');
    case 'oak': return Tex.wood('oak');
    case 'dark_wood': return Tex.wood('dark');
    case 'painted_white': return Tex.wood('painted_white');
    case 'teak': return Tex.wood('teak');
    case 'plywood': return Tex.wood('plywood');
    case 'leather': return Tex.leather('#4a2e1c');
    case 'leather_black': return Tex.leather('#1c1a19');
    case 'leather_tan': return Tex.leather('#8a5a32');
    case 'brushed': return Tex.brushed();
    case 'rust': return Tex.rust();
    case 'concrete': return Tex.concrete();
  }
}

const DEFAULT_ROUGH: Partial<Record<Surface, number>> = {
  leather: 0.55, leather_black: 0.5, leather_tan: 0.55, brushed: 0.35, rust: 0.95, concrete: 0.95,
};

/**
 * Cached material factory. Items share materials; dirt is quantised into three
 * variants so hundreds of objects still cost only a handful of materials.
 */
class MaterialLibrary {
  private cache = new Map<string, THREE.MeshStandardMaterial>();

  get(spec: MatSpec, dirt: DirtLevel = 0): THREE.MeshStandardMaterial {
    const key = `${spec.color ?? ''}|${spec.surface ?? ''}|${spec.fabric ? spec.fabric.color + spec.fabric.pattern : ''}|${spec.rough ?? ''}|${spec.metal ?? ''}|${spec.emissive ?? ''}|${spec.emissiveIntensity ?? ''}|${spec.opacity ?? ''}|${spec.side ?? ''}|${spec.repeat?.join(',') ?? ''}|${spec.map?.uuid ?? ''}|${dirt}`;
    let m = this.cache.get(key);
    if (m) return m;
    const params: THREE.MeshStandardMaterialParameters = {
      color: new THREE.Color(spec.color ?? '#ffffff'),
      roughness: spec.rough ?? (spec.surface ? DEFAULT_ROUGH[spec.surface] ?? 0.8 : 0.7),
      metalness: spec.metal ?? 0,
    };
    if (spec.surface) {
      const tex = surfaceTex(spec.surface);
      params.map = tex.map;
      if (tex.normalMap) params.normalMap = tex.normalMap;
    }
    if (spec.fabric) {
      params.map = Tex.fabric(spec.fabric.color, spec.fabric.pattern ?? 'weave').map;
      params.roughness = spec.rough ?? 0.95;
    }
    if (spec.map) params.map = spec.map;
    if (spec.emissive) {
      params.emissive = new THREE.Color(spec.emissive);
      params.emissiveIntensity = spec.emissiveIntensity ?? 1;
    }
    if (spec.opacity !== undefined && spec.opacity < 1) {
      params.transparent = true;
      params.opacity = spec.opacity;
      params.depthWrite = false;
    }
    if (spec.side === 'double') params.side = THREE.DoubleSide;
    m = new THREE.MeshStandardMaterial(params);
    if (spec.repeat && m.map) {
      m.map = m.map.clone();
      m.map.repeat.set(spec.repeat[0], spec.repeat[1]);
      m.map.needsUpdate = true;
    }
    if (dirt > 0) {
      const f = dirt === 1 ? 0.8 : 0.62;
      m.color.multiply(new THREE.Color(f, f * 0.96, f * 0.9));
      m.roughness = Math.min(1, m.roughness + 0.12 * dirt);
      m.metalness *= dirt === 1 ? 0.8 : 0.55;
    }
    this.cache.set(key, m);
    return m;
  }

  color(hex: string, rough = 0.7, metal = 0, dirt: DirtLevel = 0) {
    return this.get({ color: hex, rough, metal }, dirt);
  }
}

export const Materials = new MaterialLibrary();

export function dirtLevel(dirt: number): DirtLevel {
  return dirt > 0.66 ? 2 : dirt > 0.33 ? 1 : 0;
}

/** Commonly used material presets. */
export const M = {
  chrome: (d: DirtLevel = 0) => Materials.get({ color: '#d8dadc', rough: 0.18, metal: 1 }, d),
  steel: (d: DirtLevel = 0) => Materials.get({ color: '#9ea3a8', rough: 0.4, metal: 0.9, surface: 'brushed' }, d),
  darkMetal: (d: DirtLevel = 0) => Materials.get({ color: '#3a3d41', rough: 0.5, metal: 0.8 }, d),
  gold: (d: DirtLevel = 0) => Materials.get({ color: '#e0b04a', rough: 0.25, metal: 1 }, d),
  brass: (d: DirtLevel = 0) => Materials.get({ color: '#b8923e', rough: 0.35, metal: 1 }, d),
  silver: (d: DirtLevel = 0) => Materials.get({ color: '#cfd3d6', rough: 0.22, metal: 1 }, d),
  glass: () => Materials.get({ color: '#bcd8e0', rough: 0.05, metal: 0.1, opacity: 0.35 }),
  screen: (d: DirtLevel = 0) => Materials.get({ color: '#1a2226', rough: 0.15, metal: 0.2 }, d),
  rubber: (d: DirtLevel = 0) => Materials.get({ color: '#1b1b1c', rough: 0.9 }, d),
  plastic: (hex: string, d: DirtLevel = 0) => Materials.get({ color: hex, rough: 0.45 }, d),
  paint: (hex: string, d: DirtLevel = 0) => Materials.get({ color: hex, rough: 0.6, metal: 0.2 }, d),
  wood: (s: Surface, d: DirtLevel = 0) => Materials.get({ surface: s }, d),
  fabric: (hex: string, pattern: 'plain' | 'floral' | 'check' | 'weave' = 'weave', d: DirtLevel = 0) => Materials.get({ fabric: { color: hex, pattern } }, d),
  leather: (s: 'leather' | 'leather_black' | 'leather_tan' = 'leather', d: DirtLevel = 0) => Materials.get({ surface: s }, d),
  paper: (hex = '#e9e2cf', d: DirtLevel = 0) => Materials.get({ color: hex, rough: 0.85 }, d),
  cardboard: (seed: number, d: DirtLevel = 0) => Materials.get({ surface: `cardboard${seed % 4}` as Surface }, d),
  tape: () => Materials.get({ color: '#d8b77a', rough: 0.35, opacity: 0.85 }),
  emissive: (hex: string, intensity = 1.5) => Materials.get({ color: '#111111', emissive: hex, emissiveIntensity: intensity, rough: 0.4 }),
};
