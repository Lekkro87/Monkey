// Frame-time breakdown per game screen in headless Chromium (software WebGL).
// Usage: node dev/perf.mjs [baseUrl] — numbers are relative; real GPUs are much faster.
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
await context.addInitScript(`try { localStorage.setItem('storageHunter.settings', JSON.stringify({ quality: '${process.env.Q ?? 'low'}', voice: false, lang: 'en' })); } catch (e) {}`);
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.SH?.app?.controller?.name === 'title', null, { timeout: 60000 });

// Wrap the per-frame work so each part reports its own time.
await page.evaluate(() => {
  const app = window.SH.app;
  const acc = (window.__perf = { update: 0, render: 0, world: 0, frames: 0 });
  const wrap = (obj, key, slot) => {
    const orig = obj[key].bind(obj);
    obj[key] = (...a) => { const t0 = performance.now(); const r = orig(...a); acc[slot] += performance.now() - t0; return r; };
  };
  wrap(app.renderer, 'render', 'render');
  wrap(app.ui, 'updateWorld', 'world');
  const loopUpdate = () => { acc.frames++; requestAnimationFrame(loopUpdate); };
  requestAnimationFrame(loopUpdate);
  const origGo = app.go.bind(app);
  app.go = (c) => { origGo(c); wrap(c, 'update', 'update'); };
  wrap(app.controller, 'update', 'update');
});

const measure = async (label, ms = 3000) => {
  const r = await page.evaluate(async (ms) => {
    const p = window.__perf;
    const r = window.SH.app.renderer.renderer;
    Object.assign(p, { update: 0, render: 0, world: 0, frames: 0 });
    const t0 = performance.now();
    await new Promise((res) => setTimeout(res, ms));
    const secs = (performance.now() - t0) / 1000;
    const f = Math.max(1, p.frames);
    let meshes = 0;
    window.SH.app.renderer.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; });
    return {
      fps: +(p.frames / secs).toFixed(1),
      updateMs: +(p.update / f).toFixed(1),
      renderMs: +(p.render / f).toFixed(1),
      worldMs: +(p.world / f).toFixed(1),
      calls: r.info.render.calls,
      tris: r.info.render.triangles,
      meshes,
      programs: r.info.programs?.length,
    };
  }, ms);
  console.log(label.padEnd(10), JSON.stringify(r));
};

await measure('title');
await page.getByRole('button', { name: /Play|Spielen/ }).first().click();
await page.waitForTimeout(800);
await page.locator('.modal-foot .btn.primary').click();
await measure('hub');
await page.locator('.hub-panel .btn.primary').first().click();
await page.evaluate(() => { window.SH.app.timeScale = 3; });
await page.waitForFunction(() => window.SH.app.controller?.phase === 'inspect', null, { timeout: 90000 });
await page.evaluate(() => { window.SH.app.timeScale = 1; });
await measure('inspect');
await page.keyboard.press('Enter');
await page.waitForTimeout(1500);
await measure('bidding');
await page.evaluate(() => window.SH.app.route('garage'));
await page.waitForTimeout(1500);
await measure('garage');
await browser.close();
