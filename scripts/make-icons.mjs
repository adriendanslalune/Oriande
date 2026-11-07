// Renders public/icons/icon.svg into the PNG sizes the PWA manifest needs.
// Uses the Playwright Chromium available in the dev environment: `npm run icons`.
import { createRequire } from 'node:module';
// Playwright is installed globally in the dev container, not as a project dependency.
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8');
const out = (name) => new URL(`../public/icons/${name}`, import.meta.url).pathname;
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(name, size, inset = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - 2 * inset;
  await page.setContent(`<body style="margin:0;background:#ece3cb">
    <div style="width:${size}px;height:${size}px;display:grid;place-items:center">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body>`);
  await page.screenshot({ path: out(name) });
}

await render('icon-192.png', 192);
await render('icon-512.png', 512);
await render('icon-maskable-512.png', 512, 64); // keep the rose inside the maskable safe zone
await render('apple-touch-icon.png', 180);
await browser.close();
