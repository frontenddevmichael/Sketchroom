// Renders the brand OG image and app icons from inline HTML so the repo has
// real, on-brand social/app assets without any image tooling dependency.
// Run: node dev/gen-brand-assets.mjs
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const GREEN = '#25D366';
const INK = '#F2F2EF';
const MUTED = '#9A9A94';

const star = `
  <svg width="120" height="120" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="${GREEN}" stroke="${GREEN}" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>`;

const ogHtml = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<div style="width:1200px;height:630px;background:#000;position:relative;overflow:hidden;
  background-image:radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px);background-size:26px 26px;">
  <div style="position:absolute;left:50%;top:44%;width:700px;height:700px;transform:translate(-50%,-50%);
    background:radial-gradient(circle, rgba(37,211,102,0.14), transparent 64%);"></div>
  <div style="position:absolute;left:80px;top:70px;">${star}</div>
  <div style="position:absolute;left:80px;top:218px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="font-size:74px;font-weight:700;letter-spacing:-0.03em;color:${INK};">Sketchroom</div>
    <div style="font-size:30px;font-weight:500;color:${MUTED};margin-top:14px;">Plan it together, live.</div>
    <div style="display:flex;gap:14px;margin-top:44px;align-items:center;">
      <div style="width:44px;height:44px;border-radius:50%;background:#232320;border:2px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-size:15px;color:${INK};">MK</div>
      <div style="width:44px;height:44px;border-radius:50%;background:#232320;border:2px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;font-size:15px;color:${INK};">AJ</div>
      <div style="width:44px;height:44px;border-radius:50%;background:${GREEN};display:flex;align-items:center;justify-content:center;font-size:15px;color:#000;">✦</div>
      <div style="font-size:24px;color:${MUTED};margin-left:10px;">Real-time canvas + AI copilot</div>
    </div>
  </div>
</div></body></html>`;

function iconHtml(size) {
  return `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:#000;display:flex;align-items:center;justify-content:center;
  background-image:radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px);background-size:${Math.round(size / 9)}px ${Math.round(size / 9)}px;">
  <svg width="${Math.round(size * 0.62)}" height="${Math.round(size * 0.62)}" viewBox="0 0 24 24" fill="none">
    <path d="M12 3l1.9 5.6L19.5 10l-4.5 2.1L12 18l-3-5.9L4.5 10l5.6-1.4z" fill="${GREEN}" stroke="${GREEN}" stroke-width="1.2" stroke-linejoin="round"/>
  </svg>
</div></body></html>`;
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(ogHtml);
  await page.screenshot({ path: 'public/og.png', type: 'png' });
  console.log('public/og.png written');

  for (const size of [192, 512]) {
    const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(iconHtml(size));
    await p.screenshot({ path: `public/icon-${size}.png`, type: 'png' });
    await p.close();
    console.log(`public/icon-${size}.png written`);
  }
} finally {
  await browser.close();
}
