import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
await context.addInitScript(`try { localStorage.setItem('storageHunter.settings', JSON.stringify({quality:'low',voice:false,lang:'en'})); } catch (e) {}`);
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.SH?.app?.controller?.name === 'title', null, { timeout: 60000 });
await page.waitForTimeout(1000);
const measure = async (label) => {
  const r = await page.evaluate(async () => {
    const app = window.SH.app;
    const r = app.renderer.renderer;
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) app.renderer.render(0.016);
    r.getContext().finish();
    const renderMs = (performance.now() - t0) / 5;
    const info = { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs?.length };
    let meshes = 0, lights = 0, shadowLights = 0;
    app.renderer.scene.traverse((o) => { if (o.isMesh && o.visible) meshes++; if (o.isLight) { lights++; if (o.castShadow) shadowLights++; } });
    // frame rate of the whole loop
    const fps = await new Promise((res) => { let n = 0; const s = performance.now(); const f = () => { n++; if (performance.now() - s < 1500) requestAnimationFrame(f); else res(n / ((performance.now() - s) / 1000)); }; requestAnimationFrame(f); });
    return { renderMs: +renderMs.toFixed(1), fps: +fps.toFixed(1), ...info, meshes, lights, shadowLights, w: r.domElement.width, h: r.domElement.height };
  });
  console.log(label, JSON.stringify(r));
};
await measure('title');
// hide UI to see its cost
await page.evaluate(() => { document.querySelectorAll('.layer, #ui, .ui-root').forEach((e) => e.style.display = 'none'); });
await measure('title-noui');
await browser.close();
