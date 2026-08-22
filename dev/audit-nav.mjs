import { chromium } from "playwright";
const EXE = "/home/marshall/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
const page = await ctx.newPage();
await page.goto("http://localhost:5199/harness.html?view=app&route=%2F", { waitUntil: "networkidle", timeout: 30000 });
await page.waitForSelector(".landing-page", { timeout: 20000 });
await page.waitForTimeout(500);
const out = await page.evaluate(() => {
  const pill = document.querySelector(".landing-nav-pill");
  const cs = getComputedStyle(pill);
  const kids = [...pill.querySelectorAll(":scope > *")].map((k) => {
    const b = k.getBoundingClientRect();
    return { cls: String(k.className).slice(0, 50), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), display: getComputedStyle(k).display };
  });
  const grandkids = [...pill.querySelectorAll(":scope > * > *")].map((k) => {
    const b = k.getBoundingClientRect();
    return { cls: String(k.className).slice(0, 50), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) };
  });
  return { pillCS: { display: cs.display, flexWrap: cs.flexWrap, justify: cs.justifyContent, gap: cs.gap, overflow: cs.overflow, padding: cs.padding }, kids, grandkids: grandkids.slice(0, 10) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();