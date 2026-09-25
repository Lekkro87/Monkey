// Usage: node dev/shot.mjs <url> <out.png> [width] [height] [waitMs]
import { chromium } from 'playwright';
const [url, out, w = '1400', h = '900', wait = '1500'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(+wait);
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 }); } catch {}
await page.screenshot({ path: out });
console.log(logs.slice(0, 30).join('\n'));
await browser.close();
