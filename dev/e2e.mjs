// End-to-end smoke playthrough with screenshots.
// Usage: node dev/e2e.mjs <baseUrl> <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';

const [base = 'http://localhost:5173/', out = './e2e-shots'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
const settings = JSON.stringify({ quality: process.env.Q ?? 'low', voice: false, lang: process.env.LANG_UI ?? 'en' });
await context.addInitScript(`try { localStorage.setItem('storageHunter.settings', ${JSON.stringify(settings)}); } catch (e) {}`);
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('ERR_CERT') && !m.text().includes('fonts.g')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack ?? ''}`));
const shot = async (name) => { await page.screenshot({ path: `${out}/${name}.png` }); console.log('shot', name); };
const wait = (ms) => page.waitForTimeout(ms);
const ctrl = () => page.evaluate(() => window.SH.app.controller?.name);

await page.goto(base, { waitUntil: 'load' });
await page.waitForFunction(() => window.SH?.app?.controller?.name === 'title', null, { timeout: 60000 });
await wait(1500);
await shot('01-title');
await page.getByRole('button', { name: /Play|Spielen/ }).first().click();
await wait(1500);
await shot('02-hub-intro');
await page.locator('.modal-foot .btn.primary').click();
await wait(600);
await shot('03-hub');
await page.locator('.hub-panel .btn.primary').first().click();
await wait(3500);
await shot('04-arrive');
const fps = await page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); };
  requestAnimationFrame(f);
}));
console.log('fps', fps.toFixed(1));
// Headless software rendering is slow; speed up game time so timers finish.
const TS = Number(process.env.TS ?? 3);
await page.evaluate((ts) => { window.SH.app.timeScale = ts; }, TS);
await page.waitForFunction(() => window.SH.app.controller?.phase === 'inspect', null, { timeout: 60000 });
await wait(1800);
await shot('05-inspect');
// Look around a bit with a drag.
await page.mouse.move(700, 450);
await page.mouse.down();
await page.mouse.move(560, 420, { steps: 8 });
await page.mouse.up();
await wait(800);
await shot('06-inspect-look');
await page.keyboard.press('Enter');
await wait(1500);
await shot('07-bidding');
// Make sure we win: auto bid up to all our money.
await page.evaluate(() => { const c = window.SH.app.controller; c.run.setAuto(window.SH.game.state.money); });
for (let i = 0; i < 40; i++) {
  const st = await page.evaluate(() => {
    const c = window.SH.app.controller;
    return { name: c?.name, phase: c?.phase, run: c?.run ? { phase: c.run.phase, current: c.run.current, leader: c.run.leader, since: +c.run.since.toFixed(2), finished: c.run.finished } : null };
  });
  console.log('bidding', JSON.stringify(st));
  if (st.name !== 'auction' || ['sold', 'result'].includes(st.phase)) break;
  await wait(3000);
}
await page.waitForFunction(() => ['sold', 'result'].includes(window.SH.app.controller?.phase) || window.SH.app.controller?.name === 'search', null, { timeout: 30000 });
await wait(400);
await shot('08-sold');
await page.waitForFunction(() => ['search', 'auction', 'summary'].includes(window.SH.app.controller?.name) && window.SH.app.controller?.phase !== 'sold', null, { timeout: 30000 });
await wait(2500);
console.log('controller after sale:', await ctrl());
if ((await ctrl()) === 'search') {
  await shot('09-search');
  // Open every container and take everything that is not junk.
  const summary = await page.evaluate(async () => {
    const app = window.SH.app;
    const c = app.controller;
    const game = window.SH.game;
    const opened = [];
    for (const e of game.search.entries()) {
      const def = e.inst.defId;
      const d = window.SH.game.state && e;
      if (game.search.find(e.inst.uid) && !game.search.isOpen(e.inst.uid)) {
        try { c.openContainer(e.inst.uid); opened.push(def); } catch (err) { opened.push('ERR ' + err.message); }
      }
      void d;
    }
    return opened.length;
  });
  console.log('opened containers', summary);
  await wait(2500);
  await shot('10-search-opened');
  const taken = await page.evaluate(async () => {
    const c = window.SH.app.controller;
    const game = window.SH.game;
    let n = 0;
    for (const e of game.search.entries()) {
      const def = e.inst.defId;
      if (['trash_bag', 'mattress', 'broken_chair', 'paint_cans', 'tire', 'magazines', 'junk_electronics', 'box_s', 'box_m', 'box_l'].includes(def)) continue;
      if (!game.vehicle.canLoad(e.inst).ok) { game.search.driveLoad(); }
      await c.take(e.inst.uid);
      n++;
    }
    return n;
  });
  console.log('taken', taken);
  await wait(1200);
  await shot('11-search-taken');
  // finish() awaits the confirm dialog, so do not wait on its promise here.
  await page.evaluate(() => { void window.SH.app.controller.finish(); });
  await wait(800);
  await shot('12-finish-confirm');
  await page.locator('.modal-foot .btn.primary').click();
  await wait(1200);
  await shot('13-unit-cleared');
  await page.locator('.modal-foot .btn.ghost').click();
  await wait(2000);
}
console.log('controller now:', await ctrl());
await page.evaluate(() => window.SH.app.route('garage'));
await wait(2500);
await shot('14-garage');
const first = await page.evaluate(() => window.SH.game.inventory.at('garage')[0]?.uid);
if (first) {
  await page.evaluate((uid) => window.SH.app.route('workbench', { item: uid }), first);
  await wait(2200);
  await shot('15-workbench');
  await page.locator('.action-row').first().click();
  await wait(800);
  await shot('16-workbench-step');
  await page.evaluate((uid) => window.SH.app.route('market', { item: uid }), first);
  await wait(2000);
  await shot('17-market-item');
}
// Tabs are identified by position so the run works in every language.
const tabs = async (prefix, from = 0) => {
  const n = await page.locator('.tabs .tab').count();
  for (let i = from; i < n; i++) {
    await page.locator('.tabs .tab').nth(i).click();
    await wait(900);
    await shot(`${prefix}-tab${i}`);
  }
};
await page.evaluate(() => window.SH.app.route('garage'));
await wait(1500);
await tabs('21-garage', 2);
await page.evaluate(() => { window.SH.game.advanceDay(); window.SH.game.advanceDay(); window.SH.app.route('market'); });
await wait(1000);
await tabs('22-market', 1);
// Haggle with the pawn shop on the first item.
if (first) {
  await page.evaluate((uid) => window.SH.app.route('market', { item: uid }), first);
  await wait(1200);
  const haggle = page.locator('.channel .btn:not(.primary):not([disabled])').first();
  if (await haggle.count()) {
    await haggle.click();
    await wait(900);
    await shot('23-negotiation');
    await page.keyboard.press('Escape');
    await wait(400);
  }
}
// Negotiate with a private buyer from the offers tab.
await page.evaluate(() => window.SH.app.route('market'));
await wait(900);
await page.locator('.tabs .tab').nth(1).click();
await wait(700);
const nego = page.locator('.panel-body .btn.primary:not([disabled])').first();
if (await nego.count()) {
  await nego.click();
  await wait(900);
  await shot('23b-offer-negotiation');
  await page.keyboard.press('Escape');
  await wait(400);
}
await page.evaluate(() => window.SH.app.route('progress'));
await wait(1500);
await shot('24-progress');
await tabs('24-progress', 1);
await page.evaluate(() => window.SH.app.route('collection'));
await wait(1500);
await shot('25-collection');
await page.evaluate(() => window.SH.app.route('title'));
await wait(2000);
await shot('26-title-continue');
await page.locator('.menu .menu-item').last().click();
await wait(900);
await shot('27-settings');
console.log('ERRORS', errors.length);
for (const e of errors.slice(0, 20)) console.log(' -', e.slice(0, 400));
const missing = await page.evaluate(() => window.SH.missingTranslations?.() ?? []);
const real = missing.filter((m) => /[a-z]{3}/.test(m) && !/^\$/.test(m));
console.log('MISSING_TRANSLATIONS', real.length);
for (const m of real.slice(0, 60)) console.log(' ~', m);
await browser.close();
