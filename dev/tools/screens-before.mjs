// Captures the current (pre-rebuild) UI for every screen into docs/before/.
// Prompt 3's evidence pass: these are the "before" side of the comparison.
//
// Usage: node dev/tools/screens-before.mjs [outDir]
// Requires the dev harness on PREVIEW_URL (default http://localhost:3000).
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const BASE = process.env.PREVIEW_URL ?? 'http://localhost:3000';
const OUT = process.argv[2] ?? 'docs/before';

const SCREENS = [
  { name: 'landing', path: '/', raw: true },
  { name: 'auth', route: '/auth' },
  { name: 'dashboard', route: '/dashboard' },
  { name: 'room', route: '/room/room_a' },
  { name: 'settings', route: '/settings' },
  { name: 'billing', route: '/billing' },
  { name: 'invite', route: '/invite/tok_demo' },
  { name: 'terms', route: '/terms' },
  { name: 'not-found', route: '/nope' },
];

const VIEWPORTS = [
  { label: '1280', width: 1280, height: 900 },
  { label: '375', width: 375, height: 812 },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  for (const screen of SCREENS) {
    const url = screen.raw
      ? `${BASE}${screen.path}`
      : `${BASE}/harness.html?view=app&route=${encodeURIComponent(screen.route)}`;

    await page.goto(url, { waitUntil: 'networkidle' });
    // Let fonts settle and the hero commit land.
    await page.waitForTimeout(2200);

    const file = `${OUT}/${screen.name}@${vp.label}.png`;
    await page.screenshot({ path: file, fullPage: true });
    console.log(`captured ${file}`);
  }

  await context.close();
}

await browser.close();
