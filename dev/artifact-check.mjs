// One look at the published page inside a platform-like skeleton: desktop title, desktop hub, phone hub.
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const run = async (name, viewport, toHub) => {
  const context = await browser.newContext({ viewport, ignoreHTTPSErrors: true, isMobile: viewport.width < 500, hasTouch: viewport.width < 500 });
  await context.addInitScript(`try { localStorage.setItem('storageHunter.settings', JSON.stringify({ quality: 'low', voice: false, lang: 'de' })); } catch (e) {}`);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_CERT/.test(m.text())) errors.push(m.text()); });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.SH?.app?.controller?.name === 'title', null, { timeout: 90000 });
  await page.waitForTimeout(1500);
  if (toHub) {
    await page.getByRole('button', { name: /Spielen|Play/ }).first().click();
    await page.waitForTimeout(1200);
    await page.locator('.modal-foot .btn.primary').click();
    await page.waitForTimeout(1200);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, 'title:', await page.title(), 'overflow-x:', overflow, 'errors:', errors.length, errors.slice(0, 3).join(' | '));
  await context.close();
};
await run('desk-title', { width: 1280, height: 800 }, false);
await run('phone-hub', { width: 390, height: 844 }, true);
await browser.close();
