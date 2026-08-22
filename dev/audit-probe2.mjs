#!/usr/bin/env node
// Targeted probe: content presence for invite/legal/error/auth/room +
// root-cause detail for the landing 375 nav overflow.
import { chromium } from "playwright";

const EXE = "/home/marshall/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome";
const BASE = "http://localhost:5199/harness.html?view=app&route=";
const targets = [
  { n: "landing", url: BASE + "%2F", sel: ".landing-page", extra: "nav" },
  { n: "invite", url: BASE + "/invite/tok_demo", sel: ".error-screen, .invite-screen" },
  { n: "legal", url: BASE + "/terms", sel: ".legal-screen" },
  { n: "error", url: BASE + "/error", sel: ".error-screen" },
  { n: "room", url: BASE + "/room/room_a", sel: ".room-screen" },
  { n: "auth", url: "http://localhost:5173/auth", sel: ".auth-screen" },
];

const browser = await chromium.launch({ executablePath: EXE, headless: true });
for (const { n, url, sel, extra } of targets) {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForSelector(sel, { timeout: 25000 });
    await page.waitForTimeout(500);
    if (extra === "nav") {
      const nav = await page.evaluate(() => {
        const shell = document.querySelector(".landing-nav-shell");
        if (!shell) return "no .landing-nav-shell";
        const cs = getComputedStyle(shell);
        const kids = [...shell.querySelectorAll(":scope > *")].map((k) => {
          const b = k.getBoundingClientRect();
          return { cls: String(k.className).slice(0, 40), left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width) };
        });
        return { display: cs.display, justifyContent: cs.justifyContent, gap: cs.gap, overflow: cs.overflow, padding: cs.padding, kids };
      });
      console.log(`== ${n} ==\n${JSON.stringify(nav, null, 1)}`);
    } else {
      const d = await page.evaluate(() => {
        const text = document.body.innerText.replace(/\s+/g, " ").trim();
        const h = [...document.querySelectorAll("h1,h2,h3,.auth-card-title,.legal-content h1,[class*='title'],[class*='heading']")].slice(0, 6).map((el) => el.textContent.trim().slice(0, 50));
        const btns = [...document.querySelectorAll("button")].map((b) => b.textContent.trim().slice(0, 30)).filter(Boolean).slice(0, 6);
        return { title: document.title, headings: h, buttons: btns, bodyTextLen: text.length, bodyText: text.slice(0, 220) };
      });
      console.log(`== ${n} ==\ntitle: ${d.title}\nheadings: ${JSON.stringify(d.headings)}\nbuttons: ${JSON.stringify(d.buttons)}\ntext(${d.bodyTextLen}): ${d.bodyText}\n`);
    }
  } catch (e) {
    console.log(`== ${n} == FAIL: ${e.message.slice(0, 90)}`);
  } finally {
    await ctx.close();
  }
}
await browser.close();