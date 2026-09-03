/**
 * 把 assets/richmenu.html 轉成 LINE 要求的 2500×1686 PNG。
 * 需要 playwright（npx playwright install chromium）。
 *   node scripts/build-richmenu-image.mjs
 */
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const page = resolve(here, "../assets/richmenu.html");
const out = resolve(here, "../assets/richmenu.png");

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const ctx = await browser.newContext({
  viewport: { width: 2500, height: 1686 },
  deviceScaleFactor: 1,
});
const tab = await ctx.newPage();
await tab.goto(`file://${page}`);
await tab.waitForTimeout(1500); // 等字體載入
await tab.screenshot({ path: out });
await browser.close();
console.log("wrote", out);
