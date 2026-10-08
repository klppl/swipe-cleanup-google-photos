// Renders store/assets/promo.html into the Chrome Web Store promo tiles.
// Usage: node scripts/render-promo.mjs   (needs Playwright: npm i -g playwright)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = pathToFileURL(path.join(root, 'store/assets/promo.html')).href;
const tiles = [
  { name: 'promo-small-440x280.png', w: 440, h: 280, cls: 'small' },
  { name: 'promo-marquee-1400x560.png', w: 1400, h: 560, cls: '' },
];

const browser = await chromium.launch();
for (const t of tiles) {
  const page = await browser.newPage({ viewport: { width: t.w, height: t.h } });
  await page.goto(src);
  await page.evaluate(({ w, h, cls }) => {
    document.body.style.setProperty('--w', `${w}px`);
    document.body.style.setProperty('--h', `${h}px`);
    if (cls) document.body.classList.add(cls);
  }, t);
  await page.screenshot({ path: path.join(root, 'store/assets', t.name) });
  console.log('wrote', t.name);
}
await browser.close();
