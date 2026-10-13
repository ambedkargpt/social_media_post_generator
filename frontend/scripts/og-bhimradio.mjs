/**
 * Draws the link-preview card for /bhimradio.
 *
 *     node scripts/og-bhimradio.mjs
 *
 * Writes public/og/bhimradio.jpg - 1200x630, the size every platform's
 * large-card preview is built around. It is kept as a script rather than a
 * bare image so the wording can be changed and the card redrawn instead of
 * being re-made in an editor from memory.
 *
 * Two constraints decide how it is saved:
 *
 *   JPEG, under ~300 KB. WhatsApp quietly drops the thumbnail on anything
 *   much larger, and a link that shares with a blank preview is the one thing
 *   this card exists to prevent.
 *
 *   Fonts come from the machine running it. Devanagari is drawn with whatever
 *   Hindi face the system has (Nirmala UI or Mangal on Windows, Noto on
 *   Linux), so redraw on the same kind of machine to get the same card.
 *
 * Needs Playwright's Chromium, which the e2e suite already installs.
 */
import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const asDataUri = (rel, mime) =>
  `data:${mime};base64,${readFileSync(resolve(root, rel)).toString('base64')}`;

const portrait = asDataUri('src/assets/images/ambedkar-portrait.webp', 'image/webp');
const logo = asDataUri('public/logo.png', 'image/png');

const BARS = [22, 46, 30, 64, 40, 78, 52, 34, 70, 44, 26, 58, 36, 20];

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; background: #05081a; overflow: hidden; }
  body {
    position: relative;
    font-family: 'Segoe UI', 'Nirmala UI', 'Mangal', 'Noto Sans Devanagari', system-ui, sans-serif;
    color: #fff;
    background:
      radial-gradient(900px 520px at 8% 0%, rgba(47, 127, 255, .34), transparent 60%),
      radial-gradient(700px 500px at 100% 100%, rgba(26, 60, 196, .38), transparent 60%),
      linear-gradient(160deg, #0a1030 0%, #05081a 60%);
  }

  /* The portrait: greyscale with the brand blue multiplied into it, so it
     reads as one plate rather than a photograph pasted beside the text. */
  .plate { position: absolute; top: 0; right: 0; width: 470px; height: 630px; overflow: hidden; }
  .plate img {
    position: absolute; right: -10px; bottom: 0; height: 700px; width: auto;
    filter: grayscale(1) contrast(1.12) brightness(1.05);
  }
  .plate::before {
    content: ''; position: absolute; inset: 0; z-index: 2;
    background: #1b3cc4; mix-blend-mode: multiply;
  }
  .plate::after {
    content: ''; position: absolute; inset: 0; z-index: 3;
    background: linear-gradient(90deg, #05081a 0%, rgba(5, 8, 26, .55) 28%, transparent 62%);
  }

  .copy { position: absolute; left: 64px; top: 0; bottom: 96px; width: 720px;
          display: flex; flex-direction: column; justify-content: center; }

  .live {
    display: inline-flex; align-items: center; gap: 12px; align-self: flex-start;
    padding: 9px 20px 9px 16px; border-radius: 999px;
    background: rgba(255, 90, 70, .14); border: 1.5px solid rgba(255, 107, 90, .65);
    font-size: 22px; font-weight: 800; letter-spacing: .14em; color: #ff8a7a;
  }
  .live i { width: 13px; height: 13px; border-radius: 50%; background: #ff5a46;
            box-shadow: 0 0 0 6px rgba(255, 90, 70, .25); }

  h1 { margin-top: 22px; font-size: 128px; line-height: 1.12; font-weight: 800; letter-spacing: -.01em; }
  .en { margin-top: 2px; font-size: 40px; font-weight: 700; letter-spacing: .34em; color: #6aa8ff; }
  .tag { margin-top: 26px; font-size: 38px; line-height: 1.4; font-weight: 600; color: #e6eeff; max-width: 640px; }
  .sub { margin-top: 12px; font-size: 24px; color: #8fa5cf; }

  .wave { position: absolute; left: 64px; bottom: 40px; display: flex; align-items: flex-end; gap: 7px; height: 52px; }
  .wave b { width: 9px; border-radius: 5px; background: linear-gradient(180deg, #5fb0ff, #2f7fff); opacity: .9; }

  .brand { position: absolute; right: 48px; bottom: 40px; z-index: 5; display: flex; align-items: center; gap: 14px;
           font-size: 28px; font-weight: 700; color: #fff; text-shadow: 0 2px 14px rgba(0,0,0,.7); }
  .brand img { width: 46px; height: 46px; object-fit: contain; }
  .brand span span { color: #5fb0ff; }
</style></head>
<body>
  <div class="plate"><img src="${portrait}" alt=""></div>

  <div class="copy">
    <div class="live"><i></i>ON AIR</div>
    <h1>भीम रेडियो</h1>
    <div class="en">BHIM RADIO</div>
    <div class="tag">आज की ख़बरें, हिंदी में — बिना लॉगिन, सीधे सुनिए</div>
    <div class="sub">Today's political bulletin · No login needed</div>
  </div>

  <div class="wave">${BARS.map((h) => `<b style="height:${h}%"></b>`).join('')}</div>
  <div class="brand"><img src="${logo}" alt=""><span>Ambedkar<span>GPT</span></span></div>
</body></html>`;

const out = resolve(root, 'public/og/bhimradio.jpg');
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
writeFileSync(out, await page.screenshot({ type: 'jpeg', quality: 82 }));
await browser.close();

const kb = Math.round(statSync(out).size / 1024);
console.log(`wrote ${out} (${kb} KB)`);
if (kb > 300) {
  console.warn('over 300 KB: WhatsApp may drop the thumbnail. Lower the quality in this script.');
}
