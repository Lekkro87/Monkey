import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { getLang, missingTranslations, money, setLang, t } from '../core/i18n';
import { itemDef } from '../data/items';
import { ACHIEVEMENTS } from '../data/progression';
import { FACILITY_MAP } from '../data/facilities';
import { Renderer } from '../render/Renderer';
import { FacilityScene } from '../render/scenes/FacilityScene';
import { GarageScene } from '../render/scenes/GarageScene';
import { Game } from '../systems/game';
import { LocalStorageBackend } from '../systems/save';
import { Hud } from '../ui/hud';
import { UIManager } from '../ui/UIManager';
import { Input } from './input';
import { loadSettings, saveSettings, type Settings } from './settings';

export interface Controller {
  readonly name: string;
  enter(): void;
  exit(): void;
  update(dt: number): void;
}

export type RouteParams = Record<string, string | number | boolean | undefined>;
export type ControllerFactory = (app: App, params: RouteParams) => Controller;

/**
 * Application shell: renderer, UI, audio, input and the simulation.
 * Controllers (title, hub, auction, search, garage…) take turns driving it.
 */
export class App {
  readonly game: Game;
  readonly renderer: Renderer;
  readonly ui: UIManager;
  readonly audio = new AudioManager();
  readonly input: Input;
  settings: Settings;
  hud: Hud;
  controller: Controller | null = null;
  private facilityScene: FacilityScene | null = null;
  private garageScene: GarageScene | null = null;
  private last = performance.now();
  readonly routes: Record<string, ControllerFactory> = {};
  timeScale = 1;

  constructor(root: HTMLElement) {
    this.settings = loadSettings();
    setLang(this.settings.lang);
    document.documentElement.lang = this.settings.lang;
    this.renderer = new Renderer(root, this.settings.quality);
    this.ui = new UIManager(root);
    this.input = new Input(this.renderer.canvas);
    this.game = new Game({ backend: new LocalStorageBackend() });
    this.hud = new Hud(this.game, () => this.route('progress'), () => this.route('title'));
    this.applyAudioSettings();
    this.wireEvents();
    const unlock = () => this.audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.game.flushSave();
    });
    window.addEventListener('pagehide', () => this.game.flushSave());
    (window as unknown as { SH: unknown }).SH = { app: this, game: this.game, THREE, missingTranslations };
  }

  get facility(): FacilityScene {
    if (!this.facilityScene) {
      this.facilityScene = new FacilityScene(FACILITY_MAP[this.game.state.facilityId], this.renderer.envTexture);
    }
    return this.facilityScene;
  }

  get garage(): GarageScene {
    if (!this.garageScene) this.garageScene = new GarageScene(this.renderer.envTexture);
    return this.garageScene;
  }

  showFacility() {
    this.renderer.setView(this.facility.scene, this.facility.camera);
  }

  showGarage() {
    this.renderer.setView(this.garage.scene, this.garage.camera);
  }

  register(name: string, f: ControllerFactory) {
    this.routes[name] = f;
  }

  route(name: string, params: RouteParams = {}) {
    const f = this.routes[name];
    if (!f) return;
    this.go(f(this, params));
  }

  go(c: Controller) {
    this.ui.closeAllModals();
    this.controller?.exit();
    this.ui.clearBubbles();
    this.ui.clearBanners();
    this.controller = c;
    c.enter();
  }

  setHudVisible(v: boolean) {
    if (v) {
      this.hud.refresh(true);
      this.ui.setHud(this.hud.el);
    } else this.ui.setHud();
  }

  applySettings(next: Partial<Settings>) {
    const langChanged = next.lang && next.lang !== getLang();
    this.settings = { ...this.settings, ...next };
    saveSettings(this.settings);
    if (next.quality) this.renderer.setQuality(next.quality);
    this.applyAudioSettings();
    if (langChanged) {
      setLang(this.settings.lang);
      document.documentElement.lang = this.settings.lang;
      this.hud = new Hud(this.game, () => this.route('progress'), () => this.route('title'));
    }
  }

  private applyAudioSettings() {
    this.audio.setVolumes(this.settings.master, this.settings.music, this.settings.sfx);
    this.audio.voiceEnabled = this.settings.voice;
    this.audio.voiceLang = this.settings.lang === 'de' ? 'de-DE' : 'en-US';
  }

  private wireEvents() {
    const bus = this.game.bus;
    bus.on('achievement', ({ id }) => {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a) return;
      this.ui.toast(`${t('Achievement')}: ${t(a.name)}`, 'achievement', 4500, 'trophy');
      this.audio.play('achievement');
    });
    bus.on('level:up', ({ level }) => {
      this.ui.toast(t('Level {n}: {title}', { n: level, title: t(this.game.progression.levelName(level)) }), 'achievement', 5000, 'star');
      this.audio.play('levelup');
    });
    bus.on('item:sold', () => this.audio.play('cash', 0.8));
    bus.on('item:fake', ({ item }) => {
      this.ui.toast(t('It is a fake: {name}', { name: t(itemDef(item.defId).fakeName ?? itemDef(item.defId).name) }), 'bad', 4200, 'x');
    });
    bus.on('quest:update', () => this.audio.play('paper'));
  }

  moneyText(n: number) {
    return money(n);
  }

  start() {
    const loop = (now: number) => {
      // Clamp long frames (tab switches) but keep game time close to real time on slow machines.
      const raw = Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      const dt = raw * this.timeScale;
      try {
        this.controller?.update(dt);
      } catch (err) {
        console.error(err);
      }
      this.renderer.render(raw);
      this.ui.updateWorld(this.renderer.camera);
      this.input.endFrame();
      this.game.autosave();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
