import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { ItemInstance } from '../core/types';
import { itemDef } from '../data/items';
import { dirtLevel } from './materials';
import { buildModel } from './models';

/**
 * Item thumbnails rendered from the real 3D models by a small offscreen renderer.
 * Cached per model/params/dirt level so the inventory grid stays cheap.
 */
class ThumbnailRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
  private cache = new Map<string, string>();
  private size = 160;
  failed = false;

  private init() {
    if (this.renderer || this.failed) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = this.size;
      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(this.size, this.size, false);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.1;
      const pm = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environmentIntensity = 0.7;
      const key = new THREE.DirectionalLight('#fff3e0', 2.4);
      key.position.set(-2, 3, -2.5);
      const rim = new THREE.DirectionalLight('#9ac4ff', 1.2);
      rim.position.set(2.5, 1.5, 2);
      this.scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.35));
    } catch {
      this.failed = true;
    }
  }

  forItem(inst: ItemInstance): string {
    const def = itemDef(inst.defId);
    const dl = dirtLevel(inst.dirt);
    const key = `${def.id}:${dl}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    return this.render(key, () => buildModel(def, { dirt: inst.dirt, seed: def.id }), def.dims);
  }

  forDef(defId: string): string {
    const def = itemDef(defId);
    const key = `${def.id}:0`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    return this.render(key, () => buildModel(def, { dirt: 0, seed: def.id }), def.dims);
  }

  private render(key: string, make: () => THREE.Object3D, dims: [number, number, number]): string {
    this.init();
    if (!this.renderer) return '';
    const obj = make();
    // Models face -z; the camera sits on the -z side for a three-quarter front view.
    obj.rotation.y = -0.55;
    this.scene.add(obj);
    const r = Math.hypot(dims[0], dims[1], dims[2]) / 2;
    const dist = r / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.02;
    this.camera.position.set(0, dist * 0.45, -dist * 0.9).normalize().multiplyScalar(dist);
    this.camera.lookAt(0, 0, 0);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.scene.remove(obj);
    this.cache.set(key, url);
    return url;
  }
}

export const Thumbs = new ThumbnailRenderer();
