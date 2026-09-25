// Focused check: a private buyer's offer opens the negotiation dialog.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true });
await context.addInitScript(`try { localStorage.setItem('storageHunter.settings', JSON.stringify({ quality: 'low', voice: false, lang: 'de' })); } catch (e) {}`);
const page = await context.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(process.argv[2] ?? 'http://localhost:5173/', { waitUntil: 'load' });
await page.waitForFunction(() => window.SH?.app?.controller?.name === 'title', null, { timeout: 60000 });
const info = await page.evaluate(() => {
  const { game, app } = window.SH;
  game.newGame(7);
  const today = game.auctions.ensureToday();
  // Take a real item from today's first lot and let a private buyer make an offer on it.
  const inst = today.lots[0].items.map((p) => p.inst).find((i) => i.defId !== 'trash_bag') ?? today.lots[0].items[0].inst;
  game.acquire(inst, 'garage', false);
  const offer = game.market.makeOffer(inst, game.rng);
  if (!game.state.market.offers.includes(offer)) game.state.market.offers.push(offer);
  app.route('market');
  return { item: inst.defId, offer: offer.offer, buyer: offer.buyer, personality: offer.personality };
});
console.log(JSON.stringify(info));
await page.waitForTimeout(1500);
await page.locator('.tabs .tab').nth(1).click();
await page.waitForTimeout(600);
const buttons = await page.locator('.sell-row .btn.primary').count();
console.log('negotiate buttons', buttons);
await page.locator('.sell-row .btn.primary').first().click();
await page.waitForTimeout(1200);
console.log('modals open', await page.locator('.modal').count());
await page.screenshot({ path: process.argv[3] ?? 'offer-check.png' });
await browser.close();
