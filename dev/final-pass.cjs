// Final real-client verification pass: drives the ACTUAL dev server on :5174
// with Playwright's real Chromium (a real user session, not the stub harness).
// Verifies the screens touched across all three phases render with no
// console errors and the expected copy.
const { chromium } = require('playwright');

const BASE = 'http://localhost:5174';
const checks = [];
let failures = 0;

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  // ── 1. Landing page ────────────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  check('landing loads', await page.title().then((t) => t.includes('Sketchroom')));
  check('landing has pricing section', await page.locator('#pricing').isVisible().catch(() => false));
  check('pricing Team card says coming soon',
    await page.locator('.pricing-card-featured .pricing-badge').textContent().catch(() => '').then((t) => t?.includes('Coming soon')));
  check('pricing Team has no purchasable CTA',
    (await page.locator('.pricing-card-featured a.pricing-cta, .pricing-card-featured .btn-primary').count()) === 0);
  check('pricing footnote honest', await page.locator('.pricing-footnote').textContent().catch(() => '').then((t) => t?.includes('billing lives in the app')));

  // ── 2. Terms / Privacy (new routes) ────────────────────────────────────
  await page.goto(`${BASE}/terms`, { waitUntil: 'networkidle' });
  check('terms renders title', await page.locator('.legal-title').textContent().catch(() => '').then((t) => t?.includes('Terms')));
  check('terms topbar home link', await page.locator('.legal-home').count().then((n) => n === 1));

  await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });
  check('privacy renders title', await page.locator('.legal-title').textContent().catch(() => '').then((t) => t?.includes('Privacy')));
  check('privacy footer links', await page.locator('.legal-footer-link').count().then((n) => n === 2));

  // ── 3. Auth screen (sign-in redirects + cleaned header) ────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
  check('signed-out dashboard redirects to /auth',
    page.url().startsWith(`${BASE}/auth`));
  check('redirect preserves next intent',
    page.url().includes('next=%2Fdashboard'));

  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' });
  check('auth shows wordmark', await page.locator('.auth-wordmark').count().then((n) => n === 1));
  check('auth no green arrow artifact',
    (await page.locator('.auth-home-link svg').getAttribute('color').catch(() => null)) === null);
  check('auth reassurance note visible',
    await page.locator('.auth-note-text').isVisible().catch(() => false));
  check('auth footer legal links', await page.locator('.auth-footer a').count().then((n) => n >= 2));

  // ── 4. Error route ─────────────────────────────────────────────────────
  await page.goto(`${BASE}/error`, { waitUntil: 'networkidle' });
  check('error screen renders', await page.locator('.error-screen, .error').count().then((n) => n > 0) ||
    (await page.locator('body').textContent().then((t) => t?.includes('Something went wrong') || t?.includes('error'))));

  // ── 5. No console errors across all touched routes ─────────────────────
  const uniqueErrors = [...new Set(consoleErrors)].filter((e) =>
    // HMR/dev noise we accept: favicon 404, sourcemap, aborted requests, and
    // the live Convex sync socket (its TLS handshake is blocked in this
    // sandbox — an environment limit, not an app bug).
    !/favicon|\.map|net::ERR_ABORTED|Download the React DevTools|convex\.cloud.*sync.*WebSocket|ERR_SSL_BAD_RECORD_MAC/i.test(e));
  check('no console errors', uniqueErrors.length === 0, uniqueErrors.slice(0, 3).join(' | ') || '');

  await page.screenshot({ path: 'dev/shots/final-pass.png', fullPage: true });
  console.log(`\n${checks.length - failures}/${checks.length} checks passed`);
  await browser.close();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error('CRASH', e);
  process.exit(1);
});
