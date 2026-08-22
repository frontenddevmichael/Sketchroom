#!/usr/bin/env node
// Audit capture runner: drives a Playwright browser over a list of captures
// (URL x viewport x theme) and saves full-page screenshots for the visual audit.
// Usage: node dev/audit-capture.mjs <captures.json> <outdir>
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const EXE = "/home/marshall/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const [capturesPath, outdir] = process.argv.slice(2);
const pages = JSON.parse(readFileSync(capturesPath, "utf8"));
mkdirSync(outdir, { recursive: true });

// Expand each page entry across the full audit matrix, UNLESS the entry pins
// explicit width/height/theme (single targeted capture).
const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];
const THEMES = ["light", "dark"];
const captures = pages.flatMap((p) =>
  p.width && p.height && p.theme
    ? [{ ...p }]
    : VIEWPORTS.flatMap((vp) => THEMES.map((theme) => ({ ...p, ...vp, theme })))
);

async function runCapture(page, cap) {
  const { url, waitFor, waitMs } = cap;
  if (cap.hide?.length) {
    await page.addInitScript((sel) => {
      const style = document.createElement("style");
      style.textContent = sel.map((s) => `${s}{visibility:hidden!important}`).join("\n");
      (document.head ?? document.documentElement).appendChild(style);
    }, cap.hide);
  }
  // Theme override before app boot (ThemeProvider reads localStorage 'theme')
  if (cap.theme === "dark") {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 });
  if (waitMs) await page.waitForTimeout(waitMs);
  for (const action of cap.actions ?? []) {
    if (action.click) await page.click(action.click, { timeout: 10000 });
    if (action.fill) await page.fill(action.fill.selector, action.fill.value);
    if (action.waitMs) await page.waitForTimeout(action.waitMs);
  }
  if (cap.waitForAfter) await page.waitForSelector(cap.waitForAfter, { timeout: 10000 });
  if (cap.scrollThrough) {
    await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y <= h; y += Math.max(400, window.innerHeight * 0.8)) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
  }
  return errors;
}

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const results = [];
let failures = 0;

for (const cap of captures) {
  const { name, width, height, theme } = cap;
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme ?? "light" });
  const page = await ctx.newPage();
  const guard = new Promise((_, reject) => setTimeout(() => reject(new Error("capture timeout")), 60000));
  try {
    const errors = await Promise.race([runCapture(page, cap), guard]);
    const file = path.join(outdir, `${name}-${width}x${height}-${theme}.png`);
    await page.screenshot({ path: file, fullPage: true });
    results.push({ name, width, height, theme, file, errors });
    if (errors.length) failures++;
    console.log(`OK   ${name} @${width}x${height} ${theme} -> ${file}${errors.length ? ` (${errors.length} console/page errors)` : ""}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name} @${width}x${height} ${theme}: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
console.log(`\nDone: ${results.length - failures}/${results.length} clean, ${failures} with errors`);
if (failures) {
  for (const r of results) {
    if (r.errors.length) {
      console.log(`\n== ${r.name} @${r.width}x${r.height} ${r.theme} ==`);
      for (const e of r.errors) console.log("  " + e);
    }
  }
}