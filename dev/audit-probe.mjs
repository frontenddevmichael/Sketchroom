#!/usr/bin/env node
// Layout probe v2: per-page wait selectors, font-loaded check, dark contrast,
// card alignment deltas. No vision needed.
import { chromium } from "playwright";

const EXE = "/home/marshall/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const BASE = "http://localhost:5199/harness.html?view=app&route=";
const ROUTES = {
  landing: ["%2F", ".landing-page"],
  dashboard: ["/dashboard", ".dashboard"],
  room: ["/room/room_a", ".room-screen"],
  settings: ["/settings", ".settings-screen"],
  billing: ["/billing", ".billing-screen"],
  invite: ["/invite/tok_demo", ".error-screen"],
  legal: ["/terms", ".legal-screen"],
  error: ["/error", ".error-screen"],
};
const AUTH = ["http://localhost:5173/auth", ".auth-screen"];
const VIEWPORTS = [375, 768, 1280];
const THEMES = ["light", "dark"];

const probe = async (page) => {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const r = (el) => el.getBoundingClientRect();
    const cs = (el) => getComputedStyle(el);
    const out = {
      interLoaded: document.fonts?.check?.("16px Inter") ?? "n/a",
      bodyFont: cs(document.body).fontFamily,
      bg: cs(document.body).backgroundColor,
      overflowX: doc.scrollWidth > doc.clientWidth + 1,
      offenders: [],
      hSizes: [],
      btnHeights: [],
      zMax: 0,
      align: {},
    };
    for (const el of document.querySelectorAll("body *")) {
      const b = r(el);
      if (b.width > 0 && (b.right > doc.clientWidth + 2 || b.left < -2)) {
        out.offenders.push({ cls: (el.className && String(el.className).slice(0, 50)) || el.tagName, left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) });
      }
      const z = parseInt(cs(el).zIndex || "0", 10);
      if (z > out.zMax) out.zMax = z;
    }
    out.offenders = out.offenders.slice(0, 8);
    for (const el of document.querySelectorAll("h1,h2,h3")) {
      out.hSizes.push({ px: cs(el).fontSize, w: cs(el).fontWeight, cls: (el.className && String(el.className).slice(0, 30)) || "" });
    }
    out.hSizes = [...new Map(out.hSizes.map((x) => [x.px + x.w, x])).values()].slice(0, 6);
    for (const el of document.querySelectorAll("button")) {
      const b = r(el);
      if (b.width > 0 && b.height > 0) out.btnHeights.push(Math.round(b.height));
    }
    // Dashboard grid alignment: room cards
    const cards = [...document.querySelectorAll(".room-card")].map((el) => {
      const b = r(el); return { y: Math.round(b.top), x: Math.round(b.left), w: Math.round(b.width), h: Math.round(b.height) };
    });
    if (cards.length) out.align.roomCards = cards;
    const stats = [...document.querySelectorAll(".stat-tile")].map((el) => {
      const b = r(el); return { y: Math.round(b.top), w: Math.round(b.width) };
    });
    if (stats.length) out.align.statTiles = stats;
    // Dark-mode contrast sample: primary/secondary text on a card
    const sample = document.querySelector(".room-card, .settings-card, .billing-card, .auth-card, .stat-tile");
    if (sample) {
      const text = sample.querySelector("h2,h3,p,.room-card-name,.stat-value,.settings-label");
      if (text) {
        const tc = cs(text).color, bgc = cs(sample).backgroundColor;
        out.align.textSample = { text: tc, surface: bgc, cls: (text.className && String(text.className).slice(0, 30)) || "" };
      }
    }
    return out;
  });
};

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const targets = [...Object.entries(ROUTES).map(([n, [route, sel]]) => ({ n, url: BASE + route, sel })), { n: "auth", url: AUTH[0], sel: AUTH[1] }];

for (const { n, url, sel } of targets) {
  for (const w of VIEWPORTS) {
    for (const theme of THEMES) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, colorScheme: theme });
      const page = await ctx.newPage();
      if (theme === "dark") await page.addInitScript(() => localStorage.setItem("theme", "dark"));
      try {
        await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
        await page.waitForSelector(sel, { timeout: 20000 });
        await page.waitForTimeout(400);
        const d = await probe(page);
        const bgLum = (c) => { const m = c.match(/rgba?\((\d+), (\d+), (\d+)/); return m ? 0.299 * +m[1] + 0.587 * +m[2] + 0.114 * +m[3] : null; };
        console.log(`== ${n} @${w} ${theme} == Inter-loaded:${d.interLoaded} font:${d.bodyFont.split(",")[0]} bg-lum:${Math.round(bgLum(d.bg) ?? 0)} overflow:${d.overflowX ? "YES" : "no"} z-max:${d.zMax}`);
        if (d.offenders.length) console.log(`   OVERFLOW: ${JSON.stringify(d.offenders.slice(0, 3))}`);
        if (d.hSizes.length) console.log(`   type: ${d.hSizes.map((x) => `${x.px}/${x.w}`).join(" ")}`);
        if (d.btnHeights.length) console.log(`   btn-h: ${[...new Set(d.btnHeights)].sort((a, b) => a - b).join(",")}`);
        if (d.align.roomCards) console.log(`   cards: ${JSON.stringify(d.align.roomCards)}`);
        if (d.align.statTiles) console.log(`   stats: ${JSON.stringify(d.align.statTiles)}`);
        if (d.align.textSample) console.log(`   text@surface: ${d.align.textSample.text} on ${d.align.textSample.surface} (${d.align.textSample.cls})`);
      } catch (e) {
        console.log(`== ${n} @${w} ${theme} == FAIL ${e.message.slice(0, 70)}`);
      } finally {
        await ctx.close();
      }
    }
  }
}
await browser.close();