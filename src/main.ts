import './styles/main.css';
import { App } from './app/App';
import { AuctionController } from './app/controllers/AuctionController';
import { GarageController } from './app/controllers/GarageController';
import { HubController } from './app/controllers/HubController';
import { MarketController } from './app/controllers/MarketController';
import { CollectionController, ProgressController } from './app/controllers/ProgressController';
import { SearchController } from './app/controllers/SearchController';
import { SummaryController } from './app/controllers/SummaryController';
import { TitleController } from './app/controllers/TitleController';
import { t } from './core/i18n';

function setBoot(p: number, msg: string) {
  const bar = document.getElementById('boot-bar');
  const m = document.getElementById('boot-msg');
  if (bar) bar.style.width = `${Math.round(p * 100)}%`;
  if (m) m.textContent = msg;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

async function fontsReady() {
  try {
    const fonts = document.fonts;
    await Promise.race([
      Promise.all([
        fonts.load('400 32px "Permanent Marker"'),
        fonts.load('900 32px "Big Shoulders Stencil Display"'),
        fonts.load('700 16px "Barlow Condensed"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fonts are optional */ }
}

const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

async function boot() {
  const root = document.getElementById('app')!;
  if (!webglAvailable()) {
    setBoot(1, 'WebGL is not available');
    document.getElementById('boot-msg')!.textContent = 'Storage Hunter needs WebGL. Try a current Chrome, Firefox, Edge or Safari.';
    return;
  }
  setBoot(0.15, 'Loading fonts');
  await fontsReady();
  setBoot(0.3, 'Starting engine');
  await frame();
  const app = new App(root);
  app.register('title', (a) => new TitleController(a));
  app.register('hub', (a) => new HubController(a));
  app.register('auction', (a) => new AuctionController(a));
  app.register('search', (a) => new SearchController(a));
  app.register('summary', (a) => new SummaryController(a));
  app.register('garage', (a, p) => new GarageController(a, p.tab === 'bench' ? 'bench' : 'stock', (p.item as string) ?? null));
  app.register('inventory', (a) => new GarageController(a, 'stock'));
  app.register('workbench', (a, p) => new GarageController(a, 'bench', (p.item as string) ?? null));
  app.register('market', (a, p) => new MarketController(a, (p.item as string) ?? null));
  app.register('progress', (a) => new ProgressController(a));
  app.register('collection', (a) => new CollectionController(a));
  setBoot(0.45, t('Loading your save'));
  await frame();
  app.game.load();
  setBoot(0.6, t('Building the storage facility'));
  await frame();
  void app.facility;
  setBoot(0.85, t('Opening the garage'));
  await frame();
  void app.garage;
  setBoot(1, t('Ready'));
  await frame();
  app.route('title');
  app.start();
  const bootEl = document.getElementById('boot');
  if (bootEl) {
    bootEl.style.transition = 'opacity .5s ease';
    bootEl.style.opacity = '0';
    setTimeout(() => bootEl.remove(), 520);
  }
  window.addEventListener('error', (e) => {
    console.error(e.error ?? e.message);
  });
}

boot().catch((err) => {
  console.error(err);
  setBoot(1, `Error: ${String(err)}`);
});
